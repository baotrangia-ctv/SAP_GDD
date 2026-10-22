"use strict";

if (!Array.isArray(s.spawnPlayerRebirths) || s.spawnPlayerRebirths.length !== 6) s.spawnPlayerRebirths = [2, 3, 7, 12, 17, 22];
if (!Array.isArray(s.spawnPlayerActive) || s.spawnPlayerActive.length !== 6) s.spawnPlayerActive = [true, true, true, true, true, true];
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
function spawnBandIndexForRebirth(rebirth) {
  const value = Math.max(0, Math.floor(Number(rebirth) || 0)), bands = spawnBandData();
  const index = bands.findIndex(band => value >= n(band.min) && (band.max === null || band.max === undefined || value <= n(band.max)));
  return index >= 0 ? index : Math.max(0, bands.length - 1);
}
function spawnPlayerCounts() {
  const counts = spawnBandData().map(() => 0);
  s.spawnPlayerRebirths.forEach((rebirth, index) => {
    if (s.spawnPlayerActive[index] === false) return;
    const bandIndex = spawnBandIndexForRebirth(rebirth);
    if (bandIndex >= 0) counts[bandIndex] += 1;
  });
  return counts;
}
function spawnCompositionText() {
  const bands = spawnBandData(), counts = spawnPlayerCounts();
  return bands.map((band, index) => band.label + " · " + counts[index]).join("   /   ");
}
function updateSpawnPlayerControls() {
  const bands = spawnBandData();
  s.spawnPlayerRebirths.forEach((rebirth, index) => {
    const active = s.spawnPlayerActive[index] !== false;
    const band = bands[spawnBandIndexForRebirth(rebirth)];
    const card = document.getElementById("spawn-player-card-" + index);
    const input = document.getElementById("spawn-rb-" + index);
    const label = document.getElementById("spawn-player-band-" + index);
    if (card) card.classList.toggle("inactive", !active);
    if (input) input.disabled = !active;
    if (label) label.textContent = active && band ? band.label + " · pool weight " + band.poolWeight + "×" : "Ngoài match";
  });
  const total = s.spawnPlayerActive.filter(active => active !== false).length;
  const roomLabel = document.getElementById("spawn-room-summary");
  const composition = document.getElementById("spawn-player-composition");
  if (roomLabel) roomLabel.textContent = total + " / 6 player trong match";
  if (composition) composition.textContent = spawnCompositionText();
}
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
  const f = s.data.codeFacts, counts = spawnPlayerCounts();
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
  const players = s.spawnPlayerRebirths.map((rebirth, i) => {
    const active = s.spawnPlayerActive[i] !== false, band = bands[spawnBandIndexForRebirth(rebirth)];
    return '<div class="spawn-player-card ' + (active ? "" : "inactive") + '" id="spawn-player-card-' + i + '"><div class="spawn-player-head"><label class="spawn-player-toggle"><input type="checkbox" id="spawn-player-active-' + i + '" ' + (active ? "checked" : "") + '><span class="toggle-visual" aria-hidden="true"></span><strong>Player ' + (i + 1) + '</strong></label><span class="spawn-player-seat">' + String(i + 1).padStart(2, "0") + '</span></div><label class="spawn-level-field"><span>Rebirth level</span><span class="spawn-level-input-wrap"><b>RB</b><input type="number" min="0" step="1" id="spawn-rb-' + i + '" value="' + esc(rebirth) + '" ' + (active ? "" : "disabled") + ' aria-label="Rebirth level of player ' + (i + 1) + '"></span></label><small id="spawn-player-band-' + i + '">' + esc(active && band ? band.label + " · pool weight " + band.poolWeight + "×" : "Ngoài match") + '</small></div>';
  }).join("");
  const counts = spawnPlayerCounts();
  return head("ROAD SPAWN · INTERACTIVE MODEL", "Xác suất pet theo Rebirth từng người chơi", "Chọn ngày cycle và nhập Rebirth cho từng slot trong match. Lab tự phân cohort rồi tính xác suất mỗi pet trong mix của 60 slot.", pill(rows.length + " road candidates", "mint") + pill("Config model · không phải live telemetry", "amber")) +
    '<section class="spawn-hero"><div class="spawn-hero-mark">' + actionIcon("Road3DIcon", "Pet Parade road") + '</div><div><p class="eyebrow">PET PARADE · WEIGHTED POOL</p><h2>Mỗi pet có tỷ lệ riêng cho match bạn vừa cấu hình.</h2><p>Chỉnh Rebirth ở sáu slot người chơi và ngày cycle để xem xác suất theo từng pool cùng xác suất tổng hợp của match. Các tỷ lệ là kỳ vọng theo config, không phải số đếm quan sát trong một ván.</p></div><div class="spawn-hero-stats"><strong>' + esc(rows.length) + '</strong><span>Pet ID trong road pool</span><strong>' + esc(f.paradePetsPerWave) + '</strong><span>slot mỗi lần dựng pool</span></div></section>' +
    '<section class="kpi-grid spawn-kpis">' + kpi("CYCLE DAYS", "7", "Day 1 = Monday · GMT cycle") + kpi("DAILY MODIFIER", "×" + f.dailyModifiers.up + " / " + f.dailyModifiers.normal + " / " + f.dailyModifiers.down, "UP / NORMAL / DOWN") + kpi("WEEKEND EVENT", "×" + f.weekendSpawnMultiplier, "chỉ cohort 3–5 · Legendary+") + kpi("PREPOOL", f.paradePoolMaxCount + " / cohort", "weighted sample trước khi ghép") + "</section>" +
    '<section class="panel spawn-control-panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("ActivitiesIcon", "Cycle day") + '1 · Chọn ngày cycle</h2><p class="panel-sub">DailyPoolConfigs map Day 1–7 sang Monday–Sunday; pet không có daily state dùng ×1.00.</p></div></div><div class="week-ribbon">' + days + '</div><div class="spawn-toggle-row"><label class="weekend-toggle"><input type="checkbox" id="spawn-weekend" ' + (s.spawnWeekend ? "checked" : "") + '><span class="toggle-visual"></span><span><strong>Weekend Event đang bật</strong><small>Mô phỏng cờ runtime CheckWeekendEventHour; không tự bật chỉ vì chọn Saturday/Sunday.</small></span></label><span class="weekend-rule">' + actionIcon("BoostSpawnIcon", "Spawn boost") + '×' + esc(f.weekendSpawnMultiplier) + ' cho Legendary / Mythic / Apex ở Type3–5</span></div></section>' +
    '<section class="panel spawn-control-panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("LeaderboardIcon", "Room players") + '2 · Rebirth của player trong match</h2><p class="panel-sub">Nhập đúng RB cho từng slot; bỏ chọn slot để mô phỏng match chưa đủ người. Pool weight và quota được tính tự động.</p></div><button type="button" class="panel-link" data-spawn-reset>Reset sample room</button></div><div class="spawn-player-grid">' + players + '</div><div class="room-hint">' + actionIcon("RebirthIcon", "Rebirth buckets") + '<span><strong id="spawn-room-summary">' + counts.reduce((a, b) => a + b, 0) + ' / 6 player trong match</strong><small id="spawn-player-composition">' + esc(spawnCompositionText()) + '</small></span></div></section>' +
    '<div id="spawn-analysis"></div>';
}
function renderSpawnAnalysis() {
  const root = document.getElementById("spawn-analysis");
  if (!root || !s.data) return;
  const f = s.data.codeFacts, bands = spawnBandData(), rows = spawnCandidates(), day = s.spawnDay, quotas = spawnQuotas(), weekend = !!s.spawnWeekend;
  const byId = new Map(rows.map(row => [String(row.ID), row]));
  const mixed = spawnMixedOdds(rows, day, weekend, quotas.quotas);
  const bandsOdds = bands.map((_, i) => spawnClassDistribution(rows, i, day, weekend));
  const maxMatchChance = Math.max(0, ...Array.from(mixed.values()));
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
  const rarityOrder = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "APEX"];
  const filtered = rows.filter(row => !q || [row.ID, row.Name, row.Rarity, row.Rank].join(" ").toLowerCase().includes(q));
  const sorted = filtered.sort((a, b) => {
    const rarityDiff = rarityOrder.indexOf(a.Rarity) - rarityOrder.indexOf(b.Rarity);
    return rarityDiff || n(a.Rank) - n(b.Rank) || n(a.ID) - n(b.ID);
  });
  const tableColumnCount = bands.length + 5;
  const renderPetRow = row => {
    const state = n(row.ID) <= n(f.petCount) ? String(row["Day " + day] || "NORMAL").toUpperCase() : "DEFAULT";
    const modifier = spawnDailyFactor(row, day);
    const matchChance = mixed.get(String(row.ID)) || 0, meterWidth = maxMatchChance > 0 ? matchChance / maxMatchChance * 100 : 0;
    return '<tr data-pet="' + esc(row.ID) + '" tabindex="0" role="button"><td class="pet-table-name"><span class="pet-name-cell">' + petImageHtml(row) + '<span><strong>' + esc(row.Name) + '</strong><small>Rank ' + esc(row.Rank || "—") + ' · ID #' + esc(row.ID) + '</small></span></span></td><td>' + rarity(row.Rarity) + '</td><td><span class="daily-state state-' + state.toLowerCase() + '">' + state + '</span><small class="modifier-label">×' + modifier.toFixed(2) + '</small></td>' + bandsOdds.map(odds => '<td class="num">' + probLabel(odds.get(String(row.ID)) || 0) + '</td>').join("") + '<td class="match-prob-cell"><span class="match-prob-meter" aria-hidden="true"><i style="width:' + meterWidth.toFixed(2) + '%"></i></span><strong class="room-prob">' + probLabel(matchChance) + '</strong></td><td class="num">' + (matchChance * f.paradePetsPerWave).toFixed(3) + '</td></tr>';
  };
  const tableRows = rarityOrder.map(rarityName => {
    const group = sorted.filter(row => row.Rarity === rarityName);
    if (!group.length) return "";
    const ranks = group.map(row => n(row.Rank));
    return '<tr class="spawn-rarity-group"><th colspan="' + tableColumnCount + '" scope="rowgroup"><span class="spawn-rarity-heading">' + rarity(rarityName) + '<small>' + group.length + ' pet · Rank ' + Math.min(...ranks) + '–' + Math.max(...ranks) + '</small></span></th></tr>' + group.map(renderPetRow).join("");
  }).join("");
  const activeDay = (f.cycleDayNames || [])[day - 1] || "Day " + day;
  root.innerHTML = '<section class="spawn-results-grid"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("Road3DIcon", "Road pool") + 'Pool quota · ' + esc(activeDay) + '</h2><p class="panel-sub">Phân bổ 60 slot theo player count × pool weight; Type5 nhận phần dư sau floor.</p></div><strong class="pool-count">' + quotaTotal + '<small> / ' + f.paradePetsPerWave + ' slots</small></strong></div><div class="quota-list">' + quotaRows + '</div><div class="stacked-quota">' + bands.map((_, i) => '<i style="width:' + (quotas.quotas[i] / Math.max(1, f.paradePetsPerWave) * 100) + '%;--quota-color:' + ["#74d8b0", "#67c8dc", "#86aaff", "#b29af2", "#f0b76c"][i] + '"></i>').join("") + '</div><div class="quota-foot"><span>' + quotas.players + ' players</span><span>Σ count × weight = ' + totalWeight.toFixed(2) + '</span></div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Rarity theo weekday</h2><p class="panel-sub">Mix của room đang nhập · phần trăm mỗi lần rút từ pool.</p></div></div><div class="heatmap-wrap"><table class="spawn-heatmap"><thead><tr><th>Rarity</th>' + (f.cycleDayNames || []).map((name, i) => '<th class="' + (day === i + 1 ? "active-day" : "") + '">' + esc(name.slice(0, 3)) + '</th>').join("") + '</tr></thead><tbody>' + heatRows + '</tbody></table></div><div class="heat-legend"><span>Thấp</span><i></i><i></i><i></i><i></i><span>Cao</span></div></div></section>' +
    '<section class="panel spawn-pet-panel"><div class="panel-head"><div><h2 class="panel-title">' + actionIcon("CollectionIcon", "Pet collection") + 'Pet odds · ' + esc(activeDay) + (weekend ? ' · Weekend Event' : '') + '</h2><p class="panel-sub">Nhóm theo rarity từ thấp đến cao; trong mỗi cụm sắp theo Rank tăng dần. Tỷ lệ vẫn hiển thị riêng cho từng pet và theo mix của match.</p></div></div><div class="filterbar spawn-filter"><label class="search-wrap"><input id="spawn-search" value="' + esc(s.spawnSearch) + '" placeholder="Tìm tên pet, ID, rank hoặc rarity…" aria-label="Tìm pet trong road pool"></label><span class="small-count">' + sorted.length + ' / ' + rows.length + ' pet · click dòng để mở config</span></div><div class="table-wrap"><table class="spawn-pet-table"><thead><tr><th>Pet</th><th>Rarity</th><th>' + esc(activeDay) + '<br>State</th>' + bands.map((band, i) => '<th class="num">' + esc(band.label) + '<small class="spawn-band-count">' + quotas.counts[i] + ' player' + (quotas.counts[i] === 1 ? '' : 's') + '</small></th>').join("") + '<th class="num">Match %</th><th class="num">Kỳ vọng<br>/ 60</th></tr></thead><tbody>' + (tableRows || '<tr><td class="empty" colspan="' + tableColumnCount + '">Không có pet khớp từ khóa.</td></tr>') + '</tbody></table></div></section>' +
    '<section class="section-grid equal"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Cách đọc phép tính</h2><p class="panel-sub">Giữ nguyên quy tắc đang nằm trong checkout.</p></div></div><div class="spawn-method-list"><div><b>1</b><p><strong>Weight theo player Rebirth</strong>Pet.csv Weight1–5 tạo pool riêng cho RB 0–5, 6–10, 11–15, 16–20 và 21+; mỗi pool được chuẩn hóa riêng sau modifier.</p></div><div><b>2</b><p><strong>Modifier theo ngày</strong>UP nhân ×' + f.dailyModifiers.up + ', DOWN nhân ×' + f.dailyModifiers.down + '; NORMAL, SKIP và state trống dùng ×' + f.dailyModifiers.normal + '. Lucky Box dùng ×1 vì không có daily map.</p></div><div><b>3</b><p><strong>Weekend Event</strong>Chỉ Type3–5 và Legendary/Mythic/Apex được nhân ×' + f.weekendSpawnMultiplier + '; đây là cờ thời gian theo region, độc lập với ngày cycle đã chọn.</p></div><div><b>4</b><p><strong>Top-tier Mythic guarantee</strong>Pet Mythic có GuaranteeWeight dương bị thay thành pet Legendary được rút theo Rebirth weight khi pool 400 được tạo.</p></div><div><b>5</b><p><strong>Match %</strong>Σ (quota cohort ÷ 60 × xác suất pet trong pool cohort); “Kỳ vọng / 60” = Match % × 60.</p></div></div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Phạm vi & giới hạn cần nhớ</h2><p class="panel-sub">Chart mô phỏng công thức config, không mô phỏng lịch sử match.</p></div></div><div class="scope-note"><div>' + actionIcon("RebirthIcon", "Rebirth bands") + '<p>Checkout hiện tại dùng 5 Type1–Type5 theo ngưỡng RB trên. Tài liệu design có nhắc các pool S1–S7 New/Mid/Late; chart này bám theo PetParadeManager đã kiểm tra trong checkout.</p></div><div>' + actionIcon("LeaderboardIcon", "Room mix") + '<p>UpdateUsers cập nhật cohort khi join/quit; ' + (f.paradePoolsRefreshOnPlayerJoin ? 'lệnh UpdatePools được gọi ngay.' : 'lệnh UpdatePools đang comment nên cohort mới có thể chưa áp dụng tới lần rebuild pool.') + '</p></div><div>' + actionIcon("Road3DIcon", "Spawn pool") + '<p>Mỗi cohort sinh prepool ' + f.paradePoolMaxCount + ' pet rồi ghép quota. Type5 nhận toàn bộ phần slot còn lại sau khi Type1–4 được floor, đúng theo GetPetsCount trong runtime. Kết quả hiển thị là kỳ vọng; pool hữu hạn sẽ dao động quanh tỷ lệ này.</p></div><div>' + actionIcon("ActivitiesIcon", "Day cycle") + '<p>Regular GetPetRandomID dùng Rebirth weights nhưng không đọc DailyPoolConfigs. Ngày × Rebirth trong trang này chỉ áp dụng đường Pet Parade.</p></div></div></div></section>' +
    (!quotaTotal ? note("Chưa có player trong scenario", "Nhập số player cho ít nhất một bucket Rebirth để dựng mix 60 slot.", "PetParadeManager.GetPetsCount", "info") : "");
}
function updateSpawnAnalysis() { renderSpawnAnalysis(); }

