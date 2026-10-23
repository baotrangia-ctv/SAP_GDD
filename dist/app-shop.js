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
  return [...shopsByType.entries()].map(([type, shops]) => {
    const schedule = schedules.find(row => String(row.EventType) === type);
    const eventName = schedule?.eventName || (type === "unknown" ? "Event chưa có tên" : "Event " + type);
    const shopLabels = [...shops].map(shopId => "Shop #" + shopId).join(", ");
    return [type, eventName + " · " + shopLabels];
  });
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
    return '<div id="shop-cards" class="shop-item-grid"></div>';
  }
  if (s.shopView === "event") return '<div id="shop-release-timeline"></div><div id="shop-event-items" class="event-shop-grid"></div>';
  return '<div id="shop-cards" class="shop-item-grid"></div>';
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
    const eventName = schedule?.eventName || (schedule ? "Event " + schedule.EventType : "Chưa có event schedule");
    return '<section class="event-release-visual"><div class="event-release-head"><div><h2>' + esc(eventName) + ' · Shop #' + esc(shopId) + '</h2><p>' + (schedule ? 'Event bắt đầu: ' + esc(startDate) : 'Chưa có event schedule') + (timeIsTimestamp ? ' · TimeAvailable là timestamp' : ' · unit TimeAvailable chưa xác nhận') + '</p></div>' + (schedule ? '<span class="event-type-badge">EventType ' + esc(schedule.EventType) + ' · Shop #' + esc(schedule.ShopId) + '</span>' : '') + '</div><div class="event-release-days">' + (days.map(([label, entries]) => '<div class="event-release-day"><span>' + esc(label) + '</span><strong>' + entries.length + ' item' + (entries.length === 1 ? "" : "s") + '</strong><div class="event-release-dots">' + entries.slice(0, 14).map((item, index) => '<i style="--release-color:' + (index % 3 === 0 ? "#82e0ba" : index % 3 === 1 ? "#73d2e8" : "#b49cff") + '" title="' + esc(item.NameLocalize || item.Name) + '"></i>').join("") + '</div></div>').join("") || '<div class="empty">Không có item cho event này.</div>') + '</div></section>';
  }).join("") || '<section class="event-release-visual"><div class="empty">Không có item cho event này.</div></section>';
}

function eventShopItemArt(item) {
  const itemType = String(item.Name || "").toLowerCase();
  if (itemType === "randompet" || itemType === "randomitem") return gameItemVisual(item.IconResource || item.Name, eventShopItemTitle(item));
  const rewards = giftRewardRows(item.IDGift).filter(row => !row.missing);
  if (rewards.length) return rewardVisual(rewards[0]);
  const resource = String(item.IconResource || item.NameLocalize || "");
  const pet = t("Pet.csv").rows.find(row => row.Name === resource || row.Name === item.NameLocalize);
  if (pet) return petImageHtml(pet, "event-shop-art-pet");
  return '<span class="reward-art-mark">🎁</span>';
}

function standardShopItemName(row) {
  return pretty(String(row.NameLocalize || row.Name || "Item").replace(/^HUD_SHOP_ITEM_/, ""));
}

function standardShopItemCard(row) {
  const title = standardShopItemName(row);
  const description = pretty(String(row.Description || "").replace(/^HUD_SHOP_DETAILS_/, ""));
  return '<article class="shop-item-card rarity-bg-NONE"><div class="shop-item-card-head"><div class="shop-item-art rarity-bg-NONE">' + gameItemVisual(row.Name, title) + '</div><div class="shop-item-title"><span class="event-type-badge">Shop thường</span><h3>' + esc(title) + '</h3><small>Item #' + esc(row.ID) + ' · Sprite ' + esc(row.Name) + '</small></div><strong class="shop-item-price">' + esc(row.Cost || "—") + '<small>cost</small></strong></div><p class="shop-item-description">' + esc(description || "Chưa có mô tả") + '</p><div class="shop-item-meta"><span>Requirement ' + esc(row.Requirement || "0") + ' · raw</span><span>TimeLock ' + esc(row.TimeLock || "—") + ' · raw</span></div></article>';
}

