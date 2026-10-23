"use strict";

function uiResourceRows(context, extraCells = () => "") {
  const rows = [];
  function walk(node, parentAlpha = 1) {
    const effectiveAlpha = parentAlpha * (node.alpha ?? 100) / 100;
    if (node.image || node.button || node.text) {
      const data = node.image || node.button || {};
      const element = context.rendered?.byId.get(node.id);
      const runtimeUrl = element?.dataset.uiRuntimeUrl || "";
      const key = element?.dataset.uiSpriteKey || data.spriteKey || "";
      const sprite = context.manifest.sprites.find(item => item.key === key);
      const text = node.text;
      const color = node.button ? `normal ${node.button.normal || ""} · pressed ${node.button.pressed || ""} · disabled ${node.button.disabled || ""}` : (data.color || "");
      const kind = ({ 0: "simple", 1: "sliced", 2: "tiled", 3: "fill", 5: "fit" })[data.fillType] || "";
      const border = sprite?.border ? `${sprite.border.left}/${sprite.border.right}/${sprite.border.top}/${sprite.border.bottom}` : "—";
      const shown = context.rendered?.byId.get(node.id)?.querySelector(":scope > .ui-text")?.textContent;
      const label = text ? `${text.key || "chuỗi thô"} · ${shown ?? uiTranslate(text.key || text.value)} · ${text.fontSize || "?"}px${text.outline ? " · outline" : ""}` : "";
      rows.push(`<tr data-resource-id="${esc(node.id)}" data-resource-path="${esc(node.path)}"><td>${esc(node.path)}</td><td>${runtimeUrl || sprite?.output ? `<img src="${esc(runtimeUrl || sprite.output)}" alt="">` : ""}${esc(runtimeUrl ? runtimeUrl.split("/").at(-1) : key.split("/").at(-1) || "—")}<small>${esc(runtimeUrl || key || "")}</small></td><td>${runtimeUrl ? "Runtime" : key ? (sprite?.missing || !sprite ? "Thiếu" : "Có file") : "—"}<small>${sprite ? `${sprite.width || "?"}×${sprite.height || "?"} · border ${border} · ${(sprite.origins || []).join(", ")}` : ""}</small></td><td>${node.alpha ?? 100}%<small>Web cộng dồn: ${Number((effectiveAlpha * 100).toFixed(4))}% · cascade game chưa xác minh</small></td><td>${esc(kind)}<small>${esc(color)}${data.centerInvisible ? " · center hidden" : ""}</small></td><td>${esc(label)}</td>${extraCells(node)}</tr>`);
    }
    node.children.forEach(child => walk(child, effectiveAlpha));
  }
  walk(context.screen.tree);
  return rows;
}

function uiStageScale(stage, canvas, context) {
  if (!stage || !canvas) return;
  const [ratioWidth, ratioHeight] = context.aspect.split(":").map(Number);
  const ratio = ratioWidth / ratioHeight;
  const frameWidth = stage.clientWidth;
  if (!frameWidth) return;
  stage.style.aspectRatio = `${ratioWidth} / ${ratioHeight}`;
  stage.style.height = `${frameWidth / ratio}px`;
  const frameHeight = stage.clientHeight;
  const scale = Math.max(frameWidth / context.width, frameHeight / context.height);
  canvas.style.left = `${(frameWidth - context.width * scale) / 2}px`;
  canvas.style.top = `${(frameHeight - context.height * scale) / 2}px`;
  canvas.style.transform = `scale(${scale})`;
}

function uiStageMount(stage, context, options = {}) {
  const rendered = uiRenderer.render(context.screen, context.manifest, context.width, context.height, options);
  stage.replaceChildren(rendered.canvas);
  uiStageScale(stage, rendered.canvas, context);
  return rendered;
}

function uiStageToolbar() {
  return '<div class="ui-preview-toolbar"><button id="ui-open-toggle" type="button">Đóng UI</button><label>Ngôn ngữ <select id="ui-language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label><label>Tỉ lệ khung <select id="ui-preview-aspect"><option value="16:9">16:9</option><option value="18:9" selected>18:9</option><option value="20:9">20:9</option><option value="4:3">4:3</option></select></label><label><input id="ui-debug" type="checkbox"> Debug entity</label><label><input id="ui-show-inactive" type="checkbox"> Hiện inactive</label><span id="ui-preview-meta">Đang tải…</span></div>';
}
