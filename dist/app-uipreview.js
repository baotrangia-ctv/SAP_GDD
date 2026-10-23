"use strict";

Object.assign(pages, { uipreview: "UI Preview" });

const uiPreview = { registry: null, screen: null, manifest: null, i18n: null, language: "vi", rendered: null, width: 1280, height: 720, open: true };
function uiTranslate(key, args = []) {
  const entry = uiPreview.i18n?.entries?.[key];
  const pattern = (entry && (entry[uiPreview.language] || entry.en)) || key;
  return String(pattern).replace(/\{(\d+)\}/g, (match, index) => args[Number(index)] ?? match);
}

function uiPreviewPage() {
  return '<div class="ui-preview-page"><div class="section-heading"><div><p class="eyebrow">UI GAME</p><h1>UI Preview</h1><p>HUD dựng từ cây entity của game. Dữ liệu người chơi trong trang này là mô phỏng.</p></div></div>' +
    '<div id="ui-preview-tabs" class="ui-preview-tabs"></div>' +
    '<div class="ui-preview-toolbar"><button id="ui-open-toggle" type="button">Đóng UI</button><label>Ngôn ngữ <select id="ui-language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label><label><input id="ui-debug" type="checkbox"> Debug entity</label><label><input id="ui-show-inactive" type="checkbox"> Hiện inactive</label><span id="ui-preview-meta">Đang tải…</span></div>' +
    '<div id="ui-preview-workspace" class="ui-preview-workspace"><div id="ui-preview-stage" class="ui-preview-stage"></div><aside id="ui-player-panel" class="ui-player-panel"></aside></div>' +
    '<section id="ui-resource-panel" class="ui-resource-panel"><h2>Resource đang dùng</h2><label>Tìm entity/path <input id="ui-resource-search" type="search" placeholder="Tên hoặc đường dẫn"></label><div class="ui-resource-scroll"><table><thead><tr><th>Entity / path</th><th>Sprite</th><th>Trạng thái</th><th>Image / màu</th><th>Text / localization</th></tr></thead><tbody id="ui-resource-rows"></tbody></table></div></section></div>';
}

async function updateUiPreviewPage() {
  const tabs = document.getElementById("ui-preview-tabs");
  if (!tabs) return;
  try {
    uiPreview.registry ||= await fetch("./data/ui/registry.json").then(checkUiJson);
    tabs.innerHTML = uiPreview.registry.screens.map(item => `<button type="button" data-ui-screen="${item.id}" ${item.status === "ready" ? "" : "disabled"} class="${item.id === "collection" ? "active" : ""}">${item.name}${item.status === "ready" ? "" : " · Sắp có"}</button>`).join("");
    const entry = uiPreview.registry.screens.find(item => item.id === "collection");
    if (!entry) throw new Error("Collection chưa có trong registry");
    const [screen, manifest, rules, i18n] = await Promise.all([
      fetch(entry.data).then(checkUiJson),
      fetch("./data/ui/collection-sprites.json").then(checkUiJson),
      fetch(entry.rules).then(checkUiJson),
      fetch("./data/ui/collection-i18n.json").then(checkUiJson)
    ]);
    if (s.page !== "uipreview") return;
    uiPreview.screen = screen;
    uiPreview.manifest = manifest;
    uiPreview.rules = rules;
    uiPreview.i18n = i18n;
    document.getElementById("ui-language").value = uiPreview.language;
    uiPreview.width = screen.referenceSize?.width || 1280;
    uiPreview.height = screen.referenceSize?.height || 720;
    try { localStorage.setItem("uiPreviewScreen", "collection"); } catch {}
    if (location.hash !== "#uipreview/collection") history.replaceState(null, "", "#uipreview/collection");
    const rendered = uiRenderer.render(screen, manifest, uiPreview.width, uiPreview.height);
    uiPreview.rendered = rendered;
    const stage = document.getElementById("ui-preview-stage");
    stage.replaceChildren(rendered.canvas);
    document.getElementById("ui-preview-meta").textContent = `${screen.entityCount} entity · ${manifest.missing.length} sprite thiếu · khung ${uiPreview.width}×${uiPreview.height} suy từ root (.ui); độ phân giải engine chưa xác minh`;
    scaleUiPreview();
    if (typeof initCollectionPreview === "function") initCollectionPreview(screen, rules, rendered);
    renderUiResourcePanel();
    const audit = auditUiPreviewDom(screen.tree, rendered.canvas);
    document.getElementById("ui-preview-meta").dataset.uiAudit = JSON.stringify(audit);
    document.getElementById("ui-preview-meta").textContent += ` · DOM ${audit.actual}/${audit.expected}, lệch ${audit.mismatches}`;
  } catch (error) {
    document.getElementById("ui-preview-stage").textContent = "Không tải được UI Preview: " + error.message;
  }
}
function renderUiResourcePanel() {
  const tbody = document.getElementById("ui-resource-rows");
  if (!tbody || !uiPreview.screen) return;
  const rows = [];
  function walk(node) {
    if (node.image || node.button || node.text) {
      const data = node.image || node.button || {};
      const key = uiPreview.rendered?.byId.get(node.id)?.dataset.uiSpriteKey || data.spriteKey || "";
      const sprite = uiPreview.manifest.sprites.find(item => item.key === key);
      const text = node.text;
      const color = node.button ? `normal ${node.button.normal || ""} · hover ${node.button.highlight || ""} · pressed ${node.button.pressed || ""} · disabled ${node.button.disabled || ""}` : (data.color || "");
      const kind = ({ 0: "simple", 1: "sliced", 2: "tiled", 3: "fill", 5: "fit" })[data.fillType] || "";
      const border = sprite?.border ? `${sprite.border.left}/${sprite.border.right}/${sprite.border.top}/${sprite.border.bottom}` : "—";
      const shown = uiPreview.rendered?.byId.get(node.id)?.querySelector(":scope > .ui-text")?.textContent;
      const label = text ? `${text.key || "chuỗi thô"} · ${shown ?? uiTranslate(text.key || text.value)} · ${text.fontSize || "?"}px${text.outline ? " · outline" : ""}` : "";
      rows.push(`<tr data-resource-path="${esc(node.path)}"><td>${esc(node.path)}</td><td>${sprite?.output ? `<img src="${esc(sprite.output)}" alt="">` : ""}${esc(key.split("/").at(-1) || "—")}<small>${esc(key || "")}</small></td><td>${key ? (sprite?.missing || !sprite ? "Thiếu" : "Có file") : "—"}<small>${sprite ? `${sprite.width || "?"}×${sprite.height || "?"} · border ${border} · ${(sprite.origins || []).join(", ")}` : ""}</small></td><td>${esc(kind)}<small>${esc(color)}${data.centerInvisible ? " · center hidden" : ""}</small></td><td>${esc(label)}</td></tr>`);
    }
    node.children.forEach(walk);
  }
  walk(uiPreview.screen.tree);
  tbody.innerHTML = rows.join("");
}

