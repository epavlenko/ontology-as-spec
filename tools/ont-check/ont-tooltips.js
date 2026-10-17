// Mockup runtime: every [data-ont] element without its own title gets "Term. Definition" from
// window.ONT (the generated glossary). Load after ontology.js. Re-applies on DOM changes, so
// elements rendered by scripts get tooltips too.
(function () {
  function apply(root) {
    if (!window.ONT) return;
    root.querySelectorAll("[data-ont]").forEach(function (el) {
      var c = window.ONT[el.getAttribute("data-ont")];
      if (c && !el.title) el.title = c.name + ". " + c.def;
    });
  }
  function start() {
    apply(document);
    new MutationObserver(function () {
      apply(document);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
