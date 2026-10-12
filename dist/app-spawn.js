"use strict";

if (!s.spawnCounts) s.spawnCounts = [2, 1, 1, 1, 1];
if (!s.spawnDay) s.spawnDay = 1;
if (s.spawnWeekend === undefined) s.spawnWeekend = false;
if (!s.spawnSearch) s.spawnSearch = "";

function actionIcon(name, label) {
  const src = s.data.visualAssets?.actionIcons?.[name];
  return src ? '<img class="action-icon" src="' + esc(src) + '" alt="" aria-hidden="true">' : '<span class="action-icon-fallback">◈</span>';
}
function petImageHtml(row, extraClass) {
  const src = s.data.visualAssets?.petIcons?.[String(row.ID)];
  return src ? '<img class="pet-thumb ' + (extraClass || '') + '" src="' + esc(src) + '" alt="' + esc(row.Name) + '" loading="lazy">' : '<span class="pet-thumb pet-thumb-missing" aria-label="No pet art">?</span>';
}
function spawnBandData() { return s.data.codeFacts.rebirthBands || []; }
function spawnCandidates() {
  const ids = new Set(s.data.codeFacts.roadSpawnPetIds || []);
  return t("Pet.csv").rows.filter(row => ids.has(n(row.ID)));
}
function spawnDailyFactor(row, day) {
  if (n(row.ID) > n(s.data.codeFacts.petCount)) return 1;
  const state = String(row["Day " + day] || "NORMAL").toUpperCase();
  if (state === "UP") return n(s.data.codeFacts.dailyModifiers.up);
  if (state === "DOWN") return n(s.data.codeFacts.dailyModifiers.down);
  return n(s.data.codeFacts.dailyModifiers.normal) || 1;
}
function spawnRawWeight(row, bandIndex, day, weekend) {
  const f = s.data.codeFacts, band = spawnBandData()[bandIndex];
  let weight = n(row[band.weightColumn]) * spawnDailyFactor(row, day);
  if (weekend && (f.weekendEligiblePlayerTypes || []).includes(band.playerType) && (f.weekendEligibleRarities || []).includes(row.Rarity)) weight *= n(f.weekendSpawnMultiplier);
  return weight;
}
function spawnClassDistribution(rows, bandIndex, day, weekend) {
  const f = s.data.codeFacts, band = spawnBandData()[bandIndex], raw = new Map();
  let total = 0;
  for (const row of rows) { const weight = spawnRawWeight(row, bandIndex, day, weekend); raw.set(String(row.ID), weight); total += weight; }
  const odds = new Map(rows.map(row => [String(row.ID), total > 0 ? (raw.get(String(row.ID)) || 0) / total : 0]));
  const guaranteeIds = new Set((f.guaranteeMythicIds || []).map(String));
  const replacedChance = rows.reduce((sum, row) => sum + (guaranteeIds.has(String(row.ID)) ? (odds.get(String(row.ID)) || 0) : 0), 0);
  if (replacedChance > 0) {
    for (const id of guaranteeIds) odds.set(id, 0);
    const legend = rows.filter(row => n(row.ID) <= n(f.petCount) && row.Rarity === "LEGENDARY");
    const replacementWeight = legend.reduce((sum, row) => sum + n(row[band.weightColumn]), 0);
    if (replacementWeight > 0) for (const row of legend) {
      const id = String(row.ID);
      odds.set(id, (odds.get(id) || 0) + replacedChance * n(row[band.weightColumn]) / replacementWeight);
    }
  }
  return odds;
}
function spawnQuotas() {
  const f = s.data.codeFacts, counts = s.spawnCounts.map(x => Math.max(0, Math.floor(Number(x) || 0)));
  const weights = f.paradePoolWeights || [2, 1.5, 1.2, 1, 1], denominator = counts.reduce((sum, count, i) => sum + count * weights[i], 0);
  if (!counts.some(Boolean) || denominator <= 0) return { counts, quotas: [0, 0, 0, 0, 0], players: counts.reduce((a, b) => a + b, 0) };
  const quotas = counts.map((count, i) => i < 4 ? Math.floor(count * weights[i] / denominator * n(f.paradePetsPerWave)) : 0);
  quotas[4] = n(f.paradePetsPerWave) - quotas.slice(0, 4).reduce((a, b) => a + b, 0);
  return { counts, quotas, players: counts.reduce((a, b) => a + b, 0) };
}
function spawnMixedOdds(rows, day, weekend, quotas) {
  const bands = spawnBandData(), mix = new Map(rows.map(row => [String(row.ID), 0]));
  const quotaTotal = quotas.reduce((a, b) => a + b, 0);
  if (!quotaTotal) return mix;
  bands.forEach((_, i) => {
    const share = quotas[i] / quotaTotal;
    if (!share) return;
    const odds = spawnClassDistribution(rows, i, day, weekend);
    for (const row of rows) mix.set(String(row.ID), (mix.get(String(row.ID)) || 0) + share * (odds.get(String(row.ID)) || 0));
  });
  return mix;
}
function probLabel(value) {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  const pct = value * 100;
  return pct < 0.001 ? "<0.001%" : pct < 0.1 ? pct.toFixed(3) + "%" : pct.toFixed(2) + "%";
}
function spawnPage() {
  const f = s.data.codeFacts, bands = spawnBandData(), rows = spawnCandidates(), dayNames = f.cycleDayNames || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const days = dayNames.map((name, i) => '<button type="button" class="day-chip ' + (s.spawnDay === i + 1 ? "selected" : "") + '" data-spawn-day="' + (i + 1) + '"><span>Day ' + (i + 1) + '</span><strong>' + esc(name.slice(0, 3)) + '</strong></button>').join("");
  const cohorts = bands.map((band, i) => '<label class="cohort-card"><span class="cohort-icon">' + actionIcon("RebirthIcon", "Rebirth") + '</span><span class="cohort-label"><strong>' + esc(band.label) + '</strong><small>Pool weight ' + esc(band.poolWeight) + '×</small></span><input class="cohort-input" type="number" min="0" max="6" step="1" id="spawn-count-' + i + '" value="' + esc(s.spawnCounts[i]) + '" aria-label="Player count for ' + esc(band.label) + '"></label>').join("");
  return head("ROAD SPAWN · INTERACTIVE MODEL", "Ngày + Rebirth quyết định pool pet", "Chỉnh ngày cycle, cờ Weekend Event và số người chơi theo Rebirth trong room để xem xác suất pet theo từng cohort và mix 60 slot.", pill(rows.length + " road candidates", "mint") + pill("Config model · không phải live telemetry", "amber")) +
    '<section class="spawn-hero"><div class="spawn-hero-mark">' + actionIcon("Road3DIcon", "Pet Parade road") + '</div><div><p class="eyebrow">PET PARADE · WEIGHTED POOL</p><h2>Mỗi pet icon bên dưới có tỷ lệ riêng theo config hiện tại.</h2><p>Ngày thay hệ số của pet thường; Rebirth của room quyết định tỷ trọng 5 cohort. Phần trăm là xác suất kỳ vọng sau khi ghép pool, không phải số đếm đã quan sát trong một ván.</p></div><div class="spawn-hero-stats"><strong>' + esc(rows.length) + '</strong><span>Pet ID trong road pool</span><strong>' + esc(f.paradePetsPerWave) + '</strong><span>slot mỗi lần dựng pool</span></div></section>' +
    '<section class="kpi-grid spawn-kpis">' + kpi("CYCLE DAYS", "7", "Day 1 = Monday · GMT cycle") + kpi("DAILY MODIFIER", "×" + f.dailyModifiers.up + " / " + f.dailyModifiers.normal + " / " + f.dailyModifiers.down, "UP / NORMAL / DOWN") + kpi("WEEKEND EVENT", "×" + f.weekendSpawnMultiplier, "chỉ cohort 3–5 · Legendary+") + kpi("PREPOOL", f.paradePoolMaxCount + " / cohort", "weighted sample trước khi ghép") + "</section>" +
    '<section class="panel spawn-control-panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("ActivitiesIcon", "Cycle day") + '1 · Chọn ngày cycle</h2><p class="panel-sub">DailyPoolConfigs map Day 1–7 sang Monday–Sunday; pet không có daily state dùng ×1.00.</p></div></div><div class="week-ribbon">' + days + '</div><div class="spawn-toggle-row"><label class="weekend-toggle"><input type="checkbox" id="spawn-weekend" ' + (s.spawnWeekend ? "checked" : "") + '><span class="toggle-visual"></span><span><strong>Weekend Event đang bật</strong><small>Mô phỏng cờ runtime CheckWeekendEventHour; không tự bật chỉ vì chọn Saturday/Sunday.</small></span></label><span class="weekend-rule">' + actionIcon("BoostSpawnIcon", "Spawn boost") + '×' + esc(f.weekendSpawnMultiplier) + ' cho Legendary / Mythic / Apex ở Type3–5</span></div></section>' +
    '<section class="panel spawn-control-panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("LeaderboardIcon", "Room players") + '2 · Thành phần player trong match</h2><p class="panel-sub">Số mặc định là ví dụ room 6 người; sửa từng cohort để khớp match muốn phân tích.</p></div><span class="tag">Editable scenario</span></div><div class="cohort-grid">' + cohorts + '</div><div class="room-hint">' + actionIcon("RebirthIcon", "Rebirth") + ' Bucket theo ngưỡng PetConfigs: 0–5 · 6–10 · 11–15 · 16–20 · 21+. Mỗi bucket có weight pet riêng và weight chia 60 slot theo số người chơi.</div></section>' +
    '<div id="spawn-analysis"></div>';
}
function renderSpawnAnalysis() {
  const root = document.getElementById("spawn-analysis");
  if (!root || !s.data) return;
  const f = s.data.codeFacts, bands = spawnBandData(), rows = spawnCandidates(), day = s.spawnDay, quotas = spawnQuotas(), weekend = !!s.spawnWeekend;
  const byId = new Map(rows.map(row => [String(row.ID), row]));
  const mixed = spawnMixedOdds(rows, day, weekend, quotas.quotas);
  const bandsOdds = bands.map((_, i) => spawnClassDistribution(rows, i, day, weekend));
  const quotaTotal = quotas.quotas.reduce((a, b) => a + b, 0);
  const totalWeight = quotas.counts.reduce((sum, count, i) => sum + count * (f.paradePoolWeights[i] || 0), 0);
  const quotaRows = bands.map((band, i) => '<div class="quota-row"><span class="quota-label"><b>' + esc(band.label) + '</b><small>' + quotas.counts[i] + ' player' + (quotas.counts[i] === 1 ? '' : 's') + ' · ' + esc(band.poolWeight) + '×</small></span><span class="quota-track"><i style="width:' + (quotas.quotas[i] / Math.max(1, f.paradePetsPerWave) * 100) + '%;--quota-color:' + ["#74d8b0", "#67c8dc", "#86aaff", "#b29af2", "#f0b76c"][i] + '"></i></span><strong>' + quotas.quotas[i] + '<small> / ' + f.paradePetsPerWave + '</small></strong></div>').join("");
  const dayRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "APEX"];
  const heatRows = dayRarities.map(rarityName => {
    const cells = (f.cycleDayNames || []).map((_, dayIndex) => {
      const byDay = spawnMixedOdds(rows, dayIndex + 1, weekend, quotas.quotas);
      const value = rows.filter(row => row.Rarity === rarityName).reduce((sum, row) => sum + (byDay.get(String(row.ID)) || 0), 0);
      const alpha = Math.min(.76, .10 + Math.sqrt(value) * 1.35);
      return '<td><span class="heat-cell ' + (day === dayIndex + 1 ? "current" : "") + '" style="--heat-color:' + (colors[rarityName] || "#82e0ba") + ';--heat-alpha:' + alpha.toFixed(2) + '">' + probLabel(value) + '</span></td>';
    }).join("");
    return '<tr><th>' + rarity(rarityName) + '</th>' + cells + '</tr>';
  }).join("");
  const q = s.spawnSearch.trim().toLowerCase();
  const sorted = rows.filter(row => !q || [row.ID, row.Name, row.Rarity].join(" ").toLowerCase().includes(q)).sort((a, b) => (mixed.get(String(b.ID)) || 0) - (mixed.get(String(a.ID)) || 0));
  const tableRows = sorted.map(row => {
    const state = n(row.ID) <= n(f.petCount) ? String(row["Day " + day] || "NORMAL").toUpperCase() : "DEFAULT";
    const modifier = spawnDailyFactor(row, day);
    return '<tr data-pet="' + esc(row.ID) + '" tabindex="0" role="button"><td class="pet-table-name"><span class="pet-name-cell">' + petImageHtml(row) + '<span><strong>' + esc(row.Name) + '</strong><small>#' + esc(row.ID) + '</small></span></span></td><td>' + rarity(row.Rarity) + '</td><td><span class="daily-state state-' + state.toLowerCase() + '">' + state + '</span><small class="modifier-label">×' + modifier.toFixed(2) + '</small></td>' + bandsOdds.map(odds => '<td class="num">' + probLabel(odds.get(String(row.ID)) || 0) + '</td>').join("") + '<td class="num room-prob">' + probLabel(mixed.get(String(row.ID)) || 0) + '</td><td class="num">' + ((mixed.get(String(row.ID)) || 0) * f.paradePetsPerWave).toFixed(3) + '</td></tr>';
  }).join("");
  const activeDay = (f.cycleDayNames || [])[day - 1] || "Day " + day;
  root.innerHTML = '<section class="spawn-results-grid"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("Road3DIcon", "Road pool") + 'Pool quota · ' + esc(activeDay) + '</h2><p class="panel-sub">Phân bổ 60 slot theo player count × pool weight; Type5 nhận phần dư sau floor.</p></div><strong class="pool-count">' + quotaTotal + '<small> / ' + f.paradePetsPerWave + ' slots</small></strong></div><div class="quota-list">' + quotaRows + '</div><div class="stacked-quota">' + bands.map((_, i) => '<i style="width:' + (quotas.quotas[i] / Math.max(1, f.paradePetsPerWave) * 100) + '%;--quota-color:' + ["#74d8b0", "#67c8dc", "#86aaff", "#b29af2", "#f0b76c"][i] + '"></i>').join("") + '</div><div class="quota-foot"><span>' + quotas.players + ' players</span><span>Σ count × weight = ' + totalWeight.toFixed(2) + '</span></div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Rarity theo weekday</h2><p class="panel-sub">Mix của room đang nhập · phần trăm mỗi lần rút từ pool.</p></div></div><div class="heatmap-wrap"><table class="spawn-heatmap"><thead><tr><th>Rarity</th>' + (f.cycleDayNames || []).map((name, i) => '<th class="' + (day === i + 1 ? "active-day" : "") + '">' + esc(name.slice(0, 3)) + '</th>').join("") + '</tr></thead><tbody>' + heatRows + '</tbody></table></div><div class="heat-legend"><span>Thấp</span><i></i><i></i><i></i><i></i><span>Cao</span></div></div></section>' +
    '<section class="panel spawn-pet-panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("CollectionIcon", "Pet collection") + 'Pet odds · ' + esc(activeDay) + (weekend ? ' · Weekend Event' : '') + '</h2><p class="panel-sub">Cột RB hiển thị tỷ lệ trong pool riêng; “Room %” là mix 60 slot. Pet Guarantee Mythic được chuyển sang Legendary theo rule runtime.</p></div></div><div class="filterbar spawn-filter"><label class="search-wrap"><input id="spawn-search" value="' + esc(s.spawnSearch) + '" placeholder="Tìm tên pet, ID hoặc rarity…" aria-label="Tìm pet trong road pool"></label><span class="small-count">' + sorted.length + ' / ' + rows.length + ' pet · click dòng để mở config</span></div><div class="table-wrap"><table class="spawn-pet-table"><thead><tr><th>Pet</th><th>Rarity</th><th>' + esc(activeDay) + '<br>State</th>' + bands.map(band => '<th class="num">' + esc(band.label) + '</th>').join("") + '<th class="num">Room %</th><th class="num">Kỳ vọng<br>/ 60</th></tr></thead><tbody>' + (tableRows || '<tr><td class="empty" colspan="10">Không có pet khớp từ khóa.</td></tr>') + '</tbody></table></div></section>' +
    '<section class="section-grid equal"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Cách đọc phép tính</h2><p class="panel-sub">Giữ nguyên quy tắc đang nằm trong checkout.</p></div></div><div class="spawn-method-list"><div><b>1</b><p><strong>Weight theo player Rebirth</strong>Pet.csv Weight1–5 tạo pool riêng cho RB 0–5, 6–10, 11–15, 16–20 và 21+; mỗi pool được chuẩn hóa riêng sau modifier.</p></div><div><b>2</b><p><strong>Modifier theo ngày</strong>UP nhân ×' + f.dailyModifiers.up + ', DOWN nhân ×' + f.dailyModifiers.down + '; NORMAL, SKIP và state trống dùng ×' + f.dailyModifiers.normal + '. Lucky Box dùng ×1 vì không có daily map.</p></div><div><b>3</b><p><strong>Weekend Event</strong>Chỉ Type3–5 và Legendary/Mythic/Apex được nhân ×' + f.weekendSpawnMultiplier + '; đây là cờ thời gian theo region, độc lập với ngày cycle đã chọn.</p></div><div><b>4</b><p><strong>Top-tier Mythic guarantee</strong>Pet Mythic có GuaranteeWeight dương bị thay thành pet Legendary được rút theo Rebirth weight khi pool 400 được tạo.</p></div><div><b>5</b><p><strong>Room %</strong>Σ (quota cohort ÷ 60 × xác suất pet trong pool cohort); “Kỳ vọng / 60” = Room % × 60.</p></div></div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Phạm vi & giới hạn cần nhớ</h2><p class="panel-sub">Chart mô phỏng công thức config, không mô phỏng lịch sử match.</p></div></div><div class="scope-note"><div>' + actionIcon("RebirthIcon", "Rebirth bands") + '<p>Checkout hiện tại dùng 5 Type1–Type5 theo ngưỡng RB trên. Tài liệu design có nhắc các pool S1–S7 New/Mid/Late; chart này bám theo PetParadeManager đã kiểm tra trong checkout.</p></div><div>' + actionIcon("LeaderboardIcon", "Room mix") + '<p>UpdateUsers cập nhật cohort khi join/quit; ' + (f.paradePoolsRefreshOnPlayerJoin ? 'lệnh UpdatePools được gọi ngay.' : 'lệnh UpdatePools đang comment nên cohort mới có thể chưa áp dụng tới lần rebuild pool.') + '</p></div><div>' + actionIcon("Road3DIcon", "Spawn pool") + '<p>Mỗi cohort sinh prepool ' + f.paradePoolMaxCount + ' pet rồi ghép quota. Kết quả hiển thị là kỳ vọng; pool hữu hạn sẽ dao động quanh tỷ lệ này.</p></div><div>' + actionIcon("ActivitiesIcon", "Day cycle") + '<p>Regular GetPetRandomID dùng Rebirth weights nhưng không đọc DailyPoolConfigs. Ngày × Rebirth trong trang này chỉ áp dụng đường Pet Parade.</p></div></div></div></section>' +
    (quotas.players > 6 ? note("Scenario có hơn 6 người", "Room mặc định minh họa 6 người. Giảm cohort để mô phỏng giới hạn room chuẩn; hiện đang tính theo số bạn nhập.", "Editable scenario", "review") : "") +
    (!quotaTotal ? note("Chưa có player trong scenario", "Nhập số player cho ít nhất một bucket Rebirth để dựng mix 60 slot.", "PetParadeManager.GetPetsCount", "info") : "");
}
function updateSpawnAnalysis() { renderSpawnAnalysis(); }

document.addEventListener("click", event => {
  const day = event.target.closest("[data-spawn-day]");
  if (!day) return;
  s.spawnDay = Number(day.dataset.spawnDay);
  document.querySelectorAll("[data-spawn-day]").forEach(button => button.classList.toggle("selected", Number(button.dataset.spawnDay) === s.spawnDay));
  renderSpawnAnalysis();
});
document.addEventListener("input", event => {
  if (event.target.id === "spawn-search") { s.spawnSearch = event.target.value; renderSpawnAnalysis(); return; }
  const count = event.target.id?.match(/^spawn-count-(\d)$/);
  if (count) { s.spawnCounts[Number(count[1])] = Math.min(6, Math.max(0, Math.floor(Number(event.target.value) || 0))); renderSpawnAnalysis(); }
});
document.addEventListener("change", event => {
  if (event.target.id === "spawn-weekend") { s.spawnWeekend = event.target.checked; renderSpawnAnalysis(); }
});
