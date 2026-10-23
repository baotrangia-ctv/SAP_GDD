"use strict";

const collectionPreview = { rarity: "ALL", page: 0, selected: null, detailTab: "Info", mode: "all", seed: 42, loading: false, customPets: new Set(), customMutations: new Set(), customWeathers: new Set() };

function initCollectionPreview(screen, rules, rendered) {
  const state = collectionPreview;
  const pets = t("Pet.csv").rows;
  const mutationRows = t("mutation.csv").rows.filter(row => Number(row.ID) >= rules.details.mutationStartId);
  const weatherRows = t("weatherEffects.csv").rows.filter(row => Number(row.ID) >= rules.details.weatherStartId);
  const iconSets = s.data.visualAssets || {};
  const entities = [...rendered.canvas.querySelectorAll("[data-ui-path]")];
  const named = name => entities.find(el => el.dataset.uiName === name);
  const byPath = path => entities.find(el => el.dataset.uiPath === path);
  const base = "PetsCollection/Container/";
  const petTemplate = byPath(base + "PetsLayout/Pet (1)");
  const petLayout = named("PetsLayout");
  const mwTemplate = byPath(base + "MutationsWeathers/MWLayout/Icon");
  const mwLayout = named("MWLayout");
  let petCards = [petTemplate];
  let mwIcons = [mwTemplate];
  const icon = (set, id) => set?.[String(id)] || "";
  const hash = (value, seed) => { let n = seed | 0; for (const ch of String(value)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619); return n >>> 0; };
  const petOwned = pet => state.mode === "all" || (state.mode === "random" && hash(pet.ID, state.seed) % 2 === 0) || (state.mode === "custom" && state.customPets.has(pet.ID));
  const effectOwned = (pet, row, type) => petOwned(pet) && (state.mode === "all" || (state.mode === "random" && hash(`${pet.ID}/${type}/${row.ID}`, state.seed) % 3 === 0) || (state.mode === "custom" && (type === "mutation" ? state.customMutations : state.customWeathers).has(`${pet.ID}/${row.ID}`)));
  function setVisible(el, visible) { if (el) { el.classList.toggle("ui-inactive", !visible); el.style.display = visible ? "" : "none"; } }
  function setText(el, value) { const span = el?.querySelector(":scope > .ui-text"); if (span) span.textContent = String(value); }
  function setImage(el, url, dark = false) {
    if (!el) return;
    const img = el.querySelector(":scope > .ui-sprite") || document.createElement("img");
    if (!img.parentElement) { img.className = "ui-sprite"; img.alt = ""; el.prepend(img); }
    if (url) { img.src = url; img.style.display = "block"; } else img.style.display = "none";
    img.style.filter = dark ? "brightness(0.12)" : "none";
  }
  function directChild(root, name) { return root ? [...root.children].find(el => el.dataset.uiName === name) : null; }
  function cloneTemplate(template, container) {
    const clone = template.cloneNode(true);
    clone.querySelectorAll("[data-ui-path]").forEach(el => { el.dataset.uiClonePath = el.dataset.uiPath; delete el.dataset.uiPath; delete el.dataset.uiId; });
    clone.dataset.uiClonePath = template.dataset.uiPath;
    delete clone.dataset.uiPath;
    delete clone.dataset.uiId;
    container.appendChild(clone);
    return clone;
  }
  function resizeGridItem(el, index, layoutNode) {
    const grid = layoutNode.layout;
    if (!grid) return;
    const cell = grid.size, gap = grid.space, cols = Math.max(1, Math.floor((layoutNode.transform.sizeDelta.x - grid.offset.left - grid.offset.right + gap.x) / (cell.x + gap.x)));
    el.style.left = `${grid.offset.left + index % cols * (cell.x + gap.x)}px`;
    el.style.top = `${grid.offset.up + Math.floor(index / cols) * (cell.y + gap.y)}px`;
  }
  const layoutNode = screen.tree.children.find(x => x.name === "Container").children.find(x => x.name === "PetsLayout");
  const allPets = pets.filter(pet => {
    const id = Number(pet.ID), f = rules.petFilter;
    return !(id > f.luckyBoxStart && id <= f.luckyBoxStart + f.luckyBoxCount);
  }).sort((a, b) => Number(a.Rank) - Number(b.Rank));
  function filtered() { return allPets.filter(pet => state.rarity === "ALL" || pet.Rarity === state.rarity); }
  function currentPagePets() { const list = filtered(); return list.slice(state.page * rules.page.size, (state.page + 1) * rules.page.size); }
  function ownCount(rows, type, petsInRarity) { return petsInRarity.reduce((sum, pet) => sum + rows.filter(row => effectOwned(pet, row, type)).length, 0); }
  function counter(group, amount, total) {
    const root = named(group);
    setText(root && [...root.children].find(x => x.dataset.uiName?.endsWith("Amount")), `${amount}/${total}`);
    const bar = directChild(root, "Progress");
    if (bar) bar.style.clipPath = `inset(0 ${total ? 100 * (1 - amount / total) : 100}% 0 0)`;
  }
  function updateCounters() {
    const list = filtered();
    counter("PetsCount", list.filter(petOwned).length, list.length);
    counter("MutationsCount", ownCount(mutationRows, "mutation", list), list.length * mutationRows.length);
    counter("WeathersCount", ownCount(weatherRows, "weather", list), list.length * weatherRows.length);
  }
  function renderPetCard(card, pet, index) {
    setVisible(card, !!pet);
    if (!pet) return;
    card.dataset.uiPetId = pet.ID;
    resizeGridItem(card, index, layoutNode);
    const owned = petOwned(pet);
    setText(directChild(card, "Name"), owned ? pet.Name : rules.unowned.name);
    setImage(directChild(card, "Thumbnail"), icon(iconSets.petIcons, pet.ID), !owned);
    const rarity = directChild(card, "Rarity");
    if (rarity) { rarity.style.backgroundColor = owned ? (colors[pet.Rarity] || "#8DA6B6") : rules.unowned.tint; rarity.querySelector(":scope > .ui-sprite")?.setAttribute("style", "display:none"); }
    const hasMW = directChild(card, "HasMW");
    setText(directChild(hasMW, "Count"), mutationRows.filter(row => effectOwned(pet, row, "mutation")).length + weatherRows.filter(row => effectOwned(pet, row, "weather")).length);
    setVisible(directChild(card, "SelectBorder"), pet.ID === state.selected?.ID);
  }
  function obtainKind(pet) {
    const id = Number(pet.ID), o = rules.obtain;
    if (o.giftcodePetIds.includes(id)) return "giftcode";
    if (o.luckyboxPetIds.includes(id)) return "luckybox";
    const fuse = pet[o.canFuseColumn] === "1";
    const road = o.roadWeightColumns.some(column => Number(pet[column]) > 0);
    const secret = id !== o.secretFusionException && id > o.secretFusionStart && id <= o.secretFusionStart + o.secretFusionCount;
    if (fuse && (secret || !road)) return "fusion";
    if (road) return "road";
    return "chưa có dữ liệu";
  }
  function updateDetails() {
    const pet = state.selected;
    const panel = named("PetDetails");
    const tabs = named("DetailsTabsLayout");
    const info = named("Info"), mw = named("MutationsWeathers"), recipe = named("Recipe"), unlock = named("UnlockObtain");
    if (!pet) { [panel, tabs, info, mw, recipe, unlock].forEach(x => setVisible(x, false)); return; }
    const owned = petOwned(pet), kind = obtainKind(pet), showRecipe = !owned && kind === "fusion";
    setVisible(panel, true);
    const detailPet = byPath(base + "PetDetails/Pet");
    setImage(directChild(detailPet, "Thumbnail"), icon(iconSets.petIcons, pet.ID), !owned);
    setText(directChild(detailPet, "Name"), owned ? pet.Name : rules.unowned.name);
    const rarity = directChild(detailPet, "RarityBG");
    if (rarity) rarity.style.backgroundColor = colors[pet.Rarity] || "#8DA6B6";
    setText(directChild(rarity, "RarityName"), pet.Rarity);
    setVisible(named("Obtain"), owned);
    setVisible(unlock, !owned);
    setText(directChild(unlock, "Label"), `Nhận từ: ${kind}`);
    setVisible(recipe, showRecipe);
    if (showRecipe) {
      let rank = Number(pet.Rank) - rules.recipe.previousRankOffset;
      let previous = null;
      while (rank >= 1 && !previous) {
        const candidate = allPets.find(row => Number(row.Rank) === rank);
        if (candidate?.[rules.obtain.canFuseColumn] === "1") previous = candidate;
        else rank -= 1;
      }
      const materials = [...recipe.children].filter(el => el.dataset.uiName === "Pet");
      materials.forEach((item, index) => {
        const previousId = Number(previous?.ID);
        const isSecret = previousId !== rules.obtain.secretFusionException && previousId > rules.obtain.secretFusionStart && previousId <= rules.obtain.secretFusionStart + rules.obtain.secretFusionCount;
        const isSpecific = index === 1 && previous && isSecret;
        setText(directChild(item, "Name"), isSpecific ? previous.Name : previous ? `Bất kỳ ${previous.Rarity}` : "chưa có dữ liệu");
        setImage(directChild(item, "Thumbnail"), isSpecific ? icon(iconSets.petIcons, previous.ID) : "");
        item.dataset.uiRecipeTarget = isSpecific ? previous.ID : "";
      });
    }
    setVisible(tabs, !showRecipe);
    setVisible(info, !showRecipe && state.detailTab === "Info");
    setVisible(mw, !showRecipe && state.detailTab !== "Info");
    const value = owned ? `${big(pet.Value)}/s` : rules.details.unownedValue;
    setText(byPath(base + "Info/Value/Content"), `Value ${value}`);
    setText(byPath(base + "Info/Mutations/Content"), `Mutation (${owned ? mutationRows.filter(row => effectOwned(pet, row, "mutation")).length : 0}/${mutationRows.length})`);
    setText(byPath(base + "Info/Weathers/Content"), `Weather (${owned ? weatherRows.filter(row => effectOwned(pet, row, "weather")).length : 0}/${weatherRows.length})`);
    const rows = state.detailTab === "Weathers" ? weatherRows : mutationRows;
    while (mwIcons.length < rows.length) mwIcons.push(cloneTemplate(mwTemplate, mwLayout));
    mwIcons.forEach((el, i) => {
      const row = rows[i]; setVisible(el, !!row); if (!row) return;
      el.style.left = `${(i % rules.mwGrid.columns) * rules.mwGrid.size}px`;
      el.style.top = `${Math.floor(i / rules.mwGrid.columns) * (rules.mwGrid.size + rules.mwGrid.verticalSpacing)}px`;
      setImage(el, state.detailTab === "Weathers" ? icon(iconSets.weatherEffectIcons, row.ID) : icon(iconSets.mutationIcons, row.ID));
      const img = el.querySelector(":scope > .ui-sprite");
      if (img) img.style.filter = effectOwned(pet, row, state.detailTab === "Weathers" ? "weather" : "mutation") ? "none" : "brightness(.27)";
      el.title = row.Name;
    });
    document.querySelectorAll("[data-ui-custom-effect]").forEach(el => el.checked = (el.dataset.uiCustomEffect === "mutation" ? state.customMutations : state.customWeathers).has(`${pet.ID}/${el.value}`));
    const customPet = document.getElementById("ui-custom-pet"); if (customPet) customPet.checked = state.customPets.has(pet.ID);
    const label = document.getElementById("ui-custom-selected"); if (label) label.textContent = `${pet.Name} · #${pet.ID}`;
  }
  function updateCards() {
    setVisible(named("LoadingLabel"), state.loading);
    const rows = currentPagePets();
    while (petCards.length < rows.length) petCards.push(cloneTemplate(petTemplate, petLayout));
    petCards.forEach((card, index) => renderPetCard(card, rows[index], index));
    const total = Math.ceil(filtered().length / rules.page.size);
    setText(named("Page"), total > 1 ? `${state.page + 1} / ${total}` : "");
    setVisible(named("PrevPageButton"), total > 1 && state.page > 0);
    setVisible(named("NextPageButton"), total > 1 && state.page < total - 1);
    updateDetails(); updateCounters();
    if (state.loading) { petCards.forEach(card => setVisible(card, false)); [named("PetDetails"), named("DetailsTabsLayout"), named("Info"), named("MutationsWeathers")].forEach(el => setVisible(el, false)); }
    for (const [rarity, config] of Object.entries(rules.rarityTabs)) {
      const tab = named(`${rarity[0]}${rarity.slice(1).toLowerCase()}TabButton`);
      if (tab) tab.classList.toggle("ui-tab-active", state.rarity === rarity);
    }
  }
  function selectPage(page) {
    const count = Math.ceil(filtered().length / rules.page.size);
    if (page < 0 || page >= count) return;
    state.page = page; state.selected = currentPagePets()[0] || null; state.detailTab = "Info"; updateCards();
  }
  function setRarity(rarity) { if (!rules.rarityTabs[rarity]) return; state.rarity = rarity; state.page = 0; state.selected = currentPagePets()[0] || null; state.detailTab = "Info"; updateCards(); }
  const panel = document.getElementById("ui-player-panel");
  panel.innerHTML = '<h2>Người chơi giả lập</h2><p>Chỉ mô phỏng sở hữu để xem trạng thái HUD. Không phải dữ liệu người chơi thật.</p>' +
    '<label>Trạng thái <select id="ui-player-mode"><option value="all">Sở hữu tất cả</option><option value="none">Không sở hữu</option><option value="random">Ngẫu nhiên có seed</option><option value="custom">Tự chọn</option></select></label>' +
    '<label>Seed <input id="ui-player-seed" type="number" value="42"></label><label><input id="ui-loading" type="checkbox"> Giả lập dữ liệu đang tải</label><p id="ui-custom-selected"></p><label><input id="ui-custom-pet" type="checkbox"> Sở hữu pet đang chọn</label>' +
    '<details><summary>Mutation của pet</summary>' + mutationRows.map(row => `<label><input type="checkbox" data-ui-custom-effect="mutation" value="${esc(row.ID)}"> ${esc(row.Name)}</label>`).join("") + '</details>' +
    '<details><summary>Weather của pet</summary>' + weatherRows.map(row => `<label><input type="checkbox" data-ui-custom-effect="weather" value="${esc(row.ID)}"> ${esc(row.Name)}</label>`).join("") + '</details>';
  state.selected = currentPagePets()[0] || null;
  setVisible(named("LoadingLabel"), false);
  updateCards();
  rendered.canvas.addEventListener("click", event => {
    const recipeTarget = event.target.closest("[data-ui-recipe-target]")?.dataset.uiRecipeTarget;
    if (recipeTarget) {
      const previous = pets.find(pet => pet.ID === recipeTarget);
      if (previous) { state.rarity = previous.Rarity; state.page = Math.floor(filtered().findIndex(pet => pet.ID === previous.ID) / rules.page.size); state.selected = previous; updateCards(); }
      return;
    }
    const card = event.target.closest("[data-ui-pet-id]");
    let button = event.target.closest("[data-ui-name]"); if (!button) return;
    while (button && button !== rendered.canvas && !/^(CloseButton|DarkBG|PreventCloseButton|PrevPageButton|NextPageButton|(All|Common|Rare|Epic|Legendary|Mythic|Apex|Limited|Info|Mutations|Weathers)TabButton)$/.test(button.dataset.uiName || "")) button = button.parentElement?.closest("[data-ui-name]");
    const name = button && button !== rendered.canvas ? button.dataset.uiName : "";
    if (name === "CloseButton" || name === "DarkBG") { uiPreview.open = false; rendered.canvas.classList.add("ui-closed"); document.getElementById("ui-open-toggle").textContent = "Mở UI"; return; }
    if (name === "PreventCloseButton") return;
    if (state.loading) return;
    if (name === "PrevPageButton") { selectPage(state.page - 1); return; }
    if (name === "NextPageButton") { selectPage(state.page + 1); return; }
    const tab = name.match(/^(All|Common|Rare|Epic|Legendary|Mythic|Apex|Limited)TabButton$/);
    if (tab) { setRarity(tab[1].toUpperCase()); return; }
    const detailsTab = name.match(/^(Info|Mutations|Weathers)TabButton$/);
    if (detailsTab) { state.detailTab = detailsTab[1]; updateDetails(); return; }
    if (card) { state.selected = pets.find(pet => pet.ID === card.dataset.uiPetId); state.detailTab = "Info"; updateCards(); }
  });
  panel.addEventListener("change", event => {
    const el = event.target;
    if (el.id === "ui-player-mode") state.mode = el.value;
    if (el.id === "ui-player-seed") state.seed = Number(el.value) || 0;
    if (el.id === "ui-loading") state.loading = el.checked;
    if (el.id === "ui-custom-pet" && state.selected) { (el.checked ? state.customPets.add : state.customPets.delete).call(state.customPets, state.selected.ID); state.mode = "custom"; panel.querySelector("#ui-player-mode").value = "custom"; }
    if (el.dataset.uiCustomEffect && state.selected) { const set = el.dataset.uiCustomEffect === "mutation" ? state.customMutations : state.customWeathers; const key = `${state.selected.ID}/${el.value}`; if (el.checked) { set.add(key); state.customPets.add(state.selected.ID); } else set.delete(key); state.mode = "custom"; panel.querySelector("#ui-player-mode").value = "custom"; }
    updateCards();
  });
}
