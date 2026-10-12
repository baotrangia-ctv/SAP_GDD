"use strict";

Object.assign(pages, { mutagen: "Mutagen", weatherdrop: "Weather Drop", luckybox: "Lucky Box" });

if (s.mutagenTarget === undefined) s.mutagenTarget = "COMMON";
if (s.mutagenSecret === undefined) s.mutagenSecret = false;
if (!s.mutagenLevel) s.mutagenLevel = 1;
if (s.weatherTarget === undefined) s.weatherTarget = "COMMON";
if (s.weatherSecret === undefined) s.weatherSecret = false;
if (!s.luckyBoxId) s.luckyBoxId = "60001";
if (!s.luckyBoxSearch) s.luckyBoxSearch = "";
if (!s.luckyBoxRarity) s.luckyBoxRarity = "all";

const systemRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "APEX", "LIMITED"];
const systemTierRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "APEX", "LIMITED"];
const systemPetRow = id => t("Pet.csv").rows.find(row => row.ID === String(id));
const systemEffectRow = id => t("weatherEffects.csv").rows.find(row => row.ID === String(id));
const systemMutationRow = id => t("mutation.csv").rows.find(row => row.ID === String(id));
const systemPct = value => {
  const percent = Number(value) * 100;
  const digits = percent === 0 ? 0 : percent >= 1 ? 2 : percent >= 0.1 ? 3 : percent >= 0.01 ? 4 : 6;
  return percent.toLocaleString("vi-VN", { maximumFractionDigits: digits }) + "%";
};
const systemNum = value => Number(value || 0).toLocaleString("en-US");
const systemOptions = (values, selected) => values.map(value => '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? " selected" : "") + '>' + esc(pretty(value)) + "</option>").join("");
const systemColor = rarityName => colors[rarityName] || "#82e0ba";

function systemChance(basePercent, rules, petRarity, isSecret) {
  const factors = rules?.rarityMultiplier || {};
  const raw = Number(basePercent) / 100 * (Number(factors[petRarity]) || 1) * (isSecret ? Number(rules?.secretMultiplier) || 1 : 1);
  return Math.min(Number(rules?.max) || 0.75, Math.max(Number(rules?.min) || 0.02, raw));
}

function systemControls(label, id, options, selected) {
  return '<label class="system-control"><span>' + esc(label) + '</span><select id="' + esc(id) + '">' + systemOptions(options, selected) + "</select></label>";
}

function mutagenPage() {
  const rows = t("Mutagen.csv").rows;
  const rules = s.data.codeFacts.mutagenChanceRules || {};
  const unlock = s.data.codeFacts.featureUnlocks?.find(item => item.features.includes("MUTAGEN"))?.rebirth;
  return head("ITEM SYSTEMS · MUTAGEN", "Mutagen", "Xem mutation được chọn, rarity của Mutagen, xác suất thành công sau modifier của pet và chi phí theo rank.", pill(rows.length + " configs") + pill("Read-only balance view", "amber")) +
    '<section class="kpi-grid">' +
    kpi("CONFIG ROWS", rows.length, "Mutagen.csv · 9 mutation × rarity tiers") +
    kpi("USE CHANCE CAP", systemPct(rules.min || 0.02) + "–" + systemPct(rules.max || 0.75), "Min / max áp dụng ở runtime") +
    kpi("PET LEVEL COST", (rules.levelMultiplier || 1.04) + "×", "Cost nhân theo mỗi level trên Lv1") +
    kpi("FEATURE UNLOCK", unlock == null ? "—" : "RB " + unlock, "FeatureUnlockConfigs") +
    '</section>' +
    '<section class="panel system-controls-panel"><div class="panel-head"><div><h2 class="panel-title">Thử xác suất dùng Mutagen</h2><p class="panel-sub">Điều chỉnh pet mục tiêu để xem Chance cấu hình đổi thế nào sau rarity multiplier và secret factor.</p></div></div><div class="system-controls">' +
    systemControls("Rarity của pet", "mutagen-target-rarity", systemRarities, s.mutagenTarget) +
    '<label class="system-check"><input type="checkbox" id="mutagen-secret"' + (s.mutagenSecret ? " checked" : "") + '><span>Secret Fusion pet</span></label>' +
    '<label class="system-control system-level-control"><span>Pet level</span><input id="mutagen-level" type="number" min="1" max="1000" value="' + esc(s.mutagenLevel) + '"></label>' +
    '</div><p class="inline-note" id="mutagen-cost-factor"></p></section>' +
    '<div id="mutagen-analysis"></div>';
}

function updateMutagenPage() {
  const root = document.getElementById("mutagen-analysis");
  if (!root) return;
  const rows = t("Mutagen.csv").rows;
  const mutations = t("mutation.csv").rows;
  const rules = s.data.codeFacts.mutagenChanceRules || {};
  const targetPetRarity = document.getElementById("mutagen-target-rarity")?.value || s.mutagenTarget;
  const isSecret = !!document.getElementById("mutagen-secret")?.checked;
  const level = Math.max(1, Math.min(1000, Math.floor(n(document.getElementById("mutagen-level")?.value) || 1)));
  s.mutagenTarget = targetPetRarity;
  s.mutagenSecret = isSecret;
  s.mutagenLevel = level;
  const costFactor = Math.pow(Number(rules.levelMultiplier) || 1.04, level - 1) * (Number(rules.useCostMultiplier) || 1);
  const costLabel = document.getElementById("mutagen-cost-factor");
  if (costLabel) costLabel.textContent = 'Pet Lv' + level + ': chi phí dùng = base cost theo Rank × ' + costFactor.toFixed(3) + ' (1.04^(Lv−1)). Bảng MutateCost là cost-rank value đầu vào; site không quy đổi thành số coin cuối cùng.';

  const rarityOrder = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3, MYTHIC: 4, APEX: 5, LIMITED: 6 };
  const grouped = new Map();
  for (const row of rows) {
    const mutation = systemMutationRow(row.Mutation) || { Name: "Mutation " + row.Mutation, Tier: "" };
    if (!grouped.has(row.Mutation)) grouped.set(row.Mutation, { mutation, cells: {} });
    grouped.get(row.Mutation).cells[row.Rarity] = row;
  }
  const matrix = [...grouped.values()].sort((a, b) => n(a.mutation.Tier) - n(b.mutation.Tier) || a.mutation.Name.localeCompare(b.mutation.Name)).map(group => {
    const cells = ["COMMON", "RARE", "EPIC"].map(tier => {
      const row = group.cells[tier];
      if (!row) return '<td><span class="empty-cell">—</span></td>';
      const chance = systemChance(row.Chance, rules, targetPetRarity, isSecret);
      const pct = chance * 100;
      return '<td><div class="system-chance-cell"><div><strong>' + systemPct(chance) + '</strong><small>Base ' + esc(row.Chance) + '% · ID ' + esc(row.ID) + '</small></div><span class="system-bar"><i style="width:' + Math.min(100, pct / 0.75) + '%;--bar-color:' + systemColor(tier) + '"></i></span></div></td>';
    }).join("");
    return '<tr><td><span class="system-name-cell"><span class="system-name-mark">✧</span><span><strong>' + esc(group.mutation.Name) + '</strong><small>Tier ' + esc(group.mutation.Tier || "—") + ' · multiplier ' + esc(group.mutation.Multiplier || "—") + '×</small></span></span></td>' + cells + '</tr>';
  }).join("");
  const mutateCosts = t("MutateCost.csv").rows;
  const costRows = mutateCosts.map(row => '<tr><td>' + esc(row.RankMin) + '–' + esc(row.RankMax) + '</td><td class="num">' + esc(systemNum(row.Cost)) + '</td><td class="num">' + esc((costFactor).toFixed(2)) + '×</td></tr>').join("");
  root.innerHTML = '<section class="section-grid system-section-grid"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Tỉ lệ theo mutation × rarity của item</h2><p class="panel-sub">Mỗi ô là xác suất thành công cuối cho pet ' + esc(pretty(targetPetRarity)) + (isSecret ? ' · Secret Fusion' : '') + '.</p></div><span class="tag">' + esc(rows.length) + ' rows</span></div><div class="table-wrap"><table class="system-matrix"><thead><tr><th>Mutation</th><th>Mutagen · Common</th><th>Rare</th><th>Epic</th></tr></thead><tbody>' + matrix + '</tbody></table></div></div>' +
    '<div class="panel"><div class="panel-head"><div><h2 class="panel-title">Cost theo pet rank</h2><p class="panel-sub">Giá trị đầu vào từ MutateCost.csv; level multiplier lấy từ MutagenConfigs.</p></div></div><div class="table-wrap"><table class="system-compact-table"><thead><tr><th>Pet rank</th><th class="num">Base cost</th><th class="num">At Lv' + level + '</th></tr></thead><tbody>' + costRows + '</tbody></table></div><div class="system-footnote">MUTAGEN_USE_COST_MULTIPLIER = ' + esc(rules.useCostMultiplier || 1) + '× · secret giảm chance theo ×' + esc(rules.secretMultiplier || 0.55) + '× trước khi clamp.</div></div></section>' +
    '<section class="panel system-explain"><div class="system-rule-line"><strong>Công thức runtime</strong><span>clamp(Chance ÷ 100 × PetRarityMultiplier × SecretMultiplier, ' + systemPct(rules.min || 0.02) + ', ' + systemPct(rules.max || 0.75) + ')</span></div><div class="system-rarity-factors">' + systemRarities.map(name => '<span>' + rarity(name) + '<b>×' + esc(rules.rarityMultiplier?.[name] ?? "—") + '</b></span>').join("") + '</div><p class="system-footnote">Chance trong Mutagen.csv là xác suất nền theo mutagen type. Hệ số bên trên áp lên rarity của pet đang mutate; rarity chip trong bảng là rarity của item Mutagen.</p></section>';
}

