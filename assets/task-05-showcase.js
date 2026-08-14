(() => {
  const toggles = [...document.querySelectorAll("[data-task05-display-toggle]")];
  const labels = [...document.querySelectorAll("[data-task05-display-label]")];
  if (!toggles.length) return;

  function isPresentation() {
    return document.body.classList.contains("is-task05-presentation") ||
      document.documentElement.classList.contains("task05-presentation-requested");
  }

  function sync(enabled, updateUrl = true) {
    document.body.classList.toggle("is-task05-presentation", enabled);
    document.documentElement.classList.toggle("task05-presentation-requested", enabled);
    toggles.forEach((toggle) => {
      toggle.setAttribute("aria-pressed", String(enabled));
      toggle.setAttribute("aria-label", enabled ? "Exit display mode" : "Enter display mode");
      toggle.setAttribute("title", enabled ? "Exit display mode" : "Enter display mode");
    });
    labels.forEach((label) => { label.textContent = enabled ? "\u00d7" : "Display"; });

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (enabled) url.searchParams.set("mode", "display");
      else url.searchParams.delete("mode");
      window.history.replaceState(null, "", url);
    }

    window.dispatchEvent(new CustomEvent("task05:display-mode", { detail: { enabled } }));
  }

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => sync(!isPresentation()));
  });

  sync(isPresentation(), false);
})();