document.addEventListener("click", event => {
  if (event.target.closest("[data-spawn-reset]")) {
    s.spawnPlayerRebirths = [2, 3, 7, 12, 17, 22];
    s.spawnPlayerActive = [true, true, true, true, true, true];
    s.spawnPlayerRebirths.forEach((rebirth, index) => {
      const input = document.getElementById("spawn-rb-" + index);
      const checkbox = document.getElementById("spawn-player-active-" + index);
      if (input) input.value = rebirth;
      if (checkbox) checkbox.checked = true;
    });
    updateSpawnPlayerControls();
    renderSpawnAnalysis();
    return;
  }
  const day = event.target.closest("[data-spawn-day]");
  if (!day) return;
  s.spawnDay = Number(day.dataset.spawnDay);
  document.querySelectorAll("[data-spawn-day]").forEach(button => button.classList.toggle("selected", Number(button.dataset.spawnDay) === s.spawnDay));
  renderSpawnAnalysis();
});
document.addEventListener("input", event => {
  if (event.target.id === "spawn-search") { s.spawnSearch = event.target.value; renderSpawnAnalysis(); return; }
  const player = event.target.id?.match(/^spawn-rb-(\d)$/);
  if (player) { s.spawnPlayerRebirths[Number(player[1])] = Math.max(0, Math.floor(Number(event.target.value) || 0)); updateSpawnPlayerControls(); renderSpawnAnalysis(); }
});
document.addEventListener("change", event => {
  if (event.target.id === "spawn-weekend") { s.spawnWeekend = event.target.checked; renderSpawnAnalysis(); }
  const player = event.target.id?.match(/^spawn-player-active-(\d)$/);
  if (player) { s.spawnPlayerActive[Number(player[1])] = event.target.checked; updateSpawnPlayerControls(); renderSpawnAnalysis(); }
});