function weatherDropPage() {
  const rows = t("WeatherGen.csv").rows;
  const effects = t("weatherEffects.csv").rows;
  const facts = s.data.codeFacts;
  const unlock = facts.featureUnlocks?.find(item => item.features.includes("WEATHER_DROP"))?.rebirth;
  return head("ITEM SYSTEMS · WEATHER DROP", "Weather Drop / Weathergen", "Tách rõ tỉ lệ dùng WeatherGen lên pet với xác suất effect tự xuất hiện khi weather đang chạy; xem thêm lịch weather theo wave.", pill(rows.length + " Weathergen configs") + pill(effects.length + " weather effects")) +
    '<section class="kpi-grid">' +
    kpi("WEATHERGEN ROWS", rows.length, "Chance theo effect và rarity item") +
    kpi("WEATHER EFFECTS", effects.length, "weatherEffects.csv · world weather") +
    kpi("WEATHER CYCLE", (facts.weatherCycleMinutesFromTable || 0) + " phút", "Duration đã đổi sang phút theo WeatherConfigs") +
    kpi("FEATURE UNLOCK", unlock == null ? "—" : "RB " + unlock, "Weather Drop feature gate") +
    '</section>' +
    '<section class="panel system-controls-panel"><div class="panel-head"><div><h2 class="panel-title">Tỉ lệ dùng WeatherGen lên pet</h2><p class="panel-sub">Chance từ WeatherGen.csv được điều chỉnh theo rarity của pet và Secret Fusion multiplier.</p></div></div><div class="system-controls">' +
    systemControls("Rarity của pet", "weather-target-rarity", systemRarities, s.weatherTarget) +
    '<label class="system-check"><input type="checkbox" id="weather-secret"' + (s.weatherSecret ? " checked" : "") + '><span>Secret Fusion pet</span></label>' +
    '</div></section>' +
    '<div id="weather-drop-analysis"></div>';
}