function rotationItemPet(row, value) {
  const petId = String(value[0] || "");
  return t("Pet.csv").rows.find(pet => String(pet.ID) === petId);
}

function rotationItemRarityKey(row, value) {
  const type = String(row.type);
  if (type === "1") return itemRarityKey({ TypeReward: "1", Value: value[0] || "" });
  if (type === "2") return itemRarityKey({ TypeReward: "10", Value: value[0] || "" });
  if (type === "4") return itemRarityKey({ TypeReward: "16", Value: value[0] || "" });
  return "NONE";
}

function rotationItemName(row, value) {
  if (String(row.type) === "1") return rotationItemPet(row, value)?.Name || "Pet #" + (value[0] || "?");
  if (String(row.type) === "2") {
    const mutagen = t("Mutagen.csv").rows.find(item => String(item.ID) === String(value[0]));
    const mutation = mutagen && t("mutation.csv").rows.find(item => String(item.ID) === String(mutagen.Mutation));
    return mutation?.Name || "Mutagen #" + (value[0] || "?");
  }
  if (String(row.type) === "3") {
    const weather = t("weather.csv").rows.find(item => String(item.ID) === String(value[0]));
    return weather ? "Summon " + weather.Name : "Summon weather #" + (value[0] || "?");
  }
  if (String(row.type) === "4") {
    const gen = t("WeatherGen.csv").rows.find(item => String(item.ID) === String(value[0]));
    const effect = gen && t("weatherEffects.csv").rows.find(item => String(item.ID) === String(gen.WeatherEffect));
    return effect?.Name || "WeatherGen #" + (value[0] || "?");
  }
  return "Item #" + row.itemId;
}

function rotationItemArt(row, value) {
  if (String(row.type) === "1") {
    const pet = rotationItemPet(row, value);
    if (!pet) return gameSpriteIconHtml("Pet", "Pet #" + (value[0] || "?"));
    const mutation = value[1] && value[1] !== "0" ? t("mutation.csv").rows.find(item => String(item.ID) === String(value[1]) && String(item.Name).toUpperCase() !== "NORMAL") : null;
    const weatherEffect = value[2] && Number(value[2]) > 0 ? t("weatherEffects.csv").rows.find(item => String(item.ID) === String(value[2])) : null;
    return '<div class="shop-item-pet-visual">' + petImageHtml(pet, "shop-item-pet") + (mutation ? '<span class="shop-item-overlay" title="' + esc(mutation.Name) + '">' + systemIcon(s.data.visualAssets?.mutationIcons, mutation.ID, "✧") + '</span>' : '') + (weatherEffect ? '<span class="shop-item-overlay shop-item-overlay-weather" title="' + esc(weatherEffect.Name) + '">' + systemIcon(s.data.visualAssets?.weatherEffectIcons, weatherEffect.ID, "☁") + '</span>' : '') + '</div>';
  }
  if (String(row.type) === "2") return rewardVisual({ TypeReward: "10", Value: value[0] || "", Quantity: "1" });
  if (String(row.type) === "3") {
    const weather = t("weather.csv").rows.find(item => String(item.ID) === String(value[0]));
    return weather ? gameItemVisual(weather.Icon || weather.Name, "Summon " + weather.Name) : gameSpriteIconHtml("Weather", "Weather #" + (value[0] || "?"));
  }
  if (String(row.type) === "4") return rewardVisual({ TypeReward: "16", Value: value[0] || "", Quantity: "1" });
  return gameSpriteIconHtml("ShopItem", "Item #" + row.itemId);
}

