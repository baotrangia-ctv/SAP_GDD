"use strict";

Object.assign(pages, { uipreview: "UI Preview" });

const uiPreview = { registry: null, screen: null, manifest: null, i18n: null, language: "vi", rendered: null, width: 1280, height: 720, aspect: "18:9", open: true };
function uiTranslate(key, args = []) {
  const entry = uiPreview.i18n?.entries?.[key];
  const pattern = (entry && (entry[uiPreview.language] || entry.en)) || key;
  return String(pattern).replace(/\{(\d+)\}/g, (match, index) => args[Number(index)] ?? match);
}

function uiPreviewPage() {
  return '<div class="ui-preview-page"><div class="section-heading"><div><p class="eyebrow">UI GAME</p><h1>UI Preview</h1><p>HUD dựng từ cây entity của game. Dữ liệu người chơi trong trang này là mô phỏng.</p></div></div>' +
    '<div id="ui-preview-tabs" class="ui-preview-tabs"></div>' +
    uiStageToolbar() +
    '<div id="ui-preview-workspace" class="ui-preview-workspace"><div id="ui-preview-stage" class="ui-preview-stage"></div><aside id="ui-player-panel" class="ui-player-panel"></aside></div>' +
    '<section id="ui-resource-panel" class="ui-resource-panel"><h2>Resource đang dùng</h2><label>Tìm entity/path <input id="ui-resource-search" type="search" placeholder="Tên hoặc đường dẫn"></label><div class="ui-resource-scroll"><table><thead><tr><th>Entity / path</th><th>Sprite</th><th>Trạng thái</th><th>Alpha .ui / web</th><th>Image / màu</th><th>Text / localization</th></tr></thead><tbody id="ui-resource-rows"></tbody></table></div></section></div>';
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
    const stage = document.getElementById("ui-preview-stage");
    const rendered = uiStageMount(stage, uiPreview);
    uiPreview.rendered = rendered;
    document.getElementById("ui-preview-aspect").value = uiPreview.aspect;
    document.getElementById("ui-preview-meta").textContent = `${screen.entityCount} entity · ${manifest.missing.length} sprite thiếu · root ${uiPreview.width}×${uiPreview.height} từ .ui · khung ${uiPreview.aspect}; scaler và safe area chưa xác minh`;
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
  const rows = uiResourceRows(uiPreview);
  // Keep row nodes and scroll geometry stable during gameplay updates.
  const filter = document.getElementById("ui-resource-search")?.value.toLocaleLowerCase() || "";
  const existing = new Map([...tbody.rows].map(row => [row.dataset.resourceId, row]));
  const template = document.createElement("template");
  for (const html of rows) {
    template.innerHTML = html;
    const next = template.content.firstElementChild;
    const current = existing.get(next.dataset.resourceId);
    next.hidden = !next.dataset.resourcePath.toLocaleLowerCase().includes(filter);
    if (!current) tbody.appendChild(next);
    else {
      [...next.cells].forEach((cell, index) => {
        if (current.cells[index].innerHTML !== cell.innerHTML) current.cells[index].innerHTML = cell.innerHTML;
      });
      current.hidden = next.hidden;
    }
  }
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
  uiStageScale(stage, canvas, uiPreview);
}

window.addEventListener("resize", scaleUiPreview);
document.addEventListener("click", event => {
  if (s.page !== "uipreview") return;
  if (event.target.id === "ui-open-toggle") {
    uiPreview.open = !uiPreview.open;
    uiPreview.rendered.canvas.classList.toggle("ui-closed", !uiPreview.open);
    event.target.textContent = uiPreview.open ? "Đóng UI" : "Mở UI";
  }
});
document.addEventListener("change", event => {
  if (s.page !== "uipreview" || !uiPreview.rendered) return;
  if (event.target.id === "ui-language") { uiPreview.language = event.target.value; updateUiPreviewPage(); return; }
  if (event.target.id === "ui-preview-aspect") { uiPreview.aspect = event.target.value; scaleUiPreview(); document.getElementById("ui-preview-meta").textContent = `${uiPreview.screen.entityCount} entity · ${uiPreview.manifest.missing.length} sprite thiếu · root ${uiPreview.width}×${uiPreview.height} từ .ui · khung ${uiPreview.aspect}; scaler và safe area chưa xác minh`; }
  if (event.target.id === "ui-debug") uiPreview.rendered.canvas.classList.toggle("ui-debug", event.target.checked);
  if (event.target.id === "ui-show-inactive") uiPreview.rendered.canvas.classList.toggle("ui-show-inactive", event.target.checked);
});
document.addEventListener("input", event => {
  if (event.target.id !== "ui-resource-search") return;
  const query = event.target.value.toLocaleLowerCase();
  document.querySelectorAll("[data-resource-path]").forEach(row => row.hidden = !row.dataset.resourcePath.toLocaleLowerCase().includes(query));
});
