Object.assign(pages, { pools: "Pool & phần thưởng" });

if (!s.poolView) s.poolView = "items";
if (!s.poolSubView) s.poolSubView = "pets";
if (s.poolSearch === undefined) s.poolSearch = "";
if (!s.poolFilter) s.poolFilter = "all";
if (!s.poolOffset) s.poolOffset = 0;

let poolsData = null;
let poolsLoading = null;
const POOLS_PAGE_SIZE = 50;

function poolsPage() {
  return head("ĐỌC NỘI DUNG POOL", "Pool & phần thưởng", "Tra cứu pool và bảng quà. Phần trăm chỉ hiện khi `.fcg` xác nhận chọn theo trọng số; ID và value khác giữ nguyên raw.", pill("CSV + code đã đồng bộ", "mint")) +
    '<div id="pools-data"><div class="loading-state"><span class="loader"></span><span>Đang đọc pool data…</span></div></div>';
}

async function loadPoolsData() {
  if (poolsData) return poolsData;
  if (!poolsLoading) {
    poolsLoading = fetch("./data/pools.json")
      .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .then(data => (poolsData = data))
      .finally(() => { poolsLoading = null; });
  }
  return poolsLoading;
}

async function updatePoolsPage() {
  const target = document.getElementById("pools-data");
  if (!target) return;
  try {
    await Promise.all([loadPoolsData(), loadRewardDisplayData()]);
    if (s.page !== "pools" || !document.getElementById("pools-data")) return;
    renderPoolsContent();
  } catch (error) {
    target.innerHTML = note("Không đọc được pool data", error.message + " · Chạy tools/sync-source-data.mjs rồi tải lại trang.", "pools.json");
  }
}

function poolTabs() {
  const tabs = [["items", "Vật phẩm"], ["secret", "Pool bí mật"], ["dig", "Dig"], ["fishing", "Fishing"], ["guarantee", "GuaranteePool"], ["events", "Collector / FuseContract"]];
  return '<div class="tabbar" role="tablist" aria-label="Nhóm pool">' + tabs.map(([id, label]) =>
    '<button class="tab' + (s.poolView === id ? " active" : "") + '" type="button" data-pool-view="' + id + '" role="tab" aria-selected="' + (s.poolView === id) + '">' + label + "</button>").join("") + "</div>";
}

function poolSubTabs() {
  let tabs = [];
  if (s.poolView === "dig") tabs = [["pets", "Pool pet"], ["spot", "Độ hiếm điểm"], ["chest", "Cấu hình rương"]];
  if (s.poolView === "fishing") tabs = [["pets", "Pool pet"], ["rewards", "Quà rương"], ["chest", "Cấu hình rương"]];
  if (s.poolView === "events") tabs = [["collector", "Collector"], ["fuse", "FuseContract"]];
  if (!tabs.length) return "";
  if (!tabs.some(([id]) => id === s.poolSubView)) s.poolSubView = tabs[0][0];
  return '<div class="tabbar subtabbar" role="tablist" aria-label="Bảng pool chi tiết">' + tabs.map(([id, label]) =>
    '<button class="tab' + (s.poolSubView === id ? " active" : "") + '" type="button" data-pool-subview="' + id + '" role="tab" aria-selected="' + (s.poolSubView === id) + '">' + label + "</button>").join("") + "</div>";
}

function poolFilterOptions() {
  if (s.poolView === "secret") return [...new Set(poolsData.secretRewardPools.entries.map(row => row.poolId))].map(id => [id, "Pool " + id]);
  if (s.poolView === "dig" && s.poolSubView === "pets") return poolsData.dig.petPoolBands.map(band => [band.id, band.label]);
  if (s.poolView === "dig" && s.poolSubView === "spot") return [...new Set(poolsData.dig.spotRarity.map(row => row.scanTier))].map(tier => [tier, tier]);
  if (s.poolView === "fishing" && s.poolSubView === "pets") return poolsData.fishing.petPoolBands.map(band => [band.id, band.label]);
  return [];
}

