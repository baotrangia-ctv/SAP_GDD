Object.assign(pages, { shop: "Lịch shop" });

if (!s.shopView) s.shopView = "rotation";
if (s.shopWave === undefined) s.shopWave = "all";
if (s.shopSearch === undefined) s.shopSearch = "";
if (!s.shopOffset) s.shopOffset = 0;

let shopScheduleData = null;
let shopScheduleLoading = null;
const SHOP_PAGE_SIZE = 50;

function shopPage() {
  return head("SHOP SCHEDULE", "Lịch shop", "Tra lịch Rotation Shop, stock, giá cấu hình và các shop tĩnh từ CSV.", pill("CSV + code đã mirror", "mint")) +
    '<div id="shop-data"><div class="loading-state"><span class="loader"></span><span>Đang đọc lịch shop…</span></div></div>';
}

async function loadShopSchedule() {
  if (shopScheduleData) return shopScheduleData;
  if (!shopScheduleLoading) {
    shopScheduleLoading = fetch("./data/shop-schedule.json")
      .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .then(data => (shopScheduleData = data))
      .finally(() => { shopScheduleLoading = null; });
  }
  return shopScheduleLoading;
}

async function updateShopPage() {
  const target = document.getElementById("shop-data");
  if (!target) return;
  try {
    const data = await loadShopSchedule();
    if (s.page !== "shop" || !document.getElementById("shop-data")) return;
    renderShopContent(data);
  } catch (error) {
    target.innerHTML = note("Không đọc được dữ liệu shop", error.message + " · Chạy tools/sync-source-data.mjs rồi tải lại trang.", "shop-schedule.json");
  }
}

function shopContentTabs() {
  const tabs = [["rotation", "Rotation Shop"], ["standard", "Shop thường"], ["event", "Event shop"]];
  return '<div class="tabbar" role="tablist" aria-label="Nhóm shop">' + tabs.map(([id, label]) =>
    '<button class="tab' + (s.shopView === id ? " active" : "") + '" type="button" data-shop-view="' + id + '" role="tab" aria-selected="' + (s.shopView === id) + '">' + label + "</button>").join("") + "</div>";
}

function shopFilters(data) {
  const waveFilter = s.shopView === "rotation" ?
    '<label class="small-count" for="shop-wave">Wave</label><select id="shop-wave" class="field-select"><option value="all"' + (s.shopWave === "all" ? " selected" : "") + ">Tất cả wave</option>" +
      data.waves.map(wave => '<option value="' + esc(wave.id) + '"' + (s.shopWave === wave.id ? " selected" : "") + ">Wave " + esc(wave.id) + " · " + esc(wave.durationMinutes) + " phút</option>").join("") + "</select>" : "";
  return '<div class="filterbar">' + waveFilter + '<div class="search-wrap"><input id="shop-search" type="search" value="' + esc(s.shopSearch) + '" placeholder="Tìm ID, type, value…" aria-label="Tìm trong shop"></div><span id="shop-count" class="small-count"></span></div>';
}

function shopTable(data) {
  if (s.shopView === "rotation") {
    return '<div class="table-wrap data-table-view"><table><thead><tr><th>Wave</th><th>ID</th><th>Type</th><th>Value</th><th class="num">Stock</th><th class="num">Price</th><th class="num">DiscountPrice</th><th class="num">Wave coverage</th></tr></thead><tbody id="shop-rows"></tbody></table></div>';
  }
  const rows = s.shopView === "standard" ? data.shopItems : data.eventShopItems;
  const headers = s.shopView === "standard" ? data.shopItemsHeaders : data.eventShopItemsHeaders;
  return '<div class="table-wrap data-table-view"><table><thead><tr>' + headers.map(key => "<th>" + esc(key) + "</th>").join("") + '</tr></thead><tbody id="shop-rows">' +
    rows.map(row => "<tr>" + headers.map(key => '<td title="' + esc(row[key]) + '">' + esc(row[key]) + "</td>").join("") + "</tr>").join("") +
    '</tbody></table></div><div class="table-foot"><span>' + rows.length + " rows · raw CSV values</span><span>Không có quy đổi reward hoặc unit chưa xác nhận</span></div>";
}