function updateWeatherDropPage() {
  const root = document.getElementById("weather-drop-analysis");
  if (!root) return;
  const facts = s.data.codeFacts;
  const rules = facts.weatherGenChanceRules || {};
  const targetPetRarity = document.getElementById("weather-target-rarity")?.value || s.weatherTarget;
  const isSecret = !!document.getElementById("weather-secret")?.checked;
  s.weatherTarget = targetPetRarity;
  s.weatherSecret = isSecret;
  const effects = t("weatherEffects.csv").rows;
  const effectById = new Map(effects.map(row => [String(row.ID), row]));
  const gens = t("WeatherGen.csv").rows.map(row => ({ ...row, effect: effectById.get(String(row.WeatherEffect)), final: systemChance(row.Chance, rules, targetPetRarity, isSecret) }))
    .sort((a, b) => n(a.WeatherEffect) - n(b.WeatherEffect) || systemTierRarities.indexOf(a.Rarity) - systemTierRarities.indexOf(b.Rarity));
  const unmappedWeatherGenEffects = [...new Set(gens.filter(row => !row.effect).map(row => String(row.WeatherEffect)))];
  const weatherGenMappingNote = unmappedWeatherGenEffects.length ? '<div class="callout review system-mapping-note"><div class="callout-title">Effect mapping cần đối chiếu</div><p>WeatherGen.csv có WeatherEffect ID ' + esc(unmappedWeatherGenEffects.join(", ")) + ', nhưng các ID này không có dòng tương ứng trong weatherEffects.csv snapshot.</p><span class="source-ref">WeatherGen.csv · weatherEffects.csv</span></div>' : "";
  const genRows = gens.map(row => '<tr><td class="mono">' + esc(row.ID) + '</td><td><span class="system-name-cell"><span class="weather-mark">☂</span><span><strong>' + esc(row.effect?.Name || ("Effect " + row.WeatherEffect)) + '</strong><small>Weather effect ' + esc(row.WeatherEffect) + '</small></span></span></td><td>' + rarity(row.Rarity) + '</td><td class="num">' + esc(row.Chance) + '%</td><td class="num system-final-chance">' + systemPct(row.final) + '</td><td><span class="system-bar"><i style="width:' + Math.min(100, row.final * 100 / 0.75) + '%;--bar-color:' + systemColor(row.Rarity) + '"></i></span></td></tr>').join("");

  const weatherById = new Map(t("weather.csv").rows.map(row => [String(row.ID), row]));
  const effectNameById = new Map(effects.map(row => [String(row.ID), row.Name]));
  const waves = t("weatherWaves.csv").rows.slice().sort((a, b) => n(a.ID) - n(b.ID));
  const totalMinutes = waves.reduce((sum, row) => sum + n(row.Duration), 0);
  const weatherColors = ["#63c8d5", "#7bb5ff", "#b39aff", "#cf8cff", "#8dd6a5", "#f6c568", "#ee9275", "#78d9ca", "#dbe6f7", "#7fa9e2", "#d9a8ee"];
  let elapsed = 0;
  const segmentHtml = waves.map((row, index) => {
    const weather = weatherById.get(String(row.WeatherType));
    const name = weather?.Name || (n(row.WeatherType) === 0 ? "Clear" : "Weather " + row.WeatherType);
    const start = elapsed;
    elapsed += n(row.Duration);
    return '<span class="weather-cycle-segment" title="Wave ' + esc(row.ID) + ' · ' + esc(name) + ' · ' + start + '–' + elapsed + ' min" style="width:' + (n(row.Duration) / Math.max(1, totalMinutes) * 100) + '%;--wave-color:' + weatherColors[n(row.WeatherType) % weatherColors.length] + '"></span>';
  }).join("");
  const groupedWeather = new Map();
  for (const row of waves) {
    const weather = weatherById.get(String(row.WeatherType));
    const name = weather?.Name || (n(row.WeatherType) === 0 ? "Clear" : "Weather " + row.WeatherType);
    if (!groupedWeather.has(name)) groupedWeather.set(name, { name, id: row.WeatherType, minutes: 0, waves: [] });
    groupedWeather.get(name).minutes += n(row.Duration);
    groupedWeather.get(name).waves.push(row.ID);
  }
  const weatherSummary = [...groupedWeather.values()].sort((a, b) => b.minutes - a.minutes).map(item => '<div class="weather-summary-row"><span><strong>' + esc(pretty(item.name)) + '</strong><small>Wave ' + esc(item.waves.join(", ")) + '</small></span><span class="weather-summary-bar"><i style="width:' + (item.minutes / Math.max(1, totalMinutes) * 100) + '%"></i></span><b>' + item.minutes + 'm <small>' + systemPct(item.minutes / Math.max(1, totalMinutes)) + '</small></b></div>').join("");
  const waveRows = waves.map((row, index) => {
    const weather = weatherById.get(String(row.WeatherType));
    const name = weather?.Name || (n(row.WeatherType) === 0 ? "Clear" : "Weather " + row.WeatherType);
    const start = waves.slice(0, index).reduce((sum, wave) => sum + n(wave.Duration), 0);
    return '<tr><td class="mono">' + esc(row.ID) + '</td><td>' + esc(pretty(name)) + '</td><td class="num">' + start + '–' + (start + n(row.Duration)) + 'm</td><td class="num">' + esc(row.Duration) + 'm</td></tr>';
  }).join("");
  const effectRows = effects.map(row => '<tr><td><strong>' + esc(row.Name) + '</strong><small class="system-cell-sub">Effect ' + esc(row.ID) + '</small></td><td class="num">' + systemPct(n(row.Chance)) + '</td><td class="num">' + esc(row.MultiplierPrice) + '×</td><td class="num">' + esc(row.LvUpCostMultiplier) + '×</td></tr>').join("");
  const weatherEffectChances = effects.map(row => '<span class="effect-chip"><i>☁</i><b>' + esc(row.Name) + '</b><small>' + systemPct(n(row.Chance)) + '</small></span>').join("");

    root.innerHTML = '<section class="panel system-data-panel"><div class="panel-head"><div><h2 class="panel-title">Weathergen · xác suất dùng theo config</h2><p class="panel-sub">Target pet: ' + esc(pretty(targetPetRarity)) + (isSecret ? ' · Secret Fusion' : '') + ' · tỉ lệ sau modifier được tính từ WeatherGenConfigs.</p></div><span class="tag">' + esc(gens.length) + ' item rows</span></div><div class="table-wrap"><table class="system-data-table"><thead><tr><th>ID</th><th>Hiệu ứng</th><th>Item tier</th><th class="num">Base</th><th class="num">Final use chance</th><th>Scale</th></tr></thead><tbody>' + genRows + '</tbody></table></div></section>' + weatherGenMappingNote +
    '<section class="panel weather-cycle-panel"><div class="panel-head"><div><h2 class="panel-title">Weather Drop · lịch weather theo wave</h2><p class="panel-sub">Thứ tự sort theo wave ID, đúng index runtime. Mỗi segment có độ dài tỉ lệ với Duration.</p></div><strong class="cycle-total">' + totalMinutes + '<small> phút / cycle</small></strong></div><div class="weather-cycle-strip" role="img" aria-label="Weather cycle gồm ' + waves.length + ' wave, tổng ' + totalMinutes + ' phút">' + segmentHtml + '</div><div class="weather-summary-list">' + weatherSummary + '</div></section>' +
    '<section class="section-grid system-section-grid"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Weather effects · giá trị config</h2><p class="panel-sub">Chance ở đây là effect roll khi effect được chọn từ weather hiện tại.</p></div></div><div class="effect-chip-list">' + weatherEffectChances + '</div><div class="table-wrap"><table class="system-compact-table"><thead><tr><th>Effect</th><th class="num">Roll chance</th><th class="num">Price mult.</th><th class="num">LvUp cost</th></tr></thead><tbody>' + effectRows + '</tbody></table></div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Wave timeline</h2><p class="panel-sub">WeatherManager đổi duration từ phút sang giây bằng SECONDS_PER_MINUTE.</p></div></div><div class="table-wrap weather-wave-table"><table class="system-compact-table"><thead><tr><th>Wave</th><th>Weather</th><th class="num">Cycle time</th><th class="num">Duration</th></tr></thead><tbody>' + waveRows + '</tbody></table></div><div class="system-footnote">WeatherGen.csv Chance là xác suất áp effect lên pet sau modifier; weatherEffects.csv Chance là một bước roll tự nhiên khác. Không diễn giải hai cột này thành xác suất rơi item Weathergen.</div></div></section>';
}