function poolFilters() {
  const options = poolFilterOptions();
  if (!options.length) { s.poolFilter = "all"; return ""; }
  if (!options.some(([value]) => value === s.poolFilter)) s.poolFilter = options[0][0];
  return '<label class="small-count" for="pool-filter">' + (s.poolView === "secret" ? "Pool" : s.poolView === "dig" && s.poolSubView === "spot" ? "Bậc Scan" : s.poolView === "fishing" ? "Bậc Rebirth" : "Bậc Dig") + '</label><select id="pool-filter" class="field-select">' +
    options.map(([value, label]) => '<option value="' + esc(value) + '"' + (s.poolFilter === value ? " selected" : "") + ">" + esc(label) + "</option>").join("") + "</select>";
}

function poolTableModel() {
  if (s.poolView === "items") {
    const shares = new Map(poolsData.poolRandomItems.shares.map(row => [row.id, row]));
    return {
      rows: (t("PoolRandomItem.csv").rows || []).map(row => ({ ...row, WeightShare: shares.get(String(row.ID))?.weightSharePercent })),
      columns: [{ key: "ID" }, { key: "Type" }, { key: "Weight" }, { key: "WeightShare", label: "Tỉ phần Weight (%)" }, { key: "GiftID" }, { key: "Value" }]
    };
  }
  if (s.poolView === "secret") return {
    rows: poolsData.secretRewardPools.entries,
    columns: [{ key: "poolId", label: "Pool ID" }, { key: "petId", label: "Pet ID" }, { key: "giftId", label: "Gift ID" }, { key: "weight", label: "Weight" }, { key: "weightSharePercent", label: "Tỉ phần Weight (%)" }]
  };
  if (s.poolView === "dig") {
    if (s.poolSubView === "pets") {
      const band = poolsData.dig.petPoolBands.find(row => row.id === s.poolFilter) || poolsData.dig.petPoolBands[0];
      return { rows: band?.items || [], columns: [{ key: "petId", label: "Pet ID" }, { key: "weight" }, { key: "weightSharePercent", label: "Tỉ phần Weight (%)" }] };
    }
    if (s.poolSubView === "spot") return {
      rows: poolsData.dig.spotRarity.filter(row => row.scanTier === s.poolFilter),
      columns: [{ key: "scanTier", label: "Bậc Scan" }, { key: "spotRarity", label: "Độ hiếm điểm" }, { key: "weight" }, { key: "weightSharePercent", label: "Tỉ phần Weight (%)" }]
    };
    return { rows: t("DigGuaranteedChest.csv").rows || [], columns: ["Cast", "Chest1", "Chest2", "Chest3"].map(key => ({ key, label: key + " · gốc" })) };
  }
  if (s.poolView === "fishing") {
    if (s.poolSubView === "pets") {
      const band = poolsData.fishing.petPoolBands.find(row => row.id === s.poolFilter) || poolsData.fishing.petPoolBands[0];
      return { rows: band?.items || [], columns: [{ key: "petId", label: "Pet ID" }, { key: "weight" }, { key: "weightSharePercent", label: "Tỉ phần Weight (%)" }] };
    }
    if (s.poolSubView === "rewards") {
      const shares = new Map(poolsData.fishing.chestRewards.map(row => [row.id, row]));
      return {
        rows: (t("FishingChestReward.csv").rows || []).map(row => ({ ...row, WeightShare: shares.get(String(row.ID))?.weightSharePercent })),
        columns: [{ key: "ID" }, { key: "ItemType" }, { key: "Weight" }, { key: "WeightShare", label: "Tỉ phần Weight (%)" }, { key: "RewardValue" }]
      };
    }
    return { rows: t("GuaranteedFishingChest.csv").rows || [], columns: ["Cast", "Chest1", "Chest2", "Chest3"].map(key => ({ key, label: key + " · gốc" })) };
  }
  if (s.poolView === "guarantee") return { rows: t("GuaranteePool.csv").rows || [], columns: [{ key: "Pet ID", value: row => row.PetId }, { key: "Weight · gốc", value: row => row.Weight }] };
  if (s.poolSubView === "collector") return { rows: t("poolPetEventCollector.csv").rows || [], columns: [{ key: "Ngày · gốc", value: row => row.Date }, { key: "Pool · gốc", value: row => row.Pool }] };
  return { rows: t("PoolPetEventFuseContract.csv").rows || [], columns: [{ key: "Ngày · gốc", value: row => row.Date }, { key: "Quà · gốc", value: row => row.Gift }, { key: "Pool · gốc", value: row => row.Pool }] };
}

