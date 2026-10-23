"use strict";

const uiRenderer = (() => {
  const spriteCache = new Map();
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
  function rgb(color) {
    const match = String(color || "#FFFFFF").match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i);
    if (!match) return { r: 255, g: 255, b: 255, a: 1 };
    let hex = match[1];
    if (hex.length === 3) hex = [...hex].map(value => value + value).join("");
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
  }
  function gradientColor(value) {
    if (!value) return { r: 255, g: 255, b: 255, a: 1 };
    const alpha = Number(value.a ?? 1);
    return { r: Number(value.r ?? 255), g: Number(value.g ?? 255), b: Number(value.b ?? 255), a: alpha > 1 ? alpha / 255 : alpha };
  }
  function processSprite(url, data) {
    const tint = rgb(data.color);
    const gradient = Number(data.gradient) > 0;
    const top = gradientColor(data.gradientTop);
    const bottom = gradientColor(data.gradientBottom);
    if (tint.r === 255 && tint.g === 255 && tint.b === 255 && tint.a === 1 && !gradient) return Promise.resolve(url);
    const key = JSON.stringify([url, tint, data.gradient, top, bottom]);
    if (spriteCache.has(key)) return spriteCache.get(key);
    const result = new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = pixels.data;
          for (let y = 0; y < canvas.height; y++) {
            const amount = canvas.height > 1 ? y / (canvas.height - 1) : 0;
            const factor = gradient ? {
              r: top.r + (bottom.r - top.r) * amount,
              g: top.g + (bottom.g - top.g) * amount,
              b: top.b + (bottom.b - top.b) * amount,
              a: top.a + (bottom.a - top.a) * amount
            } : { r: 255, g: 255, b: 255, a: 1 };
            for (let x = 0; x < canvas.width; x++) {
              const offset = (y * canvas.width + x) * 4;
              data[offset] = Math.round(data[offset] * tint.r / 255 * factor.r / 255);
              data[offset + 1] = Math.round(data[offset + 1] * tint.g / 255 * factor.g / 255);
              data[offset + 2] = Math.round(data[offset + 2] * tint.b / 255 * factor.b / 255);
              data[offset + 3] = Math.round(data[offset + 3] * factor.a);
            }
          }
          context.putImageData(pixels, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(url);
        }
      };
      image.onerror = () => resolve(url);
      image.src = url;
    });
    spriteCache.set(key, result);
    if (spriteCache.size > 512) spriteCache.delete(spriteCache.keys().next().value);
    return result;
  }
  function applyTint(visual, color) {
    if (!visual) return;
    const source = visual.dataset.uiSourceUrl;
    if (!source) return;
    let data = {};
    try { data = JSON.parse(visual.dataset.uiRenderData || "{}"); } catch {}
    data.color = color || "#FFFFFF";
    visual.dataset.uiRenderData = JSON.stringify(data);
    const version = Number(visual.dataset.uiRenderVersion || 0) + 1;
    visual.dataset.uiRenderVersion = String(version);
    processSprite(source, data).then(rendered => {
      if (visual.dataset.uiRenderVersion !== String(version) || visual.dataset.uiSourceUrl !== source) return;
      if (visual.tagName === "IMG") visual.src = rendered;
      else visual.style.borderImageSource = `url("${rendered}")`;
    });
  }
  function mountSprite(layer, url, data, entry = null, simple = false) {
    const sliced = !simple && data.fillType === 1 && (data.enableBorderImage !== false) && entry?.border && Object.values(entry.border).some(Number);
    const visual = document.createElement(sliced ? "div" : "img");
    visual.className = "ui-sprite";
    if (visual.tagName === "IMG") { visual.src = url; visual.alt = ""; visual.draggable = false; }
    else {
      visual.classList.add("ui-sliced");
      const border = entry.border;
      visual.style.borderWidth = `${border.top}px ${border.right}px ${border.bottom}px ${border.left}px`;
      visual.style.borderImageSource = `url("${url}")`;
      visual.style.borderImageSlice = `${border.top} ${border.right} ${border.bottom} ${border.left} ${data.centerInvisible ? "" : "fill"}`.trim();
      visual.style.borderImageRepeat = data.fillType === 2 ? "repeat" : "stretch";
    }
    visual.dataset.uiSourceUrl = url;
    visual.dataset.uiRenderData = JSON.stringify({ color: data.color || "#FFFFFF", gradient: data.gradient || 0, gradientTop: data.gradientTop, gradientBottom: data.gradientBottom });
    layer.appendChild(visual);
    applyTint(visual, data.color || "#FFFFFF");
    return visual;
  }
  function graphic(el, data, manifest) {
    if (!data) return;
    const layer = document.createElement("div");
    layer.className = "ui-visual";
    el.prepend(layer);
    const entry = spriteEntry(data.spriteKey, manifest);
    const url = entry?.output;
    if (url) {
      const visual = mountSprite(layer, url, data, entry);
      visual.dataset.uiSpriteKey = data.spriteKey || "";
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
  function setImage(el, url, data = {}) {
    if (!el) return;
    const layer = el.querySelector(":scope > .ui-visual") || document.createElement("div");
    layer.className = "ui-visual";
    if (!layer.parentElement) el.prepend(layer);
    layer.replaceChildren();
    el.classList.remove("ui-missing-sprite");
    if (!url) return;
    const visual = mountSprite(layer, url, { ...data, fillType: 0 }, null, true);
    el.dataset.uiSpriteKey = data.spriteKey || "";
    visual.dataset.uiSpriteKey = data.spriteKey || "";
  }
  function tint(el, color) {
    if (!el) return;
    el.dataset.uiRuntimeColor = color || "#FFFFFF";
    for (const visual of el.querySelectorAll(":scope > .ui-visual > .ui-sprite")) applyTint(visual, color || "#FFFFFF");
  }
  function setTextOutlineColor(el, color) {
    const span = el?.querySelector(":scope > .ui-text");
    if (!span) return;
    span.style.webkitTextStroke = color ? `${Math.max(1, Number(span.dataset.uiOutlineWidth) || 1)}px ${color}` : "";
    span.style.paintOrder = "stroke fill";
    span.dataset.uiRuntimeOutlineColor = color || "";
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
    span.dataset.uiOutlineWidth = String(data.outlineOffset || 1);
    el.appendChild(span);
  }
  const layoutQueue = new WeakSet();
  function elementSize(element) {
    return { width: Number.parseFloat(element.style.width) || 0, height: Number.parseFloat(element.style.height) || 0 };
  }
  function resizeKeepPivot(element, width, height) {
    const current = elementSize(element);
    const transform = (() => { try { return JSON.parse(element.dataset.uiTransform || "{}"); } catch { return {}; } })();
    const pivot = transform.pivot || { x: .5, y: .5 };
    const left = Number.parseFloat(element.style.left) || 0;
    const top = Number.parseFloat(element.style.top) || 0;
    const pivotX = left + current.width * pivot.x;
    const pivotY = top + current.height * (1 - pivot.y);
    element.style.width = `${Math.max(0, width)}px`;
    element.style.height = `${Math.max(0, height)}px`;
    element.style.left = `${pivotX - width * pivot.x}px`;
    element.style.top = `${pivotY - height * (1 - pivot.y)}px`;
  }
  function childIsActive(element) {
    return !element.classList.contains("ui-inactive") && element.style.display !== "none";
  }
  function layoutOptions(element) {
    try { return JSON.parse(element.dataset.uiLayoutOptions || "{}"); } catch { return {}; }
  }
  function applyLayout(element, node) {
    const layout = node.layout;
    if (!layout?.enable) return;
    const options = layoutOptions(element);
    const children = [...element.children].filter(child => child.classList.contains("ui-entity"));
    const ordered = children.map((child, index) => ({ child, index, priority: Number(child.dataset.uiPriority || 0), active: childIsActive(child) }));
    ordered.sort((a, b) => {
      if (layout.ignoreInactive && a.active !== b.active) return Number(b.active) - Number(a.active);
      if (layout.sortType === 1 && a.priority !== b.priority) return b.priority - a.priority;
      if (layout.sortType === 2 && a.priority !== b.priority) return a.priority - b.priority;
      return a.index - b.index;
    });

    const cell = layout.size || { x: 0, y: 0 };
    const gap = layout.space || { x: 0, y: 0 };
    const offset = layout.offset || {};
    const tableOffset = layout.tableOffset || {};
    const tableSpace = Number(layout.tableSpace) || 0;
    const left = (Number(offset.left) || 0) + (Number(tableOffset.left) || 0);
    const right = (Number(offset.right) || 0) + (Number(tableOffset.right) || 0);
    const top = (Number(offset.up) || 0) + (Number(tableOffset.up) || 0);
    const bottom = (Number(offset.down) || 0) + (Number(tableOffset.down) || 0);
    const gapX = (Number(gap.x) || 0) + tableSpace;
    const gapY = (Number(gap.y) || 0) + tableSpace;
    let parent = elementSize(element);
    let columns = 1, rows = 1;
    const direction = Number(layout.direction) === 1 ? "vertical" : "horizontal";
    const constraint = Number(layout.constraint) || 0;
    const fixedRows = Math.max(1, Number(layout.fixedRowCount) || 1);
    const fixedColumns = Math.max(1, Number(layout.fixedColumnCount) || 1);
    const maxColumns = Math.max(0, Number(options.maxColumns) || 0);
    const fixedRowsMode = constraint === 1;
    const fixedColumnsMode = constraint === 2;

    if (options.resizeHeightToVisibleRows) {
      const visibleCount = ordered.filter(item => item.active).length;
      const columnsForHeight = maxColumns || Math.max(1, Math.floor((parent.width - left - right + gapX) / Math.max(1, cell.x + gapX)));
      rows = visibleCount ? Math.ceil(visibleCount / columnsForHeight) : 0;
      const height = rows ? rows * cell.y + (rows - 1) * gapY + top + bottom : top + bottom;
      resizeKeepPivot(element, parent.width, height);
      element.dataset.uiRuntimeSize = JSON.stringify({ width: parent.width, height });
      parent = elementSize(element);
    }

    if (direction === "vertical") {
      rows = fixedRowsMode ? fixedRows : Math.max(1, Math.floor((parent.height - top - bottom + gapY) / Math.max(1, cell.y + gapY)));
      columns = fixedColumnsMode ? fixedColumns : maxColumns || Math.ceil(ordered.length / rows);
      if (!fixedRowsMode && !fixedColumnsMode && maxColumns) rows = Math.max(1, Math.ceil(ordered.length / maxColumns));
    } else {
      columns = fixedColumnsMode ? fixedColumns : maxColumns || Math.max(1, Math.floor((parent.width - left - right + gapX) / Math.max(1, cell.x + gapX)));
      rows = fixedRowsMode ? fixedRows : Math.max(1, Math.ceil(ordered.length / columns));
    }
    columns = Math.max(1, columns);
    rows = Math.max(1, rows);
    const corner = Number(layout.corner) || 0;
    const reverseColumns = corner === 1 || corner === 3;
    const reverseRows = corner === 2 || corner === 3;

    ordered.forEach((item, index) => {
      let column = direction === "vertical" ? Math.floor(index / rows) : index % columns;
      let row = direction === "vertical" ? index % rows : Math.floor(index / columns);
      const cellLeft = reverseColumns ? parent.width - right - cell.x - column * (cell.x + gapX) : left + column * (cell.x + gapX);
      const cellTop = reverseRows ? parent.height - bottom - cell.y - row * (cell.y + gapY) : top + row * (cell.y + gapY);
      let transform = {};
      try { transform = JSON.parse(item.child.dataset.uiTransform || "{}"); } catch {}
      const childRect = rect(transform, parent);
      const pivot = transform.pivot || { x: .5, y: .5 };
      const width = childRect.width || cell.x;
      const height = childRect.height || cell.y;
      item.child.style.left = `${cellLeft + cell.x / 2 - width * pivot.x}px`;
      item.child.style.top = `${cellTop + cell.y / 2 - height * (1 - pivot.y)}px`;
      item.child.style.width = `${Math.max(0, width)}px`;
      item.child.style.height = `${Math.max(0, height)}px`;
    });
  }
  function layoutTree(canvas, data) {
    const byId = new Map(), byPath = new Map();
    (function index(node) { byId.set(node.id, node); byPath.set(node.path, node); node.children.forEach(index); })(data.tree);
    function walk(node, element) {
      applyLayout(element, node);
      for (const child of [...element.children].filter(item => item.classList.contains("ui-entity"))) {
        const childNode = byId.get(child.dataset.uiId) || byPath.get(child.dataset.uiPath || child.dataset.uiClonePath);
        if (childNode) walk(childNode, child);
      }
    }
    walk(data.tree, canvas.firstElementChild);
  }
  function refreshLayouts(canvas, data) {
    if (!canvas || layoutQueue.has(canvas)) return;
    layoutQueue.add(canvas);
    const callback = () => { layoutQueue.delete(canvas); layoutTree(canvas, data); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(callback);
    else window.setTimeout(callback, 0);
  }
  function setLayoutOptions(element, options, canvas, data) {
    if (!element) return;
    element.dataset.uiLayoutOptions = JSON.stringify(options || {});
    refreshLayouts(canvas, data);
  }
  function setSize(element, size, canvas, data) {
    if (!element) return;
    const current = elementSize(element);
    resizeKeepPivot(element, Number.isFinite(size.width) ? size.width : current.width, Number.isFinite(size.height) ? size.height : current.height);
    element.dataset.uiRuntimeSize = JSON.stringify(elementSize(element));
    refreshLayouts(canvas, data);
  }
  function render(data, manifest, width, height) {
    const canvas = document.createElement("div");
    canvas.className = "ui-canvas";
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const byId = new Map();
    function add(node, parent, parentRect) {
      const element = document.createElement(node.type === "UIButtonEntity" ? "button" : "div");
      element.className = "ui-entity";
      element.dataset.uiPath = node.path;
      element.dataset.uiType = node.type;
      element.dataset.uiId = node.id;
      element.dataset.uiName = node.name;
      element.dataset.uiSpriteKey = node.image?.spriteKey || node.button?.spriteKey || "";
      element.dataset.uiTransform = JSON.stringify(node.transform || {});
      element.dataset.uiBaseActive = String(!!node.active);
      if (node.type === "UIButtonEntity") { element.type = "button"; element.setAttribute("aria-label", node.name); }
      if (!node.active) element.classList.add("ui-inactive");
      const r = rect(node.transform, parentRect);
      element.dataset.uiBaseWidth = String(Math.max(0, r.width));
      element.dataset.uiBaseHeight = String(Math.max(0, r.height));
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
        const tint = color => uiRenderer.tint(element, color);
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
      node.children.forEach(child => add(child, element, r));
      return element;
    }
    add(data.tree, canvas, { width, height });
    layoutTree(canvas, data);
    return { canvas, byId };
  }
  return { render, rect, setSprite, setImage, tint, setTextOutlineColor, refreshLayouts, setLayoutOptions, setSize };
})();
