"use strict";

Object.assign(pages, { shop: "Lịch shop" });

if (!s.shopView) s.shopView = "rotation";
if (s.shopWave === undefined) s.shopWave = "all";
if (s.shopSearch === undefined) s.shopSearch = "";
if (s.shopEventType === undefined) s.shopEventType = "all";
if (!s.shopOffset) s.shopOffset = 0;

let shopScheduleData = null;
let shopScheduleLoading = null;
const SHOP_PAGE_SIZE = 50;

function shopPage() {
  return head("SHOP SCHEDULE", "Lịch shop", "Tra lịch Rotation Shop và xem event shop theo loại event, quà và ngày mở item.", pill("CSV + code đã mirror", "mint")) +
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
    await loadRewardDisplayData();
    if (s.page !== "shop" || !document.getElementById("shop-data")) return;
    renderShopContent(data);
  } catch (error) {
    target.innerHTML = note("Không đọc được dữ liệu shop", error.message + " · Chạy tools/sync-source-data.mjs rồi tải lại trang.", "shop-schedule.json · gift-rewards.json");
  }
}

function shopContentTabs() {
  const tabs = [["rotation", "Rotation Shop"], ["standard", "Shop thường"], ["event", "Event shop"]];
  return '<div class="tabbar" role="tablist" aria-label="Nhóm shop">' + tabs.map(([id, label]) =>
    '<button class="tab' + (s.shopView === id ? " active" : "") + '" type="button" data-shop-view="' + id + '" role="tab" aria-selected="' + (s.shopView === id) + '">' + label + "</button>").join("") + "</div>";
}

function shopEventTypeOptions(data) {
  const schedules = data.eventSchedule || [];
  const shopsByType = new Map();
  for (const row of schedules) {
    if (!row.EventType) continue;
    if (!shopsByType.has(String(row.EventType))) shopsByType.set(String(row.EventType), new Set());
    shopsByType.get(String(row.EventType)).add(String(row.ShopId || "—"));
  }
  const itemShopIds = new Set((data.eventShopItems || []).map(row => String(row.ShopId || "")));
  const scheduledShopIds = new Set(schedules.map(row => String(row.ShopId || "")));
  if ([...itemShopIds].some(shopId => shopId && !scheduledShopIds.has(shopId))) shopsByType.set("unknown", new Set([...itemShopIds].filter(shopId => shopId && !scheduledShopIds.has(shopId))));
  return [...shopsByType.entries()].map(([type, shops]) => [type, type === "unknown" ? "Chưa có event schedule · Shop " + [...shops].join(", ") : "Event type " + type + " · Shop " + [...shops].join(", ")]);
}

function shopFilters(data) {
  const waveFilter = s.shopView === "rotation" ?
    '<label class="small-count" for="shop-wave">Wave</label><select id="shop-wave" class="field-select"><option value="all"' + (s.shopWave === "all" ? " selected" : "") + ">Tất cả wave</option>" +
      data.waves.map(wave => '<option value="' + esc(wave.id) + '"' + (s.shopWave === wave.id ? " selected" : "") + ">Wave " + esc(wave.id) + " · " + esc(wave.durationMinutes) + " phút</option>").join("") + "</select>" : "";
  const eventFilter = s.shopView === "event" ? '<label class="small-count" for="shop-event-type">Loại event</label><select id="shop-event-type" class="field-select"><option value="all"' + (s.shopEventType === "all" ? " selected" : "") + ">Tất cả event</option>" +
    shopEventTypeOptions(data).map(([value, label]) => '<option value="' + esc(value) + '"' + (s.shopEventType === value ? " selected" : "") + ">" + esc(label) + "</option>").join("") + "</select>" : "";
  return '<div class="filterbar">' + waveFilter + eventFilter + '<div class="search-wrap"><input id="shop-search" type="search" value="' + esc(s.shopSearch) + '" placeholder="Tìm ID, type, item, quà…" aria-label="Tìm trong shop"></div><span id="shop-count" class="small-count"></span></div>';
}

function shopTable(data) {
  if (s.shopView === "rotation") {
    return '<div class="table-wrap data-table-view"><table><thead><tr><th>Wave</th><th>ID</th><th>Type</th><th>Value</th><th class="num">Stock</th><th class="num">Price</th><th class="num">DiscountPrice</th><th class="num">Wave coverage</th></tr></thead><tbody id="shop-rows"></tbody></table></div>';
  }
  if (s.shopView === "event") return '<div id="shop-release-timeline"></div><div id="shop-event-items" class="event-shop-grid"></div>';
  const rows = data.shopItems || [];
  const headers = data.shopItemsHeaders || [];
  return '<div class="table-wrap data-table-view"><table><thead><tr>' + headers.map(key => "<th>" + esc(key) + "</th>").join("") + '</tr></thead><tbody id="shop-rows"></tbody></table></div><div class="table-foot"><span>' + rows.length + " rows · raw CSV values</span><span>Requirement/TimeLock chưa được đổi đơn vị</span></div>";
}