function rotationShopItemCard(row) {
  const value = String(row.value || "").split(";");
  const pet = String(row.type) === "1" ? rotationItemPet(row, value) : null;
  const itemRarity = rotationItemRarityKey(row, value);
  const itemRarityClass = rarityBgClass(itemRarity);
  const mutagen = String(row.type) === "2" ? t("Mutagen.csv").rows.find(item => String(item.ID) === String(value[0])) : null;
  const weather = String(row.type) === "3" ? t("weather.csv").rows.find(item => String(item.ID) === String(value[0])) : null;
  const weatherGen = String(row.type) === "4" ? t("WeatherGen.csv").rows.find(item => String(item.ID) === String(value[0])) : null;
  const typeLabel = pet ? "Pet" : mutagen ? "Mutagen" : weather ? "Summon weather" : weatherGen ? "WeatherGen" : "Type " + row.type;
  const effect = value[2] && Number(value[2]) > 0 ? t("weatherEffects.csv").rows.find(item => String(item.ID) === String(value[2])) : null;
  const mutation = value[1] && value[1] !== "0" ? t("mutation.csv").rows.find(item => String(item.ID) === String(value[1]) && String(item.Name).toUpperCase() !== "NORMAL") : null;
  const detail = pet ? [pet.Rarity, mutation && "Mutation " + mutation.Name, value[2] && ("Weather " + (effect?.Name || "chưa có dữ liệu"))].filter(Boolean).join(" · ") : weather ? "Weather " + weather.Name : typeLabel;
  const coverage = row.wavePresencePercent == null ? "—" : row.wavePresencePercent.toFixed(1) + "%";
  const discount = row.discountPrice && row.discountPrice !== row.price ? '<s>' + esc(row.price) + '</s> ' + esc(row.discountPrice) : esc(row.discountPrice || row.price || "—");
  return '<article class="shop-item-card ' + itemRarityClass + '"><div class="shop-item-card-head"><div class="shop-item-art ' + itemRarityClass + '">' + rotationItemArt(row, value) + '</div><div class="shop-item-title"><span class="event-type-badge">Wave ' + esc(row.waveId) + ' · ' + esc(row.durationMinutes) + ' phút</span><h3>' + esc(rotationItemName(row, value)) + '</h3><small>Item #' + esc(row.itemId) + ' · ' + esc(typeLabel) + '</small></div><strong class="shop-item-price">' + discount + '<small>price</small></strong></div><div class="shop-item-description">' + esc(detail || "—") + '</div><div class="shop-item-meta"><span>Stock ×' + esc(row.stock || "—") + '</span><span>Wave coverage ' + esc(row.wavePresenceCount) + '/' + esc(row.waveCount) + ' · ' + esc(coverage) + '</span></div></article>';
}

function eventShopItemRarityKey(item) {
  const reward = giftRewardRows(item.IDGift).find(row => !row.missing);
  if (reward) return itemRarityKey(reward);
  const resource = String(item.IconResource || item.NameLocalize || "");
  const pet = t("Pet.csv").rows.find(row => row.Name === resource || row.Name === item.NameLocalize);
  return pet ? itemRarityKey({ TypeReward: "1", Value: pet.ID }) : "NONE";
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
  const reward = entry.pet ? null : giftRewardRows(entry.giftId).find(row => !row.missing);
  const itemRarity = entry.pet ? itemRarityKey({ TypeReward: "1", Value: entry.pet.ID }) : reward ? itemRarityKey(reward) : "NONE";
  const rewardArt = entry.pet ? petImageHtml(entry.pet, "event-pool-pet-art") : reward ? rewardVisual(reward) : '<span class="reward-art-mark">🎁</span>';
  const rewardMap = String(entry.giftId || "").trim() ? giftRewardsHtml(entry.giftId) : '<div class="gift-unresolved">Chưa có Gift ID.</div>';
  return '<article class="event-pool-entry"><div class="event-pool-outcome"><div class="event-pool-art ' + rarityBgClass(itemRarity) + '">' + rewardArt + '</div><div><strong>' + chance + '</strong><small>' + esc(entry.detail || ("Pool item #" + entry.id)) + '</small><small>Weight ' + esc(entry.weight || "—") + '</small></div></div>' + rewardMap + '</article>';
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
  const itemRarityClass = rarityBgClass(eventShopItemRarityKey(item));
  const rewardMapping = String(item.IDGift || "").trim() ? giftRewardsHtml(item.IDGift) : (eventRandomPoolHtml(item, data) || '<div class="event-no-gift">Item này không có Gift ID trực tiếp; reward pool được runtime chọn khi mua.</div>');
  return '<article class="event-shop-card ' + itemRarityClass + '"><div class="event-shop-card-head"><div class="event-shop-art ' + itemRarityClass + '">' + eventShopItemArt(item) + '</div><div class="event-shop-name"><span class="event-type-badge">' + esc(eventShopItemTypeLabel(item.Name)) + '</span><h3>' + esc(name) + '</h3><small>Item #' + esc(item.ID) + ' · Shop ' + esc(item.ShopId || "—") + '</small></div><strong class="event-shop-cost">' + esc(item.Cost || "—") + '<small>cost</small></strong></div><div class="event-release-tag">◷ ' + esc(release) + '</div>' + rewardMapping + '<div class="event-shop-meta">' + (limit ? '<span>Limit: ' + esc(limit) + '</span>' : '<span>Limit không cấu hình</span>') + '<span>TimeLock: ' + esc(item.TimeLock || "—") + ' · raw</span></div></article>';
}