function luckyBoxPage() {
  const rows = t("LuckyBox.csv").rows;
  const ids = [...new Set(rows.map(row => row.BoxID))].sort((a, b) => n(a) - n(b));
  const boxPets = ids.map(boxId => {
    const pet = t("Pet.csv").rows.find(row => n(row.ID) > (s.data.codeFacts.luckyBoxStartIndex || 6000) && n(row.ID) <= (s.data.codeFacts.luckyBoxStartIndex || 6000) + (s.data.codeFacts.luckyBoxCount || 3) && (s.data.codeFacts.luckyBoxStartIndex * 10 + n(row.ID) - s.data.codeFacts.luckyBoxStartIndex) === n(boxId));
    return { boxId, pet };
  });
  const petForBox = boxPets.find(item => item.boxId === s.luckyBoxId)?.pet;
  const label = petForBox?.Name ? pretty(petForBox.Name.replace("LUCKYBOX", "")) : ("Box " + s.luckyBoxId);
  const stormCounts = s.data.codeFacts.luckyBoxStormSpawnCounts || [];
  const totalStormBoxes = stormCounts.reduce((sum, value) => sum + n(value), 0);
  return head("ITEM SYSTEMS · LUCKY BOX", "Lucky Box", "Xem pool pet theo từng box, phần trăm từ DrawWeight và số item đặc biệt được đưa lên road khi Giftbox Storm đến.", pill(rows.length + " weight rows") + pill(ids.length + " box pools")) +
    '<section class="kpi-grid">' +
    kpi("BOX POOLS", ids.length, "LuckyBox.csv · normalize weight riêng từng BoxID") +
    kpi("STORM ROAD BOXES", totalStormBoxes, "Mỗi loại box × số lượng trong LuckyBoxManager") +
    kpi("PREVIEW ROLLS", s.data.codeFacts.luckyBoxRandomPreviewCount || 8, "Animation preview trước kết quả") +
    kpi("CONFIG PET IDS", boxPets.filter(item => item.pet).length, "Pet.csv ID map sang reward BoxID") +
    '</section>' +
    '<section class="panel luckybox-config-card"><div class="luckybox-selected-art">' + (petForBox ? petImageHtml(petForBox, "luckybox-art") : '<span class="luckybox-art-fallback">▣</span>') + '</div><div class="luckybox-selected-copy"><p class="eyebrow">SELECTED BOX · ' + esc(label) + '</p><h2>' + esc(label + " Box") + '</h2><p>Road pet ID ' + esc(petForBox?.ID || "—") + ' → reward BoxID ' + esc(s.luckyBoxId) + ' · open một lần sẽ chọn một pet theo weight của pool này.</p></div><div class="luckybox-event-badge"><span>🎁</span><strong>Giftbox Storm</strong><small>' + stormCounts.map((count, index) => "Box " + (index + 1) + ": " + count).join(" · ") + '</small></div></section>' +
    '<section class="panel system-controls-panel"><div class="panel-head"><div><h2 class="panel-title">Chọn box và lọc kết quả</h2><p class="panel-sub">Xác suất mỗi pet = DrawWeight ÷ tổng weight trong BoxID được chọn.</p></div></div><div class="system-controls">' +
    '<label class="system-control"><span>Lucky Box</span><select id="luckybox-select">' + boxPets.map(item => '<option value="' + esc(item.boxId) + '"' + (String(item.boxId) === String(s.luckyBoxId) ? " selected" : "") + '>' + esc(item.pet ? pretty(item.pet.Name.replace("LUCKYBOX", "")) : "Box") + ' · ID ' + esc(item.boxId) + '</option>').join("") + '</select></label>' +
    '<label class="system-control"><span>Rarity kết quả</span><select id="luckybox-rarity"><option value="all">Tất cả rarity</option>' + systemRarities.map(value => '<option value="' + value + '"' + (s.luckyBoxRarity === value ? " selected" : "") + '>' + esc(pretty(value)) + '</option>').join("") + '</select></label>' +
    '<label class="system-control system-search-control"><span>Tìm pet</span><input id="luckybox-search" type="search" value="' + esc(s.luckyBoxSearch) + '" placeholder="Tên pet hoặc ID…"></label>' +
    '</div></section><div id="luckybox-analysis"></div>';
}

