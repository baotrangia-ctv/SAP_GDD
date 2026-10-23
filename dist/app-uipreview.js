"use strict";

Object.assign(pages, { uipreview: "UI Preview" });

const uiPreview = { registry: null, screen: null, manifest: null, rendered: null, width: 1280, height: 720, open: true };

function uiPreviewPage() {
  return '<div class="ui-preview-page"><div class="section-heading"><div><p class="eyebrow">UI GAME</p><h1>UI Preview</h1><p>HUD dựng từ cây entity của game. Dữ liệu người chơi trong trang này là mô phỏng.</p></div></div>' +
    '<div id="ui-preview-tabs" class="ui-preview-tabs"></div>' +
    '<div class="ui-preview-toolbar"><button id="ui-open-toggle" type="button">Đóng UI</button><label><input id="ui-debug" type="checkbox"> Debug entity</label><label><input id="ui-show-inactive" type="checkbox"> Hiện inactive</label><span id="ui-preview-meta">Đang tải…</span></div>' +
    '<div id="ui-preview-workspace" class="ui-preview-workspace"><div id="ui-preview-stage" class="ui-preview-stage"></div><aside id="ui-player-panel" class="ui-player-panel"></aside></div></div>';
}

async function updateUiPreviewPage() {
  const tabs = document.getElementById("ui-preview-tabs");
  if (!tabs) return;
  try {
    uiPreview.registry ||= await fetch("./data/ui/registry.json").then(checkUiJson);
    tabs.innerHTML = uiPreview.registry.screens.map(item => `<button type="button" data-ui-screen="${item.id}" ${item.status === "ready" ? "" : "disabled"} class="${item.id === "collection" ? "active" : ""}">${item.name}${item.status === "ready" ? "" : " · Sắp có"}</button>`).join("");
    const entry = uiPreview.registry.screens.find(item => item.id === "collection");
    if (!entry) throw new Error("Collection chưa có trong registry");
    const [screen, manifest, rules] = await Promise.all([
      fetch(entry.data).then(checkUiJson),
      fetch("./data/ui/collection-sprites.json").then(checkUiJson),
      fetch(entry.rules).then(checkUiJson)
    ]);
    if (s.page !== "uipreview") return;
    uiPreview.screen = screen;
    uiPreview.manifest = manifest;
    uiPreview.rules = rules;
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
  } catch (error) {
    document.getElementById("ui-preview-stage").textContent = "Không tải được UI Preview: " + error.message;
  }
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
  stage.style.minHeight = `${Math.ceil(uiPreview.height * scale)}px`;
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
  if (event.target.id === "ui-debug") uiPreview.rendered.canvas.classList.toggle("ui-debug", event.target.checked);
  if (event.target.id === "ui-show-inactive") uiPreview.rendered.canvas.classList.toggle("ui-show-inactive", event.target.checked);
});
