// NAUTOG shop - creates a Stripe Checkout page for the customer's basket.
//
// Runs on Netlify (free tier). It needs one setting in Netlify:
//   STRIPE_SECRET_KEY = your Stripe secret key (starts sk_live_ or rk_live_)
//
// Prices are set HERE, not taken from the browser, so nobody can change
// the price of an order. If you change a price, change it in index.html too.

const PRODUCTS = {
  logo:       { name: "NAUTOG Logo Sticker",         pence: 100 },
  getstuckin: { name: "Get Stuck In Circle Sticker", pence: 35 },
};

const SHIPPING_PENCE = 100;               // flat £1.00 per order
const SHIPPING_NAME = "Royal Mail 2nd Class";
const MAX_PER_ITEM = 50;

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

  // Build the Stripe request from our own price list
  const form = new URLSearchParams();
  const summary = [];
  let n = 0;
  for (const it of items) {
    const p = PRODUCTS[it && it.id];
    const qty = Number(it && it.qty);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > MAX_PER_ITEM) {
      return json(400, { error: "Invalid basket" });
    }
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
  form.append("success_url", `${site}/#thanks`);
  form.append("cancel_url", `${site}/#shop`);
  form.append("shipping_address_collection[allowed_countries][0]", "GB");
  form.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  form.append("shipping_options[0][shipping_rate_data][display_name]", SHIPPING_NAME);
  form.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(SHIPPING_PENCE));
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
