(() => {
  const katex = window.katex;

  if (!katex) {
    document.documentElement.dataset.proofMath = "fallback";
    return;
  }

  function renderEquation(node) {
    if (!(node instanceof HTMLElement) || node.dataset.proofMathRendered === "true") {
      return;
    }

    const source = node.dataset.proofLatex;
    if (!source) return;

    const fallback = node.innerHTML;
    try {
      katex.render(source, node, {
        displayMode: node.dataset.proofDisplay !== "inline",
        output: "htmlAndMathml",
        strict: "warn",
        throwOnError: true,
        trust: false,
      });
      node.classList.add("proof-math");
      node.dataset.proofMathRendered = "true";
    } catch (error) {
      node.innerHTML = fallback;
      node.classList.add("proof-math-fallback");
      console.error("Equation could not be typeset", error);
    }
  }

  function renderDeclarative(root = document) {
    if (root instanceof HTMLElement && root.matches("[data-proof-latex]")) {
      renderEquation(root);
    }
    root
      .querySelectorAll?.("[data-proof-latex]")
      .forEach((node) => renderEquation(node));
  }

  const task4Equations = [
    [".task4-method-equations p:nth-child(1)", String.raw`hf=\Phi+K_{\max}`],
    [".task4-method-equations p:nth-child(2)", String.raw`eV_s=K_{\max}`],
    [
      ".task4-method-equations p:nth-child(3)",
      String.raw`V_s=\frac{h}{e}f-\frac{\Phi}{e}`,
    ],
    [
      ".task4-simple-equation",
      String.raw`eV_s=K_{\max}=hf-\Phi`,
    ],
  ];

  function renderTask4(root = document) {
    if (!location.pathname.includes("/site/apps/task-04/")) return;
    task4Equations.forEach(([selector, source]) => {
      const nodes = [];
      if (root instanceof HTMLElement && root.matches(selector)) nodes.push(root);
      root.querySelectorAll?.(selector).forEach((node) => nodes.push(node));
      nodes.forEach((node) => {
        if (!node.dataset.proofLatex) node.dataset.proofLatex = source;
        renderEquation(node);
      });
    });
  }

  function render(root = document) {
    renderDeclarative(root);
    renderTask4(root);
    document.documentElement.dataset.proofMath = "ready";
  }

  render();

  if (location.pathname.includes("/site/apps/task-04/")) {
    let queued = false;
    const observer = new MutationObserver((records) => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        records.forEach((record) =>
          record.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) render(node);
          }),
        );
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }
})();
