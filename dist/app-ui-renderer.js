"use strict";

const uiRenderer = (() => {
  function rect(transform, parent) {
    if (!transform) return { left: 0, top: 0, width: parent.width, height: parent.height };
    const a = transform.anchorMin || { x: 0, y: 0 };
    const b = transform.anchorMax || a;
    const p = transform.pivot || { x: .5, y: .5 };
    const d = transform.sizeDelta || { x: 0, y: 0 };
    const pos = transform.anchoredPosition || { x: 0, y: 0 };
    const width = parent.width * (b.x - a.x) + d.x;
    const height = parent.height * (b.y - a.y) + d.y;
    const anchorX = parent.width * (a.x + (b.x - a.x) * p.x);
    const anchorY = parent.height * (a.y + (b.y - a.y) * p.y);
    return { left: anchorX + pos.x - width * p.x, top: parent.height - anchorY - pos.y - height * (1 - p.y), width, height };
  }
  function spriteEntry(key, manifest) { return manifest.sprites.find(item => item.key === key); }
  function graphic(el, data, manifest) {
    if (!data) return;
    const layer = document.createElement("div");
    layer.className = "ui-visual";
    el.prepend(layer);
    const entry = spriteEntry(data.spriteKey, manifest);
    const url = entry?.output;
    if (url) {
      const sliced = data.fillType === 1 && (data.enableBorderImage !== false);
      const border = entry.border;
      const visual = document.createElement(sliced && border && Object.values(border).some(Number) ? "div" : "img");
      visual.className = "ui-sprite";
      if (visual.tagName === "IMG") { visual.src = url; visual.alt = ""; visual.draggable = false; }
      else {
        visual.classList.add("ui-sliced");
        visual.style.borderWidth = `${border.top}px ${border.right}px ${border.bottom}px ${border.left}px`;
        visual.style.borderImageSource = `url("${url}")`;
        visual.style.borderImageSlice = `${border.top} ${border.right} ${border.bottom} ${border.left} ${data.centerInvisible ? "" : "fill"}`.trim();
        visual.style.borderImageRepeat = data.fillType === 2 ? "repeat" : "stretch";
      }
      layer.appendChild(visual);
      if (data.color && data.color.toUpperCase() !== "#FFFFFF") {
        layer.style.backgroundColor = data.color;
        visual.style.mixBlendMode = "multiply";
      }
    } else if (data.spriteKey) {
      layer.classList.add("ui-missing-sprite");
      el.dataset.uiMissingSprite = data.spriteKey;
      layer.dataset.uiMissingLabel = data.spriteKey.split("/").at(-1);
    }
    if (data.reverse?.x) el.classList.add("ui-flip-x");
    if (data.reverse?.y) el.classList.add("ui-flip-y");
    if (data.fillType === 3 && data.fillAmount != null && data.fillAmount > 0 && data.fillAmount < 1 && data.fillDir === 0) el.style.clipPath = `inset(0 ${100 * (1 - data.fillAmount)}% 0 0)`;
  }
  function setSprite(el, key, data, manifest) {
    if (!el) return;
    el.querySelector(":scope > .ui-visual")?.remove();
    el.classList.remove("ui-missing-sprite", "ui-flip-x", "ui-flip-y");
    delete el.dataset.uiMissingSprite;
    graphic(el, { ...data, spriteKey: key }, manifest);
    el.dataset.uiSpriteKey = key;
  }
  function text(el, data) {
    if (!data) return;
    const span = document.createElement("span");
    span.className = "ui-text";
    span.textContent = data.key ? uiTranslate(data.key) : (data.value || "");
    span.style.fontSize = `${data.fontSize || 16}px`;
    span.style.color = data.color || "#fff";
    span.style.fontWeight = data.fontStyle?.bold ? "700" : "400";
    span.style.fontStyle = data.fontStyle?.italic ? "italic" : "normal";
    span.style.textDecoration = data.fontStyle?.underline ? "underline" : "none";
    span.style.justifyContent = ({ left: "flex-start", center: "center", right: "flex-end" })[data.alignment?.h] || "center";
    span.style.alignItems = ({ top: "flex-start", middle: "center", bottom: "flex-end" })[data.alignment?.v] || "center";
    if (data.shadow) span.style.textShadow = `${data.shadowOffset?.x || 1}px ${data.shadowOffset?.y || 1}px 1px ${data.shadowColor || "#000"}`;
    if (data.outline) span.style.webkitTextStroke = `${data.outlineOffset || 1}px ${data.outlineColor || "#000"}`;
    el.appendChild(span);
  }
  function layoutPosition(layout, index, parent) {
    if (!layout?.enable) return null;
    const cell = layout.size || { x: 0, y: 0 };
    const gap = layout.space || { x: 0, y: 0 };
    const offset = layout.offset || {};
    if (layout.type === "grid") {
      const available = Math.max(1, parent.width - (offset.left || 0) - (offset.right || 0));
      const columns = layout.direction === 1 ? 1 : Math.max(1, Math.floor((available + gap.x) / (cell.x + gap.x)));
      const col = layout.direction === 1 ? 0 : index % columns;
      const row = layout.direction === 1 ? index : Math.floor(index / columns);
      return { left: (offset.left || 0) + col * (cell.x + gap.x), top: (offset.up || 0) + row * (cell.y + gap.y), width: cell.x, height: cell.y };
    }
    if (layout.type === "horizontal") return { left: (offset.left || 0) + index * (cell.x + gap.x), top: offset.up || 0, width: cell.x, height: cell.y };
    if (layout.type === "vertical") return { left: offset.left || 0, top: (offset.up || 0) + index * (cell.y + gap.y), width: cell.x, height: cell.y };
    return null;
  }
  function render(data, manifest, width, height) {
    const canvas = document.createElement("div");
    canvas.className = "ui-canvas";
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const byId = new Map();
    function add(node, parent, parentRect, index = 0, parentLayout = null) {
      const element = document.createElement(node.type === "UIButtonEntity" ? "button" : "div");
      element.className = "ui-entity";
      element.dataset.uiPath = node.path;
      element.dataset.uiType = node.type;
      element.dataset.uiId = node.id;
      element.dataset.uiName = node.name;
      element.dataset.uiSpriteKey = node.image?.spriteKey || node.button?.spriteKey || "";
      if (node.type === "UIButtonEntity") { element.type = "button"; element.setAttribute("aria-label", node.name); }
      if (!node.active) element.classList.add("ui-inactive");
      const r = layoutPosition(parentLayout, index, parentRect) || rect(node.transform, parentRect);
      element.style.left = `${r.left}px`;
      element.style.top = `${r.top}px`;
      element.style.width = `${Math.max(0, r.width)}px`;
      element.style.height = `${Math.max(0, r.height)}px`;
      // Retain the existing web composite/cascade until runtime evidence
      // establishes whether Craftland applies alpha to descendants.
      // CSS opacity never disables a button's hit rectangle.
      element.style.opacity = String((node.alpha ?? 100) / 100);
      element.dataset.uiAlpha = String(node.alpha ?? 100);
      element.dataset.uiPriority = String(node.priority ?? 0);
      element.dataset.uiHitTarget = String(!!node.button && !node.button.disableCollider);
      if (node.button?.disableCollider) element.disabled = true;
      if (node.transform?.rotate) element.style.transform = `rotate(${-node.transform.rotate}deg)`;
      graphic(element, node.image || (node.button ? { ...node.button, color: node.button.normal } : null), manifest);
      if (node.button) {
        const tint = color => {
          const layer = element.querySelector(":scope > .ui-visual");
          if (layer) layer.style.backgroundColor = color || "";
          const visual = layer?.querySelector(".ui-sprite");
          if (visual) visual.style.mixBlendMode = color?.toUpperCase() === "#FFFFFF" ? "normal" : "multiply";
        };
        const normal = () => tint(node.button.disableCollider ? node.button.disabled : node.button.normal);
        normal();
        element.addEventListener("pointerdown", () => {
          if (!node.button.disableCollider) tint(node.button.pressed);
        });
        element.addEventListener("pointerup", normal);
        element.addEventListener("pointercancel", normal);
        element.addEventListener("pointerleave", normal);
      }
      text(element, node.text);
      parent.appendChild(element);
      byId.set(node.id, element);
      node.children.forEach((child, childIndex) => add(child, element, r, childIndex, node.layout));
      return element;
    }
    add(data.tree, canvas, { width, height });
    return { canvas, byId };
  }
  return { render, rect, setSprite };
})();