function poolNote() {
  if (s.poolView === "items") return note("PoolRandomItem · chọn theo trọng số", "Code cộng Weight, chuẩn hoá trong bảng rồi chọn một dòng qua WeightedRandom. Tỉ phần Weight là cơ cấu trong bảng này; Type, GiftID và Value vẫn giữ raw.", "PoolRandomItem.csv · RewardRandomConfig.fcg · WeightedRandom.fcg", poolsData.sourceFacts.poolRandomItemsUseWeightedDraw ? "info" : "review");
  if (s.poolView === "secret") return note("Pool bí mật · theo Pool ID", "Code ghép Pool, Weight và IDGift theo cùng vị trí rồi chuẩn hoá Weight trong từng pool. Tỉ phần Weight chỉ áp dụng bên trong Pool ID, không phải xác suất tổng của event.", "poolRewardSecret.csv · RewardRandomConfig.fcg · EventCollectorManager.fcg · WeightedRandom.fcg", poolsData.sourceFacts.secretPoolItemsUseIndexAlignedWeights ? "info" : "review");
  if (s.poolView === "dig" && s.poolSubView === "pets") return note("Dig pet pool · theo bậc", "Tỉ phần Weight là cơ cấu của một lượt chọn pet trong pool tier tương ứng. DigPoolMap nối SpotRarity tới pool tier; trang không nhân các lượt này thành xác suất tổng của một lần Dig.", "DigPools.csv · DigPoolMap.csv · EventDigConfig.fcg", poolsData.sourceFacts.digPetPoolUsesWeightedDraw ? "info" : "review");
  if (s.poolView === "dig" && s.poolSubView === "spot") return note("Độ hiếm điểm · theo ScanTier", "Tỉ phần Weight là cơ cấu của lượt GetSpotRarityWeighted theo ScanTier đã chọn. RarityCap và các bước sau không được gộp vào phần trăm này.", "DigSpotRarity.csv · DigScan.csv · EventDigConfig.fcg", poolsData.sourceFacts.digSpotRarityUsesWeightedDraw ? "info" : "review");
  if (s.poolView === "dig") return note("Dig chest config · raw", "Code đọc các giá trị này làm rate theo số lần Dig. Đơn vị/diễn giải không được đổi thành % ở trang này.", "DigGuaranteedChest.csv · EventDigConfig.fcg", "info");
  if (s.poolView === "fishing" && s.poolSubView === "pets") return note("Fishing pet pool · theo Rebirth", "Tỉ phần Weight là cơ cấu của lượt GetRandomFishingPetId trong bậc Rebirth đã chọn; RB 0 dùng pool đầu và RB cao hơn giới hạn ở pool cuối theo code.", "PoolFishing.csv · EventFishingConfig.fcg", poolsData.sourceFacts.fishingPetPoolUsesWeightedDraw ? "info" : "review");
  if (s.poolView === "fishing" && s.poolSubView === "rewards") return note("Quà rương Fishing · chọn theo trọng số", "Code chọn một reward ID theo Weight trong FishingChestReward. Tỉ phần Weight tính giữa các dòng reward; ItemType và RewardValue vẫn giữ raw.", "FishingChestReward.csv · EventFishingConfig.fcg · WeightedRandom.fcg", poolsData.sourceFacts.fishingChestRewardsUseWeightedDraw ? "info" : "review");
  if (s.poolView === "fishing") return note("Fishing chest config · raw", "Code đọc các giá trị này làm rate theo số lần Cast. Đơn vị/diễn giải không được đổi thành % ở trang này.", "GuaranteedFishingChest.csv · EventFishingConfig.fcg", "info");
  if (s.poolView === "guarantee") return note("GuaranteePool · Weight raw", "Config loader đọc PetId và Weight. Chưa xác nhận call site weighted draw cho bảng này, nên không chuẩn hoá thành phần trăm.", "GuaranteePool.csv · GuaranteePool.fcg", poolsData.sourceFacts.guaranteePoolRuntimeDrawVerified ? "info" : "review");
  if (s.poolSubView === "collector") return note("Collector schedule · raw", "Date và Pool được giữ theo CSV. Code dùng Pool để xác định pet có thể thu thập trong lịch hiện tại; không phải bảng tỉ lệ rơi.", "poolPetEventCollector.csv · EventCollectorConfigs.fcg", "info");
  return note("FuseContract schedule · raw", "Date, Gift và các nhóm Pool được giữ theo CSV. Đây là lịch nhiệm vụ/gift; trang không diễn giải danh sách pet thành xác suất.", "PoolPetEventFuseContract.csv · EventFuseConfigs.fcg", "info");
}

