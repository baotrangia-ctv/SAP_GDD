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
