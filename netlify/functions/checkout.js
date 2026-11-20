// NAUTOG shop - creates a Stripe Checkout page for the customer's basket.
//
// Runs on Netlify (free tier). It needs one setting in Netlify:
//   STRIPE_SECRET_KEY = your Stripe secret key (starts sk_live_ or rk_live_)
//
// Prices, postage and sold-out status come from products.json (the same file
// the website uses), never from the browser, so nobody can change a price.

const CATALOGUE = require("../../products.json");

const SHIPPING_NAME = "Royal Mail 2nd Class";
const MAX_PER_ITEM = 50;

const byId = {};
for (const p of CATALOGUE.products) byId[p.id] = p;

// A product is unavailable if it, or anything inside a pack, is sold out
function isSoldOut(p) {
  if (p.soldOut) return true;
  if (p.contains) return Object.keys(p.contains).some((id) => !byId[id] || byId[id].soldOut);
  return false;
}

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(500, { error: "Stripe key not set up in Netlify" });

  let items;
  try {
    items = JSON.parse(event.body || "{}").items;
  } catch {
    return json(400, { error: "Bad request" });
  }
  if (!Array.isArray(items) || items.length === 0) return json(400, { error: "Basket is empty" });

  const form = new URLSearchParams();
  const summary = [];
  const seen = new Set();
  let n = 0;
  for (const it of items) {
    const p = byId[it && it.id];
    const qty = Number(it && it.qty);
    if (!p || seen.has(p.id) || !Number.isInteger(qty) || qty < 1 || qty > MAX_PER_ITEM) {
      return json(400, { error: "Invalid basket" });
    }
    if (isSoldOut(p)) return json(409, { error: `${p.name} is sold out` });
    seen.add(p.id);
    form.append(`line_items[${n}][price_data][currency]`, "gbp");
    form.append(`line_items[${n}][price_data][unit_amount]`, String(p.pence));
    form.append(`line_items[${n}][price_data][product_data][name]`, p.name);
    form.append(`line_items[${n}][quantity]`, String(qty));
    summary.push(`${qty}x ${p.name}`);
    n++;
  }

  // Netlify provides the site's address in process.env.URL
  const site = (process.env.URL || "").replace(/\/$/, "");

  form.append("mode", "payment");
  // Shows the order in the Description column of Stripe's payments list
  form.append("payment_intent_data[description]", summary.join(", "));
  form.append("success_url", `${site}/thanks.html`);
  form.append("cancel_url", `${site}/#shop`);
  form.append("shipping_address_collection[allowed_countries][0]", "GB");
  // Shown above the Pay button on Stripe's page
  form.append("custom_text[submit][message]",
    "By paying you agree to the NAUTOG Terms of sale on our website. You can cancel within 14 days of delivery.");
  form.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  form.append("shipping_options[0][shipping_rate_data][display_name]", SHIPPING_NAME);
  form.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(CATALOGUE.shippingPence));
  form.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "gbp");

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Stripe error:", data.error && data.error.message);
      return json(502, { error: "Could not start checkout" });
    }
    return json(200, { url: data.url });
  } catch (e) {
    console.error(e);
    return json(502, { error: "Could not reach Stripe" });
  }
};