function renderPoolsContent() {
  const target = document.getElementById("pools-data");
  if (!target || !poolsData) return;
  const secretPools = new Set(poolsData.secretRewardPools.entries.map(row => row.poolId)).size;
  target.innerHTML = '<section class="kpi-grid">' +
    kpi("DÒNG VẬT PHẨM", t("PoolRandomItem.csv").rowCount, "PoolRandomItem.csv") +
    kpi("POOL BÍ MẬT", secretPools, "poolRewardSecret.csv") +
    kpi("DÒNG PET DIG", t("DigPools.csv").rowCount, "5 cột Weight · DigPools.csv") +
    kpi("DÒNG PET FISHING", t("PoolFishing.csv").rowCount, "5 cột Weight · PoolFishing.csv") +
    kpi("DÒNG LỊCH EVENT", (t("poolPetEventCollector.csv").rowCount || 0) + (t("PoolPetEventFuseContract.csv").rowCount || 0), "Collector + FuseContract") +
    '</section>' + poolTabs() + poolSubTabs() +
    '<div class="filterbar">' + poolFilters() + '<div class="search-wrap"><input id="pool-search" type="search" value="' + esc(s.poolSearch) + '" placeholder="Tìm ID, pool, Weight, quà…" aria-label="Tìm trong pools"></div><span id="pool-count" class="small-count"></span></div>' +
    '<div class="table-wrap data-table-view"><table><thead><tr id="pool-headers"></tr></thead><tbody id="pool-rows"></tbody></table></div>' +
    '<div class="table-foot"><span id="pool-page"></span><span><button class="panel-link" data-pool-action="prev">← Trước</button> <button class="panel-link" data-pool-action="next">Tiếp →</button></span></div>' +
    poolNote();
  updatePoolRows();
}

function formatPoolCell(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number") return value.toFixed(2) + "%";
  return String(value);
}

function poolPetArt(petId) {
  const pet = t("Pet.csv").rows.find(row => String(row.ID) === String(petId));
  return pet ? petImageHtml(pet, "pool-art-pet") : "";
}

function poolVisualGroup(items) {
  const visuals = items.filter(Boolean).slice(0, 4);
  if (!visuals.length) return gameSpriteIconHtml("Pool", "Pool reward");
  if (visuals.length === 1) return visuals[0];
  return '<span class="pool-art-group">' + visuals.map((item, index) => '<span class="pool-art-mini pool-art-mini-' + index + '">' + item + '</span>').join("") + '</span>';
}

function poolRowArt(row) {
  if (s.poolView === "items") {
    const reward = giftRewardRows(row.GiftID).find(item => !item.missing);
    return reward ? rewardVisual(reward) : gameSpriteIconHtml("RandomItem", "Random item");
  }
  if (s.poolView === "secret" || (s.poolView === "dig" && s.poolSubView === "pets") || (s.poolView === "fishing" && s.poolSubView === "pets") || s.poolView === "guarantee") {
    const petId = row.petId || row.PetId;
    const petArt = poolPetArt(petId);
    return petArt || gameSpriteIconHtml("RandomPet", "Pet reward");
  }
  if (s.poolView === "dig" && s.poolSubView === "spot") return gameSpriteIconHtml("DigSpot", "Độ hiếm điểm " + row.spotRarity);
  if (s.poolView === "dig" || (s.poolView === "fishing" && s.poolSubView === "chest")) return gameSpriteIconHtml("Chest", "Rương");
  if (s.poolView === "fishing" && s.poolSubView === "rewards") {
    const reward = { TypeReward: row.ItemType, Value: row.RewardValue, Quantity: "1" };
    return rewardVisual(reward);
  }
  if (s.poolView === "events" && s.poolSubView === "collector") {
    const petIds = String(row.Pool || "").split(/[;|]/).filter(Boolean);
    return poolVisualGroup(petIds.map(poolPetArt));
  }
  if (s.poolView === "events" && s.poolSubView === "fuse") {
    const giftIds = String(row.Gift || "").split(";").filter(Boolean);
    const giftArts = giftIds.map(giftId => {
      const reward = giftRewardRows(giftId).find(item => !item.missing);
      return reward ? rewardVisual(reward) : "";
    });
    if (giftArts.some(Boolean)) return poolVisualGroup(giftArts);
    const petIds = String(row.Pool || "").split(/[;|]/).filter(Boolean);
    return poolVisualGroup(petIds.map(poolPetArt));
  }
  return gameSpriteIconHtml("Pool", "Pool configuration");
}

