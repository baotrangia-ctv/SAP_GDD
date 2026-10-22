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
    return '<tr><td><span class="system-name-cell"><span class="system-name-mark">' + systemIcon(s.data.visualAssets?.mutationIcons, group.mutation.ID, "✧") + '</span><span><strong>' + esc(group.mutation.Name) + '</strong><small>Tier ' + esc(group.mutation.Tier || "—") + ' · multiplier ' + esc(group.mutation.Multiplier || "—") + '×</small></span></span></td>' + cells + '</tr>';
  }).join("");
  const mutateCosts = t("MutateCost.csv").rows;
  const costRows = mutateCosts.map(row => '<tr><td>' + esc(row.RankMin) + '–' + esc(row.RankMax) + '</td><td class="num">' + esc(systemNum(row.Cost)) + '</td><td class="num">' + esc((costFactor).toFixed(2)) + '×</td></tr>').join("");
  root.innerHTML = '<section class="section-grid system-section-grid"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Tỉ lệ theo mutation × rarity của item</h2><p class="panel-sub">Mỗi ô là xác suất thành công cuối cho pet ' + esc(pretty(targetPetRarity)) + (isSecret ? ' · Secret Fusion' : '') + '.</p></div><span class="tag">' + esc(rows.length) + ' rows</span></div><div class="table-wrap"><table class="system-matrix"><thead><tr><th>Mutation</th><th>Mutagen · Common</th><th>Rare</th><th>Epic</th></tr></thead><tbody>' + matrix + '</tbody></table></div></div>' +
    '<div class="panel"><div class="panel-head"><div><h2 class="panel-title">Cost theo pet rank</h2><p class="panel-sub">Giá trị đầu vào từ MutateCost.csv; level multiplier lấy từ MutagenConfigs.</p></div></div><div class="table-wrap"><table class="system-compact-table"><thead><tr><th>Pet rank</th><th class="num">Base cost</th><th class="num">At Lv' + level + '</th></tr></thead><tbody>' + costRows + '</tbody></table></div><div class="system-footnote">MUTAGEN_USE_COST_MULTIPLIER = ' + esc(rules.useCostMultiplier || 1) + '× · secret giảm chance theo ×' + esc(rules.secretMultiplier || 0.55) + '× trước khi clamp.</div></div></section>' +
    '<section class="panel system-explain"><div class="system-rule-line"><strong>Công thức runtime</strong><span>clamp(Chance ÷ 100 × PetRarityMultiplier × SecretMultiplier, ' + systemPct(rules.min || 0.02) + ', ' + systemPct(rules.max || 0.75) + ')</span></div><div class="system-rarity-factors">' + systemRarities.map(name => '<span>' + rarity(name) + '<b>×' + esc(rules.rarityMultiplier?.[name] ?? "—") + '</b></span>').join("") + '</div><p class="system-footnote">Chance trong Mutagen.csv là xác suất nền theo mutagen type. Hệ số bên trên áp lên rarity của pet đang mutate; rarity chip trong bảng là rarity của item Mutagen.</p></section>';
}