function renderShopContent(data) {
  const target = document.getElementById("shop-data");
  if (!target) return;
  const f = s.data.codeFacts;
  const caveat = s.shopView === "rotation" ?
    note("Wave coverage, không phải xác suất", "Phần trăm là số wave trong chu kỳ có item. Mỗi wave lấy danh sách và Count cố định từ RotationShopWaves.csv. Rotation Shop không có trường Rebirth. Màu nền theo rarity trong game; item không có rarity dùng màu trung tính.", "RotationShopConfigs.fcg · RotationShopManager.fcg", "info") :
    s.shopView === "event" ? note("Event shop", "Chọn loại event để lọc shop. Gift ID được nối với Reward ID; nếu event có timestamp mở item, timeline quy ra ngày tính từ Start của event. Màu nền item theo rarity có trong config.", "EventSchedule.csv · shopEventItems.csv · EventShopConfigs.fcg · EventShopManager.fcg · reward.csv", "info") :
      note("Shop thường · raw config", "Requirement và TimeLock giữ nguyên theo CSV; chưa đổi sang gate hoặc đơn vị khác khi code chưa xác nhận. Shop thường không có rarity nên dùng màu nền trung tính.", "shopItems.csv · ShopItemsConfigs.fcg", "info");
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
    (!query || [row.waveId, row.itemId, row.type, row.value, row.stock, row.price, row.discountPrice, rotationItemName(row, String(row.value || "").split(";"))].join(" ").toLowerCase().includes(query)));
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
  const list = document.getElementById("shop-cards");
  if (!list) return;
  if (s.shopView === "standard") {
    const rows = data.shopItems || [];
    const query = s.shopSearch.trim().toLowerCase();
    const headers = data.shopItemsHeaders || [];
    const filtered = rows.filter(row => !query || headers.some(key => String(row[key] ?? "").toLowerCase().includes(query)) || standardShopItemName(row).toLowerCase().includes(query));
    list.innerHTML = filtered.map(standardShopItemCard).join("") || '<div class="empty">Không có dòng khớp.</div>';
    const count = document.getElementById("shop-count"); if (count) count.textContent = filtered.length + " / " + rows.length + " item";
    return;
  }
  const rows = filteredShopRows(data);
  const end = Math.min(s.shopOffset + SHOP_PAGE_SIZE, rows.length);
  list.innerHTML = rows.slice(s.shopOffset, end).map(rotationShopItemCard).join("") || '<div class="empty">Không có dòng khớp.</div>';
  const count = document.getElementById("shop-count"); if (count) count.textContent = Math.min(rows.length, SHOP_PAGE_SIZE) + " / " + rows.length + " item";
  const page = document.getElementById("shop-page"); if (page) page.textContent = "Items " + (rows.length ? s.shopOffset + 1 : 0) + "–" + end + " / " + rows.length;
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