function eventTypeForShop(data, shopId) {
  return (data.eventSchedule || []).find(row => String(row.ShopId) === String(shopId));
}

function eventShopRows(data) {
  const query = s.shopSearch.trim().toLowerCase();
  return (data.eventShopItems || []).filter(row => {
    const schedule = eventTypeForShop(data, row.ShopId);
    const eventType = schedule ? String(schedule.EventType) : "unknown";
    if (s.shopEventType !== "all" && eventType !== s.shopEventType) return false;
    const searchable = [row.ID, row.Name, row.NameLocalize, row.IconResource, row.Description, row.IDGift, row.ShopId, row.Cost, row.Limit].join(" ").toLowerCase();
    return !query || searchable.includes(query);
  });
}

function eventReleaseDay(item, schedule, timeIsTimestamp) {
  if (!schedule || !timeIsTimestamp) return null;
  const start = Number(schedule.Start), available = Number(item.TimeAvailable);
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(available)) return null;
  if (available <= 0 || available <= start) return 1;
  return Math.floor((available - start) / 86400) + 1;
}

function eventReleaseLabel(item, schedule, data) {
  const day = eventReleaseDay(item, schedule, data.eventShopFacts?.timeAvailableIsTimestamp);
  if (day === 1 && Number(item.TimeAvailable) <= Number(schedule?.Start)) return "Ngày 1 · mở từ đầu shop";
  if (day) return "Ngày " + day + " · mở item";
  if (!item.TimeAvailable || Number(item.TimeAvailable) <= 0) return "Mở từ đầu shop";
  const timestamp = Number(item.TimeAvailable);
  if (data.eventShopFacts?.timeAvailableIsTimestamp && timestamp > 0) return "Mở lúc " + new Date(timestamp * 1000).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return "Mốc mở " + item.TimeAvailable + " · raw";
}

function eventReleaseTimeline(data, rows) {
  const timeIsTimestamp = !!data.eventShopFacts?.timeAvailableIsTimestamp;
  const shops = new Map();
  for (const row of rows) {
    const shopId = String(row.ShopId || "—");
    if (!shops.has(shopId)) shops.set(shopId, { schedule: eventTypeForShop(data, shopId), rows: [] });
    shops.get(shopId).rows.push(row);
  }
  return [...shops.entries()].map(([shopId, shop]) => {
    const grouped = new Map();
    for (const row of shop.rows) {
      const day = eventReleaseDay(row, shop.schedule, timeIsTimestamp);
      const label = day ? "Ngày " + day : "Chưa chia ngày";
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(row);
    }
    const schedule = shop.schedule;
    const startDate = Number(schedule?.Start) > 0 ? new Date(Number(schedule.Start) * 1000).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "chưa có ngày bắt đầu";
    const days = [...grouped.entries()].sort((a, b) => {
      const aDay = Number(a[0].replace("Ngày ", "")), bDay = Number(b[0].replace("Ngày ", ""));
      return (Number.isFinite(aDay) ? aDay : 99999) - (Number.isFinite(bDay) ? bDay : 99999);
    });
    return '<section class="event-release-visual"><div class="event-release-head"><div><h2>Ngày mở item · Shop ' + esc(shopId) + '</h2><p>' + (schedule ? 'Event bắt đầu: ' + esc(startDate) : 'Chưa có event schedule') + (timeIsTimestamp ? ' · TimeAvailable là timestamp' : ' · unit TimeAvailable chưa xác nhận') + '</p></div>' + (schedule ? '<span class="event-type-badge">Event ' + esc(schedule.EventType) + ' · Shop ' + esc(schedule.ShopId) + '</span>' : '') + '</div><div class="event-release-days">' + (days.map(([label, entries]) => '<div class="event-release-day"><span>' + esc(label) + '</span><strong>' + entries.length + ' item' + (entries.length === 1 ? "" : "s") + '</strong><div class="event-release-dots">' + entries.slice(0, 14).map((item, index) => '<i style="--release-color:' + (index % 3 === 0 ? "#82e0ba" : index % 3 === 1 ? "#73d2e8" : "#b49cff") + '" title="' + esc(item.NameLocalize || item.Name) + '"></i>').join("") + '</div></div>').join("") || '<div class="empty">Không có item cho event này.</div>') + '</div></section>';
  }).join("") || '<section class="event-release-visual"><div class="empty">Không có item cho event này.</div></section>';
}