function auditUiPreviewDom(tree, canvas) {
  const source = [];
  function collect(node) { source.push(`${node.id}\t${node.path}\t${node.type}`); node.children.forEach(collect); }
  collect(tree);
  const dom = [...canvas.querySelectorAll("[data-ui-path]")].map(el => `${el.dataset.uiId}\t${el.dataset.uiPath}\t${el.dataset.uiType}`);
  const sourceSet = new Set(source), domSet = new Set(dom);
  return { expected: source.length, actual: dom.length, mismatches: source.filter(x => !domSet.has(x)).length + dom.filter(x => !sourceSet.has(x)).length };
}

function checkUiJson(response) {
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

function scaleUiPreview() {
  const stage = document.getElementById("ui-preview-stage");
  const canvas = uiPreview.rendered?.canvas;
  if (!stage || !canvas) return;
  const scale = Math.min(1, stage.clientWidth / uiPreview.width);
  canvas.style.transform = `scale(${scale})`;
  stage.style.height = `${Math.ceil(uiPreview.height * scale)}px`;
}

window.addEventListener("resize", scaleUiPreview);
document.addEventListener("click", event => {
  if (s.page !== "uipreview") return;
  const resource = event.target.closest("[data-resource-path]");
  if (resource) { focusUiResource(resource.dataset.resourcePath, false); return; }
  const entity = event.target.closest("#ui-preview-stage [data-ui-path]");
  if (entity) focusUiResource(entity.dataset.uiPath, true);
  if (event.target.id === "ui-open-toggle") {
    uiPreview.open = !uiPreview.open;
    uiPreview.rendered.canvas.classList.toggle("ui-closed", !uiPreview.open);
    event.target.textContent = uiPreview.open ? "Đóng UI" : "Mở UI";
  }
});
function focusUiResource(path, scrollRow) {
  document.querySelectorAll(".ui-resource-selected").forEach(el => el.classList.remove("ui-resource-selected"));
  const row = [...document.querySelectorAll("[data-resource-path]")].find(el => el.dataset.resourcePath === path);
  const entity = [...document.querySelectorAll("#ui-preview-stage [data-ui-path]")].find(el => el.dataset.uiPath === path);
  row?.classList.add("ui-resource-selected"); entity?.classList.add("ui-resource-selected");
  (scrollRow ? row : entity)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
document.addEventListener("change", event => {
  if (s.page !== "uipreview" || !uiPreview.rendered) return;
  if (event.target.id === "ui-language") { uiPreview.language = event.target.value; updateUiPreviewPage(); return; }
  if (event.target.id === "ui-debug") uiPreview.rendered.canvas.classList.toggle("ui-debug", event.target.checked);
  if (event.target.id === "ui-show-inactive") uiPreview.rendered.canvas.classList.toggle("ui-show-inactive", event.target.checked);
});
document.addEventListener("input", event => {
  if (event.target.id !== "ui-resource-search") return;
  const query = event.target.value.toLocaleLowerCase();
  document.querySelectorAll("[data-resource-path]").forEach(row => row.hidden = !row.dataset.resourcePath.toLocaleLowerCase().includes(query));
});
