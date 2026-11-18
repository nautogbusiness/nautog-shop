/* =========================================================
   NAUTOG SELLER DETAILS
   UK law requires these to be shown on the website.
   Edit them here and they update on every page.
   ========================================================= */
window.SITE_INFO = {
  ownerName: "Nathan O'Grady",           // your full name (you trade as a sole trader)
  tradingName: "NAUTOG",
  address: "",                            // a real UK postal address (not a PO Box)
  email: "nautog.business@gmail.com",     // email customers can contact you on
  dispatchDays: "3 working days",         // how soon you post orders
  lastUpdated: "18 November 2026"
};

/* Fills in any element with data-info="..." on the page */
(function () {
  function fill() {
    var info = window.SITE_INFO;
    document.querySelectorAll("[data-info]").forEach(function (el) {
      var key = el.getAttribute("data-info");
      var val = info[key];
      if (val) {
        if (key === "email" && el.tagName === "A") { el.href = "mailto:" + val; }
        el.textContent = val;
        el.classList.remove("missing");
      } else {
        el.textContent = "[" + key + " to be added]";
        el.classList.add("missing");
      }
    });
  }
  function hideMissing() {
    var info = window.SITE_INFO;
    document.querySelectorAll("[data-needs]").forEach(function (el) {
      if (!info[el.getAttribute("data-needs")]) el.style.display = "none";
    });
  }
  var _fill = fill; fill = function () { _fill(); hideMissing(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
})();