function updateLuckyBoxPage() {
  const root = document.getElementById("luckybox-analysis");
  if (!root) return;
  const rows = t("LuckyBox.csv").rows.filter(row => String(row.BoxID) === String(s.luckyBoxId));
  const petRows = t("Pet.csv").rows;
  const enriched = rows.map(row => ({ ...row, pet: petRows.find(pet => pet.ID === String(row.PetID)) })).filter(row => row.pet);
  const totalWeight = enriched.reduce((sum, row) => sum + n(row.DrawWeight), 0);
  const rarityTotals = new Map();
  for (const row of enriched) rarityTotals.set(row.pet.Rarity, (rarityTotals.get(row.pet.Rarity) || 0) + n(row.DrawWeight));
  const rarityRows = systemTierRarities.filter(name => rarityTotals.has(name)).map(name => {
    const share = rarityTotals.get(name) / Math.max(1, totalWeight);
    return '<div class="luckybox-rarity-row"><span>' + rarity(name) + '</span><span class="system-bar"><i style="width:' + (share * 100) + '%;--bar-color:' + systemColor(name) + '"></i></span><strong>' + systemPct(share) + '</strong></div>';
  }).join("");
  const top = enriched.slice().sort((a, b) => n(b.DrawWeight) - n(a.DrawWeight))[0];
  const query = s.luckyBoxSearch.trim().toLowerCase();
  const filtered = enriched.filter(row => (s.luckyBoxRarity === "all" || row.pet.Rarity === s.luckyBoxRarity) && (!query || (row.pet.Name + " " + row.PetID).toLowerCase().includes(query)))
    .sort((a, b) => n(b.DrawWeight) - n(a.DrawWeight));
  const entries = filtered.map(row => {
    const chance = n(row.DrawWeight) / Math.max(1, totalWeight);
    return '<tr data-pet="' + esc(row.PetID) + '" tabindex="0" role="button"><td><span class="pet-name-cell system-lucky-pet">' + petImageHtml(row.pet) + '<span><strong>' + esc(row.pet.Name) + '</strong><small>#' + esc(row.PetID) + '</small></span></span></td><td>' + rarity(row.pet.Rarity) + '</td><td class="num">' + esc(systemNum(row.DrawWeight)) + '</td><td class="num system-final-chance">' + systemPct(chance) + '</td><td><span class="system-bar"><i style="width:' + Math.min(100, chance * 100 / Math.max(0.0001, top ? n(top.DrawWeight) / totalWeight : 1)) + '%;--bar-color:' + systemColor(row.pet.Rarity) + '"></i></span></td></tr>';
  }).join("");
  const petCount = new Set(enriched.map(row => row.PetID)).size;
  root.innerHTML = '<section class="section-grid luckybox-results-grid"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Chance theo rarity pet</h2><p class="panel-sub">Tổng share rarity là 100% trong pool đang chọn.</p></div></div><div class="luckybox-rarity-list">' + (rarityRows || '<span class="empty-cell">Không có pet trong pool này.</span>') + '</div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Tóm tắt pool</h2><p class="panel-sub">Tổng weight chỉ dùng làm mẫu số cho box này.</p></div></div><div class="luckybox-pool-stats"><div><span>Pet entries</span><strong>' + petCount + '</strong></div><div><span>Total draw weight</span><strong>' + esc(systemNum(totalWeight)) + '</strong></div><div><span>Highest single-pet chance</span><strong>' + (top ? systemPct(n(top.DrawWeight) / Math.max(1, totalWeight)) : "—") + '</strong></div></div>' + (top?.pet ? '<div class="luckybox-top-pet">' + petImageHtml(top.pet) + '<span><small>Top weight</small><strong>' + esc(top.pet.Name) + '</strong><em>' + systemPct(n(top.DrawWeight) / Math.max(1, totalWeight)) + '</em></span></div>' : '') + '</div></section>' +
    '<section class="panel system-data-panel"><div class="panel-head"><div><h2 class="panel-title">Pet trong box · weight và xác suất</h2><p class="panel-sub">' + filtered.length + ' / ' + enriched.length + ' pet rows · click pet để mở raw Pet.csv config.</p></div><span class="tag">BoxID ' + esc(s.luckyBoxId) + '</span></div><div class="table-wrap"><table class="system-data-table luckybox-table"><thead><tr><th>Pet reward</th><th>Rarity</th><th class="num">Draw weight</th><th class="num">Chance</th><th>Relative bar</th></tr></thead><tbody>' + (entries || '<tr><td class="empty" colspan="5">Không có kết quả khớp.</td></tr>') + '</tbody></table></div></section>' +
    '<section class="panel system-footnote-panel"><div class="system-rule-line"><strong>Flow trong code</strong><span>' + (s.data.codeFacts.luckyBoxDrawIsWeighted ? "WeightedRandom trên DrawWeight" : "DrawWeight pool") + ' · ' + (s.data.codeFacts.luckyBoxManagerMakesSingleDraw ? "1 kết quả được commit khi mở" : "kết quả mở box lấy từ manager") + '</span></div><p class="system-footnote">LuckyBoxManager thêm ' + esc((s.data.codeFacts.luckyBoxStormSpawnCounts || []).join(" / ")) + ' box vào road khi weather chuyển sang GiftboxStorm. Preview rolls chỉ phục vụ animation; pet kết quả giữ mutation/weather cũ và được đặt về level 1 theo flow hiện tại.</p></section>';
}

document.addEventListener("change", event => {
  if (event.target.id === "mutagen-target-rarity" || event.target.id === "mutagen-secret" || event.target.id === "mutagen-level") updateMutagenPage();
  if (event.target.id === "weather-target-rarity" || event.target.id === "weather-secret") updateWeatherDropPage();
  if (event.target.id === "luckybox-select") { s.luckyBoxId = event.target.value; go("luckybox"); }
  if (event.target.id === "luckybox-rarity") { s.luckyBoxRarity = event.target.value; updateLuckyBoxPage(); }
});
document.addEventListener("input", event => {
  if (event.target.id === "mutagen-level") updateMutagenPage();
  if (event.target.id === "luckybox-search") { s.luckyBoxSearch = event.target.value; updateLuckyBoxPage(); }
});
