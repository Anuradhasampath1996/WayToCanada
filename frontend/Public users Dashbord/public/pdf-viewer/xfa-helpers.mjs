const WARNING_SNIPPETS = [
  "JavaScript has been disabled",
  "Please enable JavaScript through Preferences",
];

function isWarningOnlyText(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!WARNING_SNIPPETS.some((s) => t.includes(s))) return false;
  // Only target the warning block itself — not containers with the whole page.
  return t.length < 280;
}

/** Hide IRCC XFA "JavaScript has been disabled" banner without removing form fields. */
export function hideIrccXfaJsWarning(root = document) {
  const layers = root.querySelectorAll(".xfaLayer");
  for (const layer of layers) {
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const raw = node.textContent || "";
      if (!isWarningOnlyText(raw)) continue;

      let el = node.parentElement;
      // Walk up only while the element still looks like the warning block.
      while (el && el !== layer) {
        const blockText = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!WARNING_SNIPPETS.some((s) => blockText.includes(s))) break;
        if (blockText.length > 320) break;

        if (el.hasAttribute("data-wtc-hidden-xfa-warning")) break;

        el.style.setProperty("display", "none", "important");
        el.setAttribute("data-wtc-hidden-xfa-warning", "true");
        el.setAttribute("aria-hidden", "true");
        break;
      }
    }
  }
}

export function attachIrccXfaCleanup(eventBus, container) {
  const run = () => {
    hideIrccXfaJsWarning(container);
    window.setTimeout(() => hideIrccXfaJsWarning(container), 600);
  };

  eventBus.on("xfalayerrendered", run);
  eventBus.on("pagerendered", run);

  return () => {};
}