function eventShopItemArt(item) {
  const rewards = giftRewardRows(item.IDGift).filter(row => !row.missing);
  if (rewards.length) return rewardVisual(rewards[0]);
  if (String(item.Name).toLowerCase() === "randompet") return '<span class="reward-art-mark">🐾</span>';
  if (String(item.Name).toLowerCase() === "randomitem") return '<span class="reward-art-mark">🎁</span>';
  const resource = String(item.IconResource || item.NameLocalize || "");
  const pet = t("Pet.csv").rows.find(row => row.Name === resource || row.Name === item.NameLocalize);
  if (pet) return petImageHtml(pet, "event-shop-art-pet");
  return '<span class="reward-art-mark">🎁</span>';
}

function eventShopItemTitle(item) {
  const itemType = String(item.Name || "").toLowerCase();
  if (itemType === "randompet") return "Pet ngẫu nhiên";
  if (itemType === "randomitem") return "Vật phẩm ngẫu nhiên";
  const first = giftRewardRows(item.IDGift).find(row => !row.missing);
  if (first && String(first.TypeReward) === "1") {
    const pet = t("Pet.csv").rows.find(row => String(row.ID) === String(first.Value).split(";")[0]);
    if (pet) return pet.Name;
  }
  return pretty(item.NameLocalize || item.Name || ("Item " + item.ID));
}

function eventShopItemTypeLabel(type) {
  const labels = { SpecialPet: "Pet đặc biệt", RandomPet: "Pet ngẫu nhiên", RandomItem: "Vật phẩm ngẫu nhiên" };
  return labels[String(type)] || pretty(type || "Event item");
}

function eventRandomPoolEntries(item, data) {
  const itemType = String(item.Name || "").toLowerCase();
  if (itemType === "randomitem") {
    const rows = t("PoolRandomItem.csv").rows || [];
    const totalWeight = rows.reduce((sum, row) => sum + (Number(row.Weight) || 0), 0);
    return {
      label: "Random item pool",
      verified: !!data.eventShopFacts?.randomItemPoolUsesWeightedDraw,
      entries: rows.map(row => ({ id: row.ID, giftId: row.GiftID, weight: row.Weight, totalWeight, detail: "Type " + row.Type + " · " + (row.Value || "") }))
    };
  }
  if (itemType === "randompet") {
    const poolId = data.eventShopFacts?.randomPetPoolId;
    const pool = (t("poolRewardSecret.csv").rows || []).find(row => String(row.ID) === String(poolId));
    if (!pool) return null;
    const petIds = String(pool.Pool || "").split(";").filter(Boolean);
    const weights = String(pool.Weight || "").split(";");
    const gifts = String(pool.IDGift || "").split(";");
    const totalWeight = weights.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const aligned = petIds.length === weights.length && petIds.length === gifts.length;
    return {
      label: "Random pet pool · Pool " + poolId,
      verified: !!data.eventShopFacts?.randomPetPoolUsesWeightedDraw && aligned,
      entries: petIds.map((petId, index) => {
        const pet = t("Pet.csv").rows.find(row => String(row.ID) === petId);
        return { id: petId, pet, giftId: gifts[index], weight: weights[index], totalWeight, detail: "Pet " + (pet?.Name || ("#" + petId)) };
      })
    };
  }
  return null;
}

function eventPoolEntryHtml(entry, pool) {
  const weight = Number(entry.weight) || 0;
  const percent = pool.verified && entry.totalWeight > 0 ? weight / entry.totalWeight * 100 : null;
  const digits = percent === null ? 0 : percent >= 1 ? 1 : percent >= 0.1 ? 2 : percent >= 0.01 ? 3 : percent >= 0.001 ? 4 : 6;
  const chance = percent === null ? "Weight " + esc(entry.weight || "—") : Number(percent.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits }) + "%";
  const rewardArt = entry.pet ? petImageHtml(entry.pet, "event-pool-pet-art") : (() => {
    const reward = giftRewardRows(entry.giftId).find(row => !row.missing);
    return reward ? rewardVisual(reward) : '<span class="reward-art-mark">🎁</span>';
  })();
  const rewardMap = String(entry.giftId || "").trim() ? giftRewardsHtml(entry.giftId) : '<div class="gift-unresolved">Chưa có Gift ID.</div>';
  return '<article class="event-pool-entry"><div class="event-pool-outcome"><div class="event-pool-art">' + rewardArt + '</div><div><strong>' + chance + '</strong><small>' + esc(entry.detail || ("Pool item #" + entry.id)) + '</small><small>Weight ' + esc(entry.weight || "—") + '</small></div></div>' + rewardMap + '</article>';
}