function renderShopContent(data) {
  const target = document.getElementById("shop-data");
  if (!target) return;
  const f = s.data.codeFacts;
  const caveat = s.shopView === "rotation" ?
    note("Wave coverage, không phải xác suất", "Phần trăm là số wave trong chu kỳ có item. Mỗi wave lấy danh sách và Count cố định từ RotationShopWaves.csv. Rotation Shop không có trường Rebirth; nguồn chưa có dữ liệu để lọc theo Rebirth.", "RotationShopConfigs.fcg · RotationShopManager.fcg", "info") :
    note("Raw config", "Requirement, TimeLock và các ID được giữ nguyên theo CSV; trang chưa quy đổi chúng sang gate hoặc đơn vị khác khi code không xác nhận.", s.shopView === "standard" ? "shopItems.csv · ShopItemsConfigs.fcg" : "Event/shopEventItems.csv", "info");
  target.innerHTML = '<section class="kpi-grid">' +
    kpi("ROTATION ITEMS", data.itemConfigCount, "RotationShopItems.csv · raw rows") +
    kpi("WAVES", data.waveCount, "RotationShopWaves.csv") +
    kpi("SCHEDULE SLOTS", data.scheduledSlotCount, "Entries parsed from wave item lists") +
    kpi("CYCLE", f.rotationShopWaveDurationUsesMinutes ? data.totalCycleMinutes + " phút" : "unit chưa xác nhận", "Tổng Duration trong wave table") +
    '</section>' + shopContentTabs() + shopFilters(data) + shopTable(data) +
    (s.shopView === "rotation" ? '<div class="table-foot"><span id="shop-page"></span><span><button class="panel-link" data-shop-action="prev">← Trước</button> <button class="panel-link" data-shop-action="next">Tiếp →</button></span></div>' : "") +
    caveat;
  updateShopRows(data);
}

function filteredShopRows(data) {
  const query = s.shopSearch.trim().toLowerCase();
  return data.items.filter(row => (s.shopWave === "all" || row.waveId === s.shopWave) &&
    (!query || [row.waveId, row.itemId, row.type, row.value, row.stock, row.price, row.discountPrice].join(" ").toLowerCase().includes(query)));
}

function updateShopRows(data) {
  const body = document.getElementById("shop-rows");
  if (!body) return;
  if (s.shopView !== "rotation") {
    const rows = s.shopView === "standard" ? data.shopItems : data.eventShopItems;
    const query = s.shopSearch.trim().toLowerCase();
    const headers = s.shopView === "standard" ? data.shopItemsHeaders : data.eventShopItemsHeaders;
    const filtered = rows.filter(row => !query || headers.some(key => String(row[key] ?? "").toLowerCase().includes(query)));
    body.innerHTML = filtered.map(row => "<tr>" + headers.map(key => '<td title="' + esc(row[key]) + '">' + esc(row[key]) + "</td>").join("") + "</tr>").join("") || '<tr><td class="empty" colspan="' + Math.max(1, headers.length) + '">Không có dòng khớp.</td></tr>';
    const count = document.getElementById("shop-count"); if (count) count.textContent = filtered.length + " / " + rows.length + " dòng";
    return;
  }
  const rows = filteredShopRows(data);
  const end = Math.min(s.shopOffset + SHOP_PAGE_SIZE, rows.length);
  body.innerHTML = rows.slice(s.shopOffset, end).map(row => '<tr><td class="mono">Wave ' + esc(row.waveId) + ' · ' + esc(row.durationMinutes) + "m</td><td class=\"mono\">" + esc(row.itemId) + "</td><td>" + esc(row.type) + "</td><td>" + esc(row.value) + '</td><td class="num">' + esc(row.stock) + '</td><td class="num">' + esc(row.price) + '</td><td class="num">' + esc(row.discountPrice) + '</td><td class="num">' + esc(row.wavePresenceCount) + "/" + esc(row.waveCount) + " · " + (row.wavePresencePercent == null ? "—" : row.wavePresencePercent.toFixed(1) + "%") + "</td></tr>").join("") || '<tr><td class="empty" colspan="8">Không có dòng khớp.</td></tr>';
  const count = document.getElementById("shop-count"); if (count) count.textContent = Math.min(rows.length, SHOP_PAGE_SIZE) + " / " + rows.length + " dòng";
  const page = document.getElementById("shop-page"); if (page) page.textContent = "Rows " + (rows.length ? s.shopOffset + 1 : 0) + "–" + end + " / " + rows.length;
  const buttons = document.querySelectorAll("[data-shop-action]");
  buttons.forEach(button => { button.disabled = button.dataset.shopAction === "prev" ? s.shopOffset <= 0 : end >= rows.length; });
}

document.addEventListener("click", event => {
  const tab = event.target.closest("[data-shop-view]");
  if (tab) { s.shopView = tab.dataset.shopView; s.shopOffset = 0; renderShopContent(shopScheduleData); return; }
  const action = event.target.closest("[data-shop-action]");
  if (action) {
    s.shopOffset = action.dataset.shopAction === "prev" ? Math.max(0, s.shopOffset - SHOP_PAGE_SIZE) : s.shopOffset + SHOP_PAGE_SIZE;
    updateShopRows(shopScheduleData);
  }
});
document.addEventListener("input", event => {
  if (event.target.id === "shop-search") { s.shopSearch = event.target.value; s.shopOffset = 0; updateShopRows(shopScheduleData); }
});
document.addEventListener("change", event => {
  if (event.target.id === "shop-wave") { s.shopWave = event.target.value; s.shopOffset = 0; updateShopRows(shopScheduleData); }
});
