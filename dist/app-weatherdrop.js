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
  const genRows = gens.map(row => '<tr><td class="mono">' + esc(row.ID) + '</td><td><span class="system-name-cell"><span class="weather-mark">' + systemIcon(s.data.visualAssets?.weatherEffectIcons, row.effect?.ID ?? row.WeatherEffect, "?") + '</span><span><strong>' + esc(row.effect?.Name || ("Effect " + row.WeatherEffect)) + '</strong><small>Weather effect ' + esc(row.WeatherEffect) + '</small></span></span></td><td>' + rarity(row.Rarity) + '</td><td class="num">' + esc(row.Chance) + '%</td><td class="num system-final-chance">' + systemPct(row.final) + '</td><td><span class="system-bar"><i style="width:' + Math.min(100, row.final * 100 / 0.75) + '%;--bar-color:' + systemColor(row.Rarity) + '"></i></span></td></tr>').join("");

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
  const effectRows = effects.map(row => '<tr><td><span class="weather-effect-table-name">' + systemIcon(s.data.visualAssets?.weatherEffectIcons, row.ID, "?") + '<span><strong>' + esc(row.Name) + '</strong><small class="system-cell-sub">Effect ' + esc(row.ID) + '</small></span></span></td><td class="num">' + systemPct(n(row.Chance)) + '</td><td class="num">' + esc(row.MultiplierPrice) + '×</td><td class="num">' + esc(row.LvUpCostMultiplier) + '×</td></tr>').join("");
  const weatherEffectChances = effects.map(row => '<span class="effect-chip">' + systemIcon(s.data.visualAssets?.weatherEffectIcons, row.ID, "?") + '<b>' + esc(row.Name) + '</b><small>' + systemPct(n(row.Chance)) + '</small></span>').join("");

    root.innerHTML = '<section class="panel system-data-panel"><div class="panel-head"><div><h2 class="panel-title">Weathergen · xác suất dùng theo config</h2><p class="panel-sub">Target pet: ' + esc(pretty(targetPetRarity)) + (isSecret ? ' · Secret Fusion' : '') + ' · tỉ lệ sau modifier được tính từ WeatherGenConfigs.</p></div><span class="tag">' + esc(gens.length) + ' item rows</span></div><div class="table-wrap"><table class="system-data-table"><thead><tr><th>ID</th><th>Hiệu ứng</th><th>Item tier</th><th class="num">Base</th><th class="num">Final use chance</th><th>Scale</th></tr></thead><tbody>' + genRows + '</tbody></table></div></section>' + weatherGenMappingNote +
    '<section class="panel weather-cycle-panel"><div class="panel-head"><div><h2 class="panel-title">Weather Drop · lịch weather theo wave</h2><p class="panel-sub">Thứ tự sort theo wave ID, đúng index runtime. Mỗi segment có độ dài tỉ lệ với Duration.</p></div><strong class="cycle-total">' + totalMinutes + '<small> phút / cycle</small></strong></div><div class="weather-cycle-strip" role="img" aria-label="Weather cycle gồm ' + waves.length + ' wave, tổng ' + totalMinutes + ' phút">' + segmentHtml + '</div><div class="weather-summary-list">' + weatherSummary + '</div></section>' +
    '<section class="section-grid system-section-grid"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Weather effects · giá trị config</h2><p class="panel-sub">Chance ở đây là effect roll khi effect được chọn từ weather hiện tại.</p></div></div><div class="effect-chip-list">' + weatherEffectChances + '</div><div class="table-wrap"><table class="system-compact-table"><thead><tr><th>Effect</th><th class="num">Roll chance</th><th class="num">Price mult.</th><th class="num">LvUp cost</th></tr></thead><tbody>' + effectRows + '</tbody></table></div></div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Wave timeline</h2><p class="panel-sub">WeatherManager đổi duration từ phút sang giây bằng SECONDS_PER_MINUTE.</p></div></div><div class="table-wrap weather-wave-table"><table class="system-compact-table"><thead><tr><th>Wave</th><th>Weather</th><th class="num">Cycle time</th><th class="num">Duration</th></tr></thead><tbody>' + waveRows + '</tbody></table></div><div class="system-footnote">WeatherGen.csv Chance là xác suất áp effect lên pet sau modifier; weatherEffects.csv Chance là một bước roll tự nhiên khác. Không diễn giải hai cột này thành xác suất rơi item Weathergen.</div></div></section>';
}