function eventRandomPoolHtml(item, data) {
  const pool = eventRandomPoolEntries(item, data);
  if (!pool) return null;
  return '<details class="event-pool-details"><summary>' + esc(pool.label) + ' · ' + pool.entries.length + ' kết quả' + (pool.verified ? ' · tỉ lệ từ Weight' : ' · chỉ hiện Weight cấu hình') + '</summary><div class="event-pool-list">' + pool.entries.map(entry => eventPoolEntryHtml(entry, pool)).join("") + '</div></details>';
}

function eventShopCard(item, data) {
  const schedule = eventTypeForShop(data, item.ShopId);
  const release = eventReleaseLabel(item, schedule, data);
  const limit = String(item.Limit ?? "").trim();
  const name = eventShopItemTitle(item);
  const rewardMapping = String(item.IDGift || "").trim() ? giftRewardsHtml(item.IDGift) : (eventRandomPoolHtml(item, data) || '<div class="event-no-gift">Item này không có Gift ID trực tiếp; reward pool được runtime chọn khi mua.</div>');
  return '<article class="event-shop-card"><div class="event-shop-card-head"><div class="event-shop-art">' + eventShopItemArt(item) + '</div><div class="event-shop-name"><span class="event-type-badge">' + esc(eventShopItemTypeLabel(item.Name)) + '</span><h3>' + esc(name) + '</h3><small>Item #' + esc(item.ID) + ' · Shop ' + esc(item.ShopId || "—") + '</small></div><strong class="event-shop-cost">' + esc(item.Cost || "—") + '<small>cost</small></strong></div><div class="event-release-tag">◷ ' + esc(release) + '</div>' + rewardMapping + '<div class="event-shop-meta">' + (limit ? '<span>Limit: ' + esc(limit) + '</span>' : '<span>Limit không cấu hình</span>') + '<span>TimeLock: ' + esc(item.TimeLock || "—") + ' · raw</span></div></article>';
}

function renderShopContent(data) {
  const target = document.getElementById("shop-data");
  if (!target) return;
  const f = s.data.codeFacts;
  const caveat = s.shopView === "rotation" ?
    note("Wave coverage, không phải xác suất", "Phần trăm là số wave trong chu kỳ có item. Mỗi wave lấy danh sách và Count cố định từ RotationShopWaves.csv. Rotation Shop không có trường Rebirth.", "RotationShopConfigs.fcg · RotationShopManager.fcg", "info") :
    s.shopView === "event" ? note("Event shop", "Chọn loại event để lọc shop. Gift ID được nối với Reward ID; nếu event có timestamp mở item, timeline quy ra ngày tính từ Start của event.", "EventSchedule.csv · shopEventItems.csv · EventShopConfigs.fcg · EventShopManager.fcg · reward.csv", "info") :
      note("Shop thường · raw config", "Requirement và TimeLock giữ nguyên theo CSV; chưa đổi sang gate hoặc đơn vị khác khi code chưa xác nhận.", "shopItems.csv · ShopItemsConfigs.fcg", "info");
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

function updateEventShopRows(data) {
  const list = document.getElementById("shop-event-items");
  const timeline = document.getElementById("shop-release-timeline");
  if (!list || !timeline) return;
  const rows = eventShopRows(data);
  timeline.innerHTML = eventReleaseTimeline(data, rows);
  list.innerHTML = rows.map(row => eventShopCard(row, data)).join("") || '<div class="empty">Không có item khớp event/bộ lọc.</div>';
  const count = document.getElementById("shop-count");
  if (count) count.textContent = rows.length + " / " + (data.eventShopItems || []).length + " item";
}

function updateShopRows(data) {
  if (s.shopView === "event") { updateEventShopRows(data); return; }
  const body = document.getElementById("shop-rows");
  if (!body) return;
  if (s.shopView === "standard") {
    const rows = data.shopItems || [];
    const query = s.shopSearch.trim().toLowerCase();
    const headers = data.shopItemsHeaders || [];
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
  document.querySelectorAll("[data-shop-action]").forEach(button => { button.disabled = button.dataset.shopAction === "prev" ? s.shopOffset <= 0 : end >= rows.length; });
}

document.addEventListener("click", event => {
  const tab = event.target.closest("[data-shop-view]");
  if (tab) {
    s.shopView = tab.dataset.shopView;
    s.shopOffset = 0;
    s.shopSearch = "";
    renderShopContent(shopScheduleData);
    return;
  }
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
  if (event.target.id === "shop-event-type") { s.shopEventType = event.target.value; updateShopRows(shopScheduleData); }
});
