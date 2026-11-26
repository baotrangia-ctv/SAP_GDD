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
    '<section id="mail-composer" class="mail-composer" hidden></section>' +
    '<section id="ui-resource-panel" class="ui-resource-panel"><h2>Resource đang dùng</h2><label>Tìm entity/path <input id="ui-resource-search" type="search" placeholder="Tên hoặc đường dẫn"></label><div class="ui-resource-scroll"><table><thead><tr><th>Entity / path</th><th>Sprite</th><th>Trạng thái</th><th>Alpha .ui / web</th><th>Image / màu</th><th>Text / localization</th></tr></thead><tbody id="ui-resource-rows"></tbody></table></div></section></div>';
}

async function updateUiPreviewPage(selectedId = null) {
  const tabs = document.getElementById("ui-preview-tabs");
  if (!tabs) return;
  const composer = document.getElementById("mail-composer");
  composer.hidden = true; composer.replaceChildren(); composer.oninput = composer.onchange = composer.onclick = null;
  const loadToken = uiPreview.loadToken = (uiPreview.loadToken || 0) + 1;
  try {
    uiPreview.registry ||= await fetchUiResource("./data/ui/registry.json").then(checkUiJson);
    if (s.page !== "uipreview" || loadToken !== uiPreview.loadToken) return;
    const routeId = location.hash.match(/^#uipreview\/([^/]+)/)?.[1];
    let savedId; try { savedId = localStorage.getItem("uiPreviewScreen"); } catch {}
    const id = selectedId || routeId || savedId || "collection";
    const entry = uiPreview.registry.screens.find(item => item.id === id && item.status === "ready") || uiPreview.registry.screens.find(item => item.id === "collection");
    tabs.innerHTML = uiPreview.registry.screens.map(item => `<button type="button" data-ui-screen="${item.id}" ${item.status === "ready" ? "" : "disabled"} class="${item.id === entry.id ? "active" : ""}">${item.name}${item.status === "ready" ? "" : " · Sắp có"}</button>`).join("");
    const page = tabs.closest(".ui-preview-page");
    const lockBase = entry.id === "lock-base";
    const source = uiPreview.registry.screens.find(item => item.id === (entry.sourceScreen || entry.id));
    const [screen, manifest, rules, i18n] = await Promise.all([
      fetchUiResource(source.data).then(checkUiJson),
      fetchUiResource(`./data/ui/${source.id}-sprites.json`).then(checkUiJson),
      fetchUiResource(source.rules).then(checkUiJson),
      fetchUiResource(`./data/ui/${source.id}-i18n.json`).then(checkUiJson)
    ]);
    if (s.page !== "uipreview" || loadToken !== uiPreview.loadToken) return;
    uiPreview.controller?.dispose?.();
    page.classList.toggle("ui-preview-lock-base", lockBase);
    if (lockBase) prepareLockBaseScreen(screen);
    uiPreview.screen = screen;
    uiPreview.manifest = manifest;
    uiPreview.rules = rules;
    uiPreview.i18n = i18n;
    document.getElementById("ui-language").value = uiPreview.language;
    uiPreview.width = screen.referenceSize?.width || 1280;
    uiPreview.height = screen.referenceSize?.height || 720;
    try { localStorage.setItem("uiPreviewScreen", entry.id); } catch {}
    uiPreview.screenId = entry.id;
    setScreenBreadcrumb(entry.name);
    uiPreview.heightReferenceWidth = lockBase ? 800 : null;
    uiPreview.open = true;
    document.getElementById("ui-open-toggle").textContent = "Đóng UI";
    document.getElementById("ui-player-panel").replaceChildren();
    document.getElementById("ui-resource-rows").replaceChildren();
    const stage = document.getElementById("ui-preview-stage");
    const rendered = uiStageMount(stage, uiPreview);
    uiPreview.rendered = rendered;
    rendered.canvas.classList.toggle("ui-debug", !lockBase && document.getElementById("ui-debug").checked);
    rendered.canvas.classList.toggle("ui-show-inactive", !lockBase && document.getElementById("ui-show-inactive").checked);
    document.getElementById("ui-preview-aspect").value = uiPreview.aspect;
    document.getElementById("ui-preview-meta").textContent = `${screen.entityCount} entity · ${manifest.missing.length} sprite thiếu · root ${uiPreview.width}×${uiPreview.height} từ .ui · khung ${uiPreview.aspect}; scaler và safe area chưa xác minh`;
    scaleUiPreview();
    uiPreview.controller = lockBase ? initLockBasePreview(screen, rules, rendered) : entry.id === "storage" ? initStoragePreview(screen, rules, rendered) : entry.id === "permanent-event" ? initPermanentPreview(screen, rules, rendered) : entry.id === "leaderboard" ? initLeaderboardPreview(screen, rules, rendered) : entry.id === "fusion-confirm" ? initFusionConfirmPreview(screen, rules, rendered) : entry.id === "fusion-result" ? initFusionResultPreview(screen, rules, rendered) : entry.id === "lobby" ? initLobbyPreview(screen, rules, rendered) : entry.id === "rebirth" ? initRebirthPreview(screen, rules, rendered) : entry.id === "shop-event" ? initShopEventPreview(screen, rules, rendered) : entry.id === "mail" ? initMailPreview(screen, rules, rendered) : entry.id === "shop" ? initShopPreview(screen, rules, rendered) : entry.id === "activities" ? initActivitiesPreview(screen, rules, rendered) : initCollectionPreview(screen, rules, rendered);
    renderUiResourcePanel();
    const audit = auditUiPreviewDom(screen.tree, rendered.canvas);
    document.getElementById("ui-preview-meta").dataset.uiAudit = JSON.stringify(audit);
    document.getElementById("ui-preview-meta").textContent += ` · DOM ${audit.actual}/${audit.expected}, lệch ${audit.mismatches}`;
    if (entry.id === "mail") initMailComposer(uiPreview.controller, loadToken);
  } catch (error) {
    if (loadToken !== uiPreview.loadToken || s.page !== "uipreview") return;
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
  const screenButton = event.target.closest("[data-ui-screen]");
  if (screenButton && !screenButton.disabled) {
    history.replaceState(null, "", `#uipreview/${screenButton.dataset.uiScreen}`);
    updateUiPreviewPage(screenButton.dataset.uiScreen);
    return;
  }
  if (event.target.id === "ui-open-toggle") {
    uiPreview.open = !uiPreview.open;
    uiPreview.rendered.canvas.classList.toggle("ui-closed", !uiPreview.open);
    event.target.textContent = uiPreview.open ? "Đóng UI" : "Mở UI";
  }
});
window.addEventListener("hashchange", () => {
  if (s.page === "uipreview" && location.hash.startsWith("#uipreview/") && location.hash.split("/")[1] !== uiPreview.screenId) updateUiPreviewPage();
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