function updatePoolRows() {
  const headRow = document.getElementById("pool-headers"), body = document.getElementById("pool-rows");
  if (!headRow || !body) return;
  const model = poolTableModel();
  headRow.innerHTML = "<th>Hình</th>" + model.columns.map(column => "<th>" + esc(column.label || column.key) + "</th>").join("");
  const query = s.poolSearch.trim().toLowerCase();
  const rows = model.rows.filter(row => {
    const haystack = model.columns.map(column => column.value ? column.value(row) : row[column.key]).join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (s.poolView === "secret" && s.poolFilter !== "all" && row.poolId !== s.poolFilter) return false;
    if (s.poolView === "dig" && s.poolSubView === "spot" && row.scanTier !== s.poolFilter) return false;
    return true;
  });
  const end = Math.min(s.poolOffset + POOLS_PAGE_SIZE, rows.length);
  body.innerHTML = rows.slice(s.poolOffset, end).map(row => '<tr><td class="pool-icon-cell"><span class="pool-row-art">' + poolRowArt(row) + '</span></td>' + model.columns.map(column => {
    const raw = column.value ? column.value(row) : row[column.key];
    const value = formatPoolCell(raw);
    return '<td title="' + esc(value) + '">' + esc(value) + "</td>";
  }).join("") + "</tr>").join("") || '<tr><td class="empty" colspan="' + (Math.max(1, model.columns.length) + 1) + '">Không có dòng khớp.</td></tr>';
  const count = document.getElementById("pool-count"); if (count) count.textContent = Math.min(rows.length, POOLS_PAGE_SIZE) + " / " + rows.length + " dòng";
  const page = document.getElementById("pool-page"); if (page) page.textContent = "Dòng " + (rows.length ? s.poolOffset + 1 : 0) + "–" + end + " / " + rows.length;
  document.querySelectorAll("[data-pool-action]").forEach(button => {
    button.disabled = button.dataset.poolAction === "prev" ? s.poolOffset <= 0 : end >= rows.length;
  });
}

document.addEventListener("click", event => {
  const tab = event.target.closest("[data-pool-view]");
  if (tab) {
    s.poolView = tab.dataset.poolView;
    s.poolSearch = "";
    s.poolFilter = "all";
    s.poolOffset = 0;
    if (s.poolView === "dig") s.poolSubView = "pets";
    if (s.poolView === "fishing") s.poolSubView = "pets";
    if (s.poolView === "events") s.poolSubView = "collector";
    renderPoolsContent();
    return;
  }
  const subtab = event.target.closest("[data-pool-subview]");
  if (subtab) {
    s.poolSubView = subtab.dataset.poolSubview;
    s.poolSearch = "";
    s.poolFilter = "all";
    s.poolOffset = 0;
    renderPoolsContent();
    return;
  }
  const action = event.target.closest("[data-pool-action]");
  if (action) {
    s.poolOffset = action.dataset.poolAction === "prev" ? Math.max(0, s.poolOffset - POOLS_PAGE_SIZE) : s.poolOffset + POOLS_PAGE_SIZE;
    updatePoolRows();
  }
});
document.addEventListener("input", event => {
  if (event.target.id === "pool-search") { s.poolSearch = event.target.value; s.poolOffset = 0; updatePoolRows(); }
});
document.addEventListener("change", event => {
  if (event.target.id === "pool-filter") { s.poolFilter = event.target.value; s.poolOffset = 0; updatePoolRows(); }
});
