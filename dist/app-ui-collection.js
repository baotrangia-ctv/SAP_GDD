"use strict";

const collectionPreview = { rarity: "ALL", page: 0, selected: null, detailTab: "Info", mode: "all", seed: 42, loading: false, customPets: new Set(), customMutations: new Set(), customWeathers: new Set() };

function initCollectionPreview(screen, rules, rendered, options = {}) {
  const context = options.context || uiPreview;
  const state = options.state || collectionPreview;
  const notify = options.onUpdate || renderUiResourcePanel;
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
  uiRenderer.setLayoutOptions(mwLayout, { maxColumns: rules.mwGrid.columns, resizeHeightToVisibleRows: true, sizeSource: rules.mwGrid.source }, rendered.canvas, screen);
  let petCards = [petTemplate];
  let mwIcons = [mwTemplate];
  const rarityColor = value => rules.rarityColors?.values?.[String(value).toUpperCase()]?.value || "#FFFFFF";
  const rarityColorSource = value => rules.rarityColors?.values?.[String(value).toUpperCase()]?.source || "dist/data/ui/collection-rules.json";
  const icon = (set, id) => set?.[String(id)] || "";
  const hash = (value, seed) => { let n = seed | 0; for (const ch of String(value)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619); return n >>> 0; };
  const petOwned = pet => state.mode === "all" || (state.mode === "random" && hash(pet.ID, state.seed) % 2 === 0) || (state.mode === "custom" && state.customPets.has(pet.ID));
  const effectOwned = (pet, row, type) => petOwned(pet) && (state.mode === "all" || (state.mode === "random" && hash(`${pet.ID}/${type}/${row.ID}`, state.seed) % 3 === 0) || (state.mode === "custom" && (type === "mutation" ? state.customMutations : state.customWeathers).has(`${pet.ID}/${row.ID}`)));
  function recordRuntime(el, property, value, source = "dist/app-ui-collection.js (preview simulation)") {
    if (!el) return;
    let values = {};
    try { values = JSON.parse(el.dataset.uiRuntimeValues || "{}"); } catch {}
    values[property] = { value, source };
    el.dataset.uiRuntimeValues = JSON.stringify(values);
  }
  function sourceFor(target, property, fragment = "") {
    return rules.runtimeAssignments.find(item => item.target === target && item.property === property && (!fragment || item.expression.includes(fragment)))?.source || "dist/app-ui-collection.js (preview simulation)";
  }
  function setVisible(el, visible, source) {
    if (!el) return;
    const wasVisible = !el.classList.contains("ui-inactive") && el.style.display !== "none";
    el.classList.toggle("ui-inactive", !visible);
    el.style.removeProperty("display");
    recordRuntime(el, "IsVisible", visible, source || "dist/app-ui-collection.js (preview simulation)");
    if (wasVisible !== visible) uiRenderer.refreshLayouts(rendered.canvas, screen);
  }
  function setText(el, value, source) { const span = el?.querySelector(":scope > .ui-text"); if (span) { span.textContent = uiTranslate(String(value)); el.dataset.uiRuntimeContent = String(value); recordRuntime(el, "Content", String(value), source); } }
  function setImage(el, url, dark = false, sources = {}) {
    if (!el) return;
    el.dataset.uiRuntimeUrl = url || "";
    const source = screenEntity(el)?.image || {};
    const color = typeof dark === "string" ? dark : dark ? rules.unowned.tint : source.color || "#FFFFFF";
    uiRenderer.setImage(el, url, { ...source, color });
    recordRuntime(el, "SpriteName", url || "", sources.sprite || "dist/app-ui-collection.js (preview simulation)");
    recordRuntime(el, "Color", color, sources.color || "dist/app-ui-collection.js (preview simulation)");
  }
  function updateTabVisuals(group, activeName) {
    const config = rules.tabVisuals?.[group];
    if (!config) return;
    const names = group === "rarity" ? Object.keys(rules.rarityTabs).map(r => `${r[0]}${r.slice(1).toLowerCase()}TabButton`) : Object.keys(rules.details.tabs).map(r => `${r}TabButton`);
    for (const name of names) {
      const button = named(name);
      if (!button) continue;
      const active = name === activeName;
      const props = screenEntity(button)?.button || {};
      const sprite = active ? config.selectedSprite : config.normalSprite;
      const spriteSource = config.source || "dist/data/ui/collection-rules.json";
      const color = active ? config.selectedTextColor : config.normalTextColor;
      const colorSource = sourceFor("tabText", "Color", active ? "ACTIVE_TEXT_COLOR" : "DEFAULT_TEXT_COLOR");
      uiRenderer.setSprite(button, sprite, { ...props, color: props.normal, fillType: 1 }, context.manifest);
      recordRuntime(button, "SpriteResource", sprite, spriteSource);
      const labelElement = directChild(button, config.textChild);
      if (labelElement?.querySelector(":scope > .ui-text")) {
        uiRenderer.setTextColor(labelElement, color);
        recordRuntime(labelElement, "Color", color, colorSource);
      }
    }
  }
  function screenEntity(el) { const path = el?.dataset.uiPath || el?.dataset.uiClonePath; if (!path) return null; const parts = path.split("/").slice(1); let node = screen.tree; for (const part of parts) node = node?.children.find(child => child.name === part); return node; }
  function directChild(root, name) { return root ? [...root.children].find(el => el.dataset.uiName === name) : null; }
  function cloneTemplate(template, container) {
    const clone = template.cloneNode(true);
    const templatePath = template.dataset.uiPath || template.dataset.uiClonePath;
    const cloneIndex = [...container.children].filter(el => el.dataset.uiCloneTemplatePath === templatePath).length + 1;
    for (const el of [clone, ...clone.querySelectorAll("[data-ui-path]")]) {
      const sourcePath = el.dataset.uiPath || el.dataset.uiClonePath || templatePath;
      const sourceId = el.dataset.uiId || el.dataset.uiSourceEntityId || "";
      el.dataset.uiClonePath = sourcePath;
      el.dataset.uiCloneTemplatePath = templatePath;
      el.dataset.uiCloneIndex = String(cloneIndex);
      el.dataset.uiSourceEntityId = sourceId;
      el.dataset.uiEntityKey = `clone:${templatePath}#${cloneIndex}:${sourceId || sourcePath}`;
      delete el.dataset.uiPath;
      delete el.dataset.uiId;
    }
    container.appendChild(clone);
    uiRenderer.refreshLayouts(rendered.canvas, screen);
    return clone;
  }
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
    if (bar) {
      const fillAmount = total ? amount / total : 0;
      uiRenderer.setFillAmount(bar, fillAmount, screenEntity(bar)?.image || {});
      recordRuntime(bar, "FillAmount", fillAmount, sourceFor("progress", "FillAmount", fillAmount ? "Convert.IntToFloat" : "progress.FillAmount = 0"));
    }
  }
  function updateCounters() {
    const list = filtered();
    counter("PetsCount", list.filter(petOwned).length, list.length);
    counter("MutationsCount", ownCount(mutationRows, "mutation", list), list.length * mutationRows.length);
    counter("WeathersCount", ownCount(weatherRows, "weather", list), list.length * weatherRows.length);
  }
  function renderPetCard(card, pet, index) {
    setVisible(card, !!pet, sourceFor("petWidget", "IsVisible", pet ? "true" : "false"));
    if (!pet) return;
    card.dataset.uiPetId = pet.ID;
    const owned = petOwned(pet);
    setText(directChild(card, "Name"), owned ? pet.Name : rules.unowned.name, owned ? "Assets/CSV/Pet.csv (preview row)" : rules.unowned.nameSource);
    setImage(directChild(card, "Thumbnail"), icon(iconSets.petIcons, pet.ID), !owned, {
      sprite: sourceFor("thumbnail", "SpriteName"),
      color: owned ? "Assets/HUDs/PetsCollection.ui (base image Color)" : rules.runtimeColorRules.petUnowned.source
    });
    const rarity = directChild(card, "Rarity");
    if (rarity) {
      const color = owned ? rarityColor(pet.Rarity) : rules.unowned.tint;
      uiRenderer.tint(rarity, color);
      recordRuntime(rarity, "Color", color, owned ? rarityColorSource(pet.Rarity) : rules.runtimeColorRules.petUnowned.source);
    }
    const hasMW = directChild(card, "HasMW");
    setText(directChild(hasMW, "Count"), mutationRows.filter(row => effectOwned(pet, row, "mutation")).length + weatherRows.filter(row => effectOwned(pet, row, "weather")).length, sourceFor("countLabel", "Content"));
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
    setImage(directChild(detailPet, "Thumbnail"), icon(iconSets.petIcons, pet.ID), !owned, {
      sprite: sourceFor("thumbnail", "SpriteName"),
      color: owned ? "Assets/HUDs/PetsCollection.ui (base image Color)" : rules.runtimeColorRules.petUnowned.source
    });
    setText(directChild(detailPet, "Name"), owned ? pet.Name : rules.unowned.name, owned ? "Assets/CSV/Pet.csv (preview row)" : rules.unowned.nameSource);
    const rarity = directChild(detailPet, "RarityBG");
    if (rarity) {
      const color = rarityColor(pet.Rarity);
      uiRenderer.tint(rarity, color);
      recordRuntime(rarity, "Color", color, rarityColorSource(pet.Rarity));
      const rarityName = directChild(rarity, "RarityName");
      uiRenderer.setTextOutlineColor(rarityName, color);
      recordRuntime(rarityName, "OutlineColor", color, sourceFor("rarityName", "OutlineColor"));
    }
    setText(directChild(rarity, "RarityName"), `RARITY_${pet.Rarity}`, sourceFor("rarityName", "Content"));
    setVisible(named("Obtain"), owned);
    setVisible(unlock, !owned);
    const obtainKeys = { giftcode: "HUD_REBIRTH_GIFTCODE", luckybox: "HUD_LUCKYBOX", fusion: "HUD_FUSE", road: "HUD_ROAD", fishing: "HUD_FISH", dig: "HUD_DIG", event: "HUD_EVENT" };
    const obtainText = uiTranslate(obtainKeys[kind] || kind);
    const obtainSprite = rules.obtain.iconSpriteKeys?.[kind];
    if (obtainSprite) {
      for (const target of [byPath(base + "PetDetails/Obtain/BG/ObtainIcon"), byPath(base + "UnlockObtain/Icon")]) {
        if (target) {
          uiRenderer.setSprite(target, obtainSprite, screenEntity(target)?.image || {}, context.manifest);
          recordRuntime(target, "SpriteName", obtainSprite, target.dataset.uiPath?.includes("UnlockObtain") ? sourceFor("_UnlockObtainIcon", "SpriteName") : sourceFor("_ObtainIcon", "SpriteName"));
        }
      }
    }
    setText(directChild(unlock, "Label"), `${uiTranslate("HUD_OBTAIN_BY")} ${obtainText}`, sourceFor("_UnlockObtainLabel", "Content"));
    setText(byPath(base + "PetDetails/Obtain/BG/ObtainWay"), obtainText, sourceFor("_ObtainWay", "Content"));
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
        setText(directChild(item, "Name"), isSpecific ? previous.Name : previous ? uiTranslate("ANY_RARITY", [uiTranslate(`RARITY_${previous.Rarity}`)]) : "chưa có dữ liệu", isSpecific ? "Assets/CSV/Pet.csv (preview row)" : sourceFor("petName", "Content", "ANY_RARITY"));
        setImage(directChild(item, "Thumbnail"), isSpecific ? icon(iconSets.petIcons, previous.ID) : "", false, { sprite: sourceFor("thumbnail", "SpriteName"), color: "Assets/HUDs/PetsCollection.ui (base image Color)" });
        const materialRarity = directChild(item, "Rarity");
        if (materialRarity) {
          const materialRarityValue = isSpecific ? previous.Rarity : pet.Rarity;
          const color = rarityColor(materialRarityValue);
          uiRenderer.tint(materialRarity, color);
          recordRuntime(materialRarity, "Color", color, rarityColorSource(materialRarityValue));
        }
        const redirect = item.querySelector('button[data-ui-hit-target="true"]');
        if (redirect) {
          redirect.dataset.uiRecipeTarget = isSpecific ? previous.ID : "";
          setVisible(redirect, !!isSpecific);
          const label = directChild(item, "Name")?.querySelector(":scope > .ui-text");
          if (label) { label.style.fontStyle = isSpecific ? "italic" : "normal"; label.style.textDecoration = isSpecific ? "underline" : "none"; }
        }
      });
    }
    setVisible(tabs, !showRecipe);
    updateTabVisuals("details", `${state.detailTab}TabButton`);
    setVisible(info, !showRecipe && state.detailTab === "Info");
    setVisible(mw, !showRecipe && state.detailTab !== "Info");
    const value = owned ? `${big(pet.Value)}/s` : rules.details.unownedValue;
    setText(byPath(base + "Info/Value/Content"), `${uiTranslate("HUD_COLLECTION_VALUE")} ${value}`, sourceFor("valueContent", "Content"));
    setText(byPath(base + "Info/Mutations/Content"), `${uiTranslate("HUD_COLLECTION_MUTATION_COUNT")} (${owned ? mutationRows.filter(row => effectOwned(pet, row, "mutation")).length : 0}/${mutationRows.length})`, sourceFor("mutationsContent", "Content"));
    setText(byPath(base + "Info/Weathers/Content"), `${uiTranslate("HUD_COLLECTION_WEATHER_COUNT")} (${owned ? weatherRows.filter(row => effectOwned(pet, row, "weather")).length : 0}/${weatherRows.length})`, sourceFor("weathersContent", "Content"));
    const rows = state.detailTab === "Weathers" ? weatherRows : mutationRows;
    while (mwIcons.length < rows.length) mwIcons.push(cloneTemplate(mwTemplate, mwLayout));
    mwIcons.forEach((el, i) => {
      const row = rows[i]; setVisible(el, !!row); if (!row) return;
      const ownedEffect = effectOwned(pet, row, state.detailTab === "Weathers" ? "weather" : "mutation");
      const color = ownedEffect ? rules.details.ownedIconColor : rules.details.unownedIconColor;
      setImage(el, state.detailTab === "Weathers" ? icon(iconSets.weatherEffectIcons, row.ID) : icon(iconSets.mutationIcons, row.ID), color, {
        sprite: state.detailTab === "Weathers" ? sourceFor("icon", "SpriteName", "WeatherConfigs") : sourceFor("icon", "SpriteName", "MutationConfigs"),
        color: ownedEffect ? rules.runtimeColorRules.mutationWeatherOwned.source : rules.runtimeColorRules.mutationWeatherUnowned.source
      });
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
    updateTabVisuals("rarity", `${state.rarity[0]}${state.rarity.slice(1).toLowerCase()}TabButton`);
    notify();
  }
  function selectPage(page) {
    const count = Math.ceil(filtered().length / rules.page.size);
    if (page < 0 || page >= count) return;
    state.page = page; state.selected = currentPagePets()[0] || null; state.detailTab = "Info"; updateCards();
  }
  function setRarity(rarity) { if (!rules.rarityTabs[rarity]) return; state.rarity = rarity; state.page = 0; state.selected = currentPagePets()[0] || null; state.detailTab = "Info"; updateCards(); }
  const panel = document.getElementById("ui-player-panel");
  if (!options.passive) panel.innerHTML = '<h2>Người chơi giả lập</h2><p>Chỉ mô phỏng sở hữu để xem trạng thái HUD. Không phải dữ liệu người chơi thật.</p>' +
    '<label>Trạng thái <select id="ui-player-mode"><option value="all">Sở hữu tất cả</option><option value="none">Không sở hữu</option><option value="random">Ngẫu nhiên có seed</option><option value="custom">Tự chọn</option></select></label>' +
    '<label>Seed <input id="ui-player-seed" type="number" value="42"></label><label><input id="ui-loading" type="checkbox"> Giả lập dữ liệu đang tải</label><p id="ui-custom-selected"></p><label><input id="ui-custom-pet" type="checkbox"> Sở hữu pet đang chọn</label>' +
    '<details><summary>Mutation của pet</summary>' + mutationRows.map(row => `<label><input type="checkbox" data-ui-custom-effect="mutation" value="${esc(row.ID)}"> ${esc(row.Name)}</label>`).join("") + '</details>' +
    '<details><summary>Weather của pet</summary>' + weatherRows.map(row => `<label><input type="checkbox" data-ui-custom-effect="weather" value="${esc(row.ID)}"> ${esc(row.Name)}</label>`).join("") + '</details>';
  state.selected = currentPagePets()[0] || null;
  setVisible(named("LoadingLabel"), false);
  updateCards();
  if (!options.passive) rendered.canvas.addEventListener("click", event => {
    const hitButton = event.target.closest('button[data-ui-hit-target="true"]');
    if (!hitButton || hitButton.disabled) return;
    const recipeTarget = hitButton.dataset.uiRecipeTarget;
    if (recipeTarget) {
      const previous = pets.find(pet => pet.ID === recipeTarget);
      if (previous) { state.rarity = previous.Rarity; state.page = Math.floor(filtered().findIndex(pet => pet.ID === previous.ID) / rules.page.size); state.selected = previous; updateCards(); }
      return;
    }
    const card = event.target.closest("[data-ui-pet-id]");
    let button = event.target.closest("[data-ui-name]"); if (!button) return;
    while (button && button !== rendered.canvas && !/^(CloseButton|DarkBG|PreventCloseButton|PrevPageButton|NextPageButton|(All|Common|Rare|Epic|Legendary|Mythic|Apex|Limited|Info|Mutations|Weathers)TabButton)$/.test(button.dataset.uiName || "")) button = button.parentElement?.closest("[data-ui-name]");
    const name = button && button !== rendered.canvas ? button.dataset.uiName : "";
    if (name === "CloseButton" || name === "DarkBG") { context.open = false; rendered.canvas.classList.add("ui-closed"); document.getElementById("ui-open-toggle").textContent = "Mở UI"; options.onClose?.(); return; }
    if (name === "PreventCloseButton") return;
    if (state.loading) return;
    if (name === "PrevPageButton") { selectPage(state.page - 1); return; }
    if (name === "NextPageButton") { selectPage(state.page + 1); return; }
    const tab = name.match(/^(All|Common|Rare|Epic|Legendary|Mythic|Apex|Limited)TabButton$/);
    if (tab) { setRarity(tab[1].toUpperCase()); return; }
    const detailsTab = name.match(/^(Info|Mutations|Weathers)TabButton$/);
    if (detailsTab) { state.detailTab = detailsTab[1]; updateDetails(); notify(); return; }
    if (card) { state.selected = pets.find(pet => pet.ID === card.dataset.uiPetId); state.detailTab = "Info"; updateCards(); }
  });
  if (!options.passive) panel.addEventListener("change", event => {
    const el = event.target;
    if (el.id === "ui-player-mode") state.mode = el.value;
    if (el.id === "ui-player-seed") state.seed = Number(el.value) || 0;
    if (el.id === "ui-loading") state.loading = el.checked;
    if (el.id === "ui-custom-pet" && state.selected) { (el.checked ? state.customPets.add : state.customPets.delete).call(state.customPets, state.selected.ID); state.mode = "custom"; panel.querySelector("#ui-player-mode").value = "custom"; }
    if (el.dataset.uiCustomEffect && state.selected) { const set = el.dataset.uiCustomEffect === "mutation" ? state.customMutations : state.customWeathers; const key = `${state.selected.ID}/${el.value}`; if (el.checked) { set.add(key); state.customPets.add(state.selected.ID); } else set.delete(key); state.mode = "custom"; panel.querySelector("#ui-player-mode").value = "custom"; }
    updateCards();
  });
  return { refresh: updateCards };
}
