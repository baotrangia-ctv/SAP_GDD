import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UI_FILES = [{ id: "collection", name: "Collection", file: "PetsCollection.ui", status: "ready" }];
const PLANNED = ["Shop", "Mail", "Mission", "Leaderboard"].map(name => ({ id: name.toLowerCase(), name, status: "planned" }));
const PROP_FIELDS = {
  image: ["source", "color", "reverse", "fillType", "slicedBorder", "tiledBorder", "centerInvisible", "fillDir", "fillAmount", "invertFill", "flip", "gradient", "gradientTop", "gradientBottom", "isApplyAnimation", "animationAtlasID", "animationFrameRate", "animationLoop"],
  button: ["spriteName", "normal", "highlight", "pressed", "disabled", "enableBorderImage", "disableCollider", "fillType", "slicedBorder", "tiledBorder", "centerInvisible", "fillDir", "fillAmount", "invertFill", "reverse", "flip", "gradient", "gradientTop", "gradientBottom"],
  text: ["value", "key", "font", "fontSize", "fontStyle", "color", "alignment", "lineSpacing", "background", "backgroundColor", "overflow", "backgroundRGBA", "shadow", "shadowColor", "shadowOffset", "gradient", "gradientTop", "gradientBottom", "outline", "outlineColor", "outlineAlpha", "outlineOffset", "shadowAlpha"],
  layout: ["enable", "type", "corner", "offset", "space", "size", "constraint", "direction", "fixedRowCount", "fixedColumnCount", "tableOffset", "tableSpace", "sortType", "ignoreInactive"]
};
const ENTITY_FIELDS = new Set(["_tag", "_entityId", "_entityName", "children", "prefabVariant", "activeValue", "unlockedValue", "editorLockValue", "editorVisibleValue", "propsData", "ecaScripts", "ecaProps", "componentList", "entityTagData", "layer", "discriminator", "version"]);
function parseCsv(raw) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') { if (quoted && raw[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && raw[i + 1] === "\n") i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

export function syncUiPreview(sourceRoot, gddRoot) {
  const dist = path.resolve(gddRoot, "dist");
  const game = path.resolve(sourceRoot);
  if (isWithin(game, dist)) throw new Error("UI output cannot be inside game checkout");
  function output(...parts) {
    const file = path.resolve(dist, ...parts);
    if (!isWithin(dist, file) || isWithin(game, file)) throw new Error("Unsafe UI output path: " + file);
    mkdirSync(path.dirname(file), { recursive: true });
    return file;
  }
  function json(parts, value) { writeFileSync(output(...parts), JSON.stringify(value, null, 2) + "\n"); }
  function source(rel) {
    const absolute = path.resolve(game, rel);
    if (!isWithin(game, absolute)) throw new Error("Unsafe UI source path: " + rel);
    return absolute;
  }
  const registry = { screens: [...UI_FILES.map(({ id, name, status }) => ({ id, name, status, data: `./data/ui/${id}.json`, rules: `./data/ui/${id}-rules.json` })), ...PLANNED] };
  json(["data", "ui", "registry.json"], registry);

  for (const ui of UI_FILES) {
    const uiRel = path.join("Assets", "HUDs", ui.file);
    const raw = readFileSync(source(uiRel), "utf8");
    const commentAt = raw.lastIndexOf("\n//");
    const parsed = JSON.parse(commentAt >= 0 ? raw.slice(0, commentAt) : raw);
    const sprites = new Map();
    const unsupported = [];
    let entityCount = 0;
    function sprite(ref, entityPath, origin = ".ui") {
      if (!ref || typeof ref !== "object") return null;
      const filePath = String(ref.filePath || "");
      if (!filePath) return null;
      const key = filePath.replaceAll("\\", "/");
      if (!sprites.has(key)) {
        const entry = { key, output: null, missing: false, references: [], origins: [], border: null, width: null, height: null };
        if (key.startsWith("lib://") || !key.startsWith("Assets/") || !key.toLowerCase().endsWith(".png")) entry.missing = true;
        else {
          const input = source(key);
          if (!existsSync(input)) entry.missing = true;
          else {
            const name = key.startsWith("Assets/Sprites/") ? key.slice("Assets/Sprites/".length).replaceAll("/", "__") : key.slice("Assets/".length).replaceAll("/", "__");
            const url = `./assets/ui-sprites/${ui.id}/${name}`;
            copyFileSync(input, output("assets", "ui-sprites", ui.id, name));
            entry.output = url;
            const png = readFileSync(input);
            if (png.toString("ascii", 1, 4) === "PNG") { entry.width = png.readUInt32BE(16); entry.height = png.readUInt32BE(20); }
            const meta = input + ".meta";
            if (existsSync(meta)) {
              const data = JSON.parse(readFileSync(meta, "utf8"));
              entry.border = { left: Number(data.borderLeft) || 0, right: Number(data.borderRight) || 0, top: Number(data.borderTop) || 0, bottom: Number(data.borderBottom) || 0 };
            }
          }
        }
        sprites.set(key, entry);
      }
      sprites.get(key).references.push(entityPath);
      if (!sprites.get(key).origins.includes(origin)) sprites.get(key).origins.push(origin);
      return key;
    }
    function normalize(node, parentPath = "") {
      entityCount += 1;
      const name = node._entityName || ui.file.replace(/\.ui$/i, "");
      const entityPath = parentPath ? parentPath + "/" + name : name;
      const props = node.propsData || {};
      const result = {
        path: entityPath, id: node._entityId, name, type: node._tag?.type || "Unknown",
        active: props.activeSelf ?? node.activeValue?.selfValue ?? true,
        transform: props.transform || null, alpha: props.alpha ?? 100,
        image: null, button: null, text: null, layout: null,
        ecaProps: node.ecaProps || {}, unsupported: [], children: []
      };
      for (const kind of Object.keys(PROP_FIELDS)) if (props[kind]) {
        const value = props[kind];
        result[kind] = Object.fromEntries(PROP_FIELDS[kind].filter(key => key in value).map(key => [key, value[key]]));
        if (kind === "image") result.image.spriteKey = sprite(value.source, entityPath);
        if (kind === "button") result.button.spriteKey = sprite(value.spriteName, entityPath);
        for (const key of Object.keys(value)) if (!PROP_FIELDS[kind].includes(key)) result.unsupported.push(`${kind}.${key}`);
      }
      for (const key of Object.keys(props)) if (!["activeSelf", "transform", "alpha", "priority", ...Object.keys(PROP_FIELDS)].includes(key)) result.unsupported.push(`propsData.${key}`);
      for (const key of Object.keys(node)) if (!ENTITY_FIELDS.has(key)) result.unsupported.push(key);
      if (node.prefabVariant) result.unsupported.push("prefabVariant");
      if (node.ecaScripts?.length) result.unsupported.push("ecaScripts");
      if (node.componentList?.length) result.unsupported.push("componentList");
      result.children = (node.children || []).map(child => normalize(child, entityPath));
      if (result.unsupported.length) unsupported.push({ path: entityPath, id: result.id, fields: result.unsupported });
      return result;
    }
    const tree = normalize(parsed);
    json(["data", "ui", `${ui.id}.json`], {
      id: ui.id, source: uiRel.replaceAll("\\", "/"), entityCount,
      referenceSize: { width: tree.transform?.sizeDelta?.x || null, height: tree.transform?.sizeDelta?.y || null },
      referenceSizeNote: "suy từ sizeDelta của root; độ phân giải tham chiếu engine chưa có dữ liệu",
      tree
    });
    json(["data", "ui", `${ui.id}-sprites.json`], { sprites: [...sprites.values()], missing: [...sprites.values()].filter(item => item.missing), unsupported });
    if (ui.id === "collection") {
      json(["data", "ui", "collection-rules.json"], collectionRules(source));
      const keys = new Set();
      function textKeys(node) { if (node.text?.key) keys.add(node.text.key); node.children.forEach(textKeys); }
      textKeys(tree);
      const hud = readFileSync(source("Assets/Scripts/HUDs/HudCollection.fcg"), "utf8");
      const pet = readFileSync(source("Assets/Scripts/Configs/PetConfigs.fcg"), "utf8");
      const rarityAt = pet.indexOf("RARITIES_NAME"), obtainAt = pet.indexOf("func GetPetObtainLocalization");
      for (const code of [hud, pet.slice(rarityAt, rarityAt + 1200), pet.slice(obtainAt, obtainAt + 1000)])
        for (const match of code.matchAll(/LocString\{"([A-Z][A-Z0-9_]+)"/g)) keys.add(match[1]);
      const petRows = parseCsv(readFileSync(source("Assets/CSV/Pet.csv"), "utf8"));
      const nameColumn = petRows[0].indexOf("Name");
      for (const row of petRows.slice(2)) if (row[nameColumn]) keys.add(row[nameColumn]);
      const rows = parseCsv(readFileSync(source("Assets/Localization/key.csv"), "utf8"));
      const columns = { key: rows[0].indexOf("Key"), english: rows[0].indexOf("English"), vietnamese: rows[0].indexOf("Vietnamese") };
      const entries = {};
      for (const row of rows.slice(1)) if (keys.has(row[columns.key])) entries[row[columns.key]] = { en: row[columns.english] || "", vi: row[columns.vietnamese] || "" };
      json(["data", "ui", "collection-i18n.json"], { source: "Assets/Localization/key.csv", entries, missing: [...keys].filter(key => !(key in entries)).sort() });
    }
    console.log(`UI ${ui.id}: ${entityCount} entities, ${sprites.size} sprites, ${[...sprites.values()].filter(item => item.missing).length} missing, ${unsupported.length} entities with unsupported fields`);
  }
}

function collectionRules(source) {
  const hudFile = "Assets/Scripts/HUDs/HudCollection.fcg";
  const managerFile = "Assets/Scripts/Manager/CollectionManager.fcg";
  const petFile = "Assets/Scripts/Configs/PetConfigs.fcg";
  const hud = readFileSync(source(hudFile), "utf8").split(/\r?\n/);
  const manager = readFileSync(source(managerFile), "utf8").split(/\r?\n/);
  const petCode = readFileSync(source(petFile), "utf8").split(/\r?\n/);
  function find(lines, pattern, file) {
    const index = lines.findIndex(line => pattern.test(line));
    if (index < 0) throw new Error(`Collection rule missing from ${file}: ${pattern}`);
    return { line: lines[index], source: `${file}:${index + 1}` };
  }
  const rarityStart = find(hud, /RARITY_INDEX Map<RarityEnum, int>/, hudFile);
  const rarityMap = {};
  for (let i = Number(rarityStart.source.split(":").at(-1)); i < hud.length && !hud[i].includes("}"); i++) {
    const match = hud[i].match(/RarityEnum\.(\w+):\s*(\d+)/);
    if (match) rarityMap[match[1].toUpperCase()] = { index: Number(match[2]), source: `${hudFile}:${i + 1}` };
  }
  if (Object.keys(rarityMap).length !== 8) throw new Error("Expected eight verified Collection rarity tabs");
  const page = find(hud, /MAX_PETS_PER_PAGE int = \d+/, hudFile);
  const mutationStart = find(manager, /MUTATION_START_INDEX = \d+/, managerFile);
  const weatherStart = find(manager, /WEATHER_START_INDEX = \d+/, managerFile);
  const required = (lines, pattern, file) => find(lines, pattern, file).source;
  const tabCalls = hud.map((line, index) => ({ line, index })).filter(item => /SetTabButtonState\(/.test(item.line) && /EResSprite\./.test(item.line));
  const tabGroups = [...new Map(tabCalls.map(({ line, index }) => {
    const match = line.match(/SetTabButtonState\([^,]+, "(Text|Label)", EResSprite\.(\w+), EResSprite\.(\w+),/);
    if (!match) throw new Error(`Unrecognized tab state call at ${hudFile}:${index + 1}`);
    return [match[1] + match[2] + match[3], { textChild: match[1], selectedSprite: `Assets/Sprites/NewAssets/${match[2]}.png`, normalSprite: `Assets/Sprites/NewAssets/${match[3]}.png`, selectedTextColor: find(hud, /ACTIVE_TEXT_COLOR = #/, hudFile).line.match(/#[0-9A-Fa-f]+/)[0], normalTextColor: find(hud, /DEFAULT_TEXT_COLOR = #/, hudFile).line.match(/#[0-9A-Fa-f]+/)[0], source: `${hudFile}:${index + 1}` }];
  }))].map(([, value]) => value);
  if (tabGroups.length !== 2) throw new Error("Expected rarity and details tab sprite rules");
  return {
    sourceFiles: [hudFile, managerFile, petFile],
    tabVisuals: { rarity: tabGroups.find(group => group.textChild === "Text"), details: tabGroups.find(group => group.textChild === "Label") },
    rarityTabs: rarityMap,
    page: {
      size: Number(page.line.match(/=\s*(\d+)/)[1]), source: page.source,
      grouping: "sequential chunks; totalPages = number of chunks; index starts at 0",
      groupingSource: required(hud, /for i = 0, List.Length\(pets\), MAX_PETS_PER_PAGE/, hudFile),
      boundsSource: required(hud, /_TotalPages <= 0 \|\| pageIndex < 0 \|\| pageIndex >= _TotalPages/, hudFile),
      label: "(currentPageIndex + 1) / totalPages when totalPages > 1",
      labelSource: required(hud, /_PageLabel<UIWidgetLabel>\.Content = \(_CurrentPageIndex \+ 1\)/, hudFile)
    },
    petFilter: {
      excludeLuckyBox: true, source: required(hud, /if PetConfigs.IsLuckyBoxPetId\(petId\)/, hudFile),
      luckyBoxStart: Number(find(petCode, /LUCKY_BOX_START_INDEX int = \d+/, petFile).line.match(/=\s*(\d+)/)[1]),
      luckyBoxCount: Number(find(petCode, /LUCKY_BOX_COUNT int = \d+/, petFile).line.match(/=\s*(\d+)/)[1]),
      rangeSource: required(petCode, /return LUCKY_BOX_START_INDEX < petId && petId <= LUCKY_BOX_START_INDEX \+ LUCKY_BOX_COUNT/, petFile)
    },
    unowned: { name: "???", tint: "#111111", source: required(hud, /if !CollectionManager.IsOwnPet/, hudFile), tintSource: required(hud, /DEFAULT_COLOR = #111111/, hudFile) },
    details: {
      defaultTab: "Info", source: required(hud, /_CurrentDetailsTab = DETAILS_TAB_INFO/, hudFile),
      tabs: { Info: 0, Mutations: 1, Weathers: 2 },
      tabsSource: required(hud, /DETAILS_TAB_INFO int = 0/, hudFile),
      ownedValue: "PetConfigs.GetPetValue(petId) formatted by BigNumberHandler.ToDisplayFormat(..., 1) + '/s'",
      valueSource: required(hud, /valueText = BigNumberHandler.ToDisplayFormat/, hudFile),
      unownedValue: "???", unownedValueSource: required(hud, /var valueText string = "\?\?\?"/, hudFile),
      mutationStartId: Number(mutationStart.line.match(/=\s*(\d+)/)[1]), mutationStartSource: mutationStart.source,
      weatherStartId: Number(weatherStart.line.match(/=\s*(\d+)/)[1]), weatherStartSource: weatherStart.source,
      ownedIconColor: find(hud, /OWNED_MW_ICON_COLOR = #[0-9A-Fa-f]+/, hudFile).line.match(/#[0-9A-Fa-f]+/)[0],
      unownedIconColor: find(hud, /NOT_OWNED_MW_ICON_COLOR = #[0-9A-Fa-f]+/, hudFile).line.match(/#[0-9A-Fa-f]+/)[0],
      iconSource: required(hud, /icon<UIWidgetImage>\.Color = NOT_OWNED_MW_ICON_COLOR/, hudFile)
    },
    mwGrid: {
      size: Number(find(hud, /MW_ICON_SIZE int = \d+/, hudFile).line.match(/=\s*(\d+)/)[1]),
      verticalSpacing: Number(find(hud, /MW_LAYOUT_VERTICAL_SPACING int = \d+/, hudFile).line.match(/=\s*(\d+)/)[1]),
      columns: Number(find(hud, /MW_LAYOUT_MAX_ICONS_PER_ROW int = \d+/, hudFile).line.match(/=\s*(\d+)/)[1]),
      source: required(hud, /MW_LAYOUT_MAX_ICONS_PER_ROW int = \d+/, hudFile)
    },
    obtain: {
      showOwnedPanelWhenOwned: true, showUnlockWhenUnowned: true,
      source: required(hud, /_UnlockObtainWidget<UIWidget>\.IsVisible = !isOwned/, hudFile),
      sourceFunction: "PetConfigs.GetPetObtainSource(petId, fishingPool, digPool)",
      sourceFunctionAt: required(hud, /var source int = PetConfigs.GetPetObtainSource/, hudFile),
      precedence: ["giftcode", "luckybox", "fusion", "road", "fishing", "dig", "event"],
      precedenceSource: required(petCode, /func GetPetObtainSource\(/, petFile),
      giftcodePetIds: [...find(petCode, /PET_OBTAIN_GIFTCODE_PET_IDS List<int> = List<int>\{/, petFile).line.match(/\{([^}]*)\}/)[1].matchAll(/\d+/g)].map(x => Number(x[0])),
      luckyboxPetIds: [...find(petCode, /PET_OBTAIN_LUCKYBOX_PET_IDS List<int> = List<int>\{/, petFile).line.match(/\{([^}]*)\}/)[1].matchAll(/\d+/g)].map(x => Number(x[0])),
      secretFusionStart: Number(find(petCode, /SECRET_FUSION_PET_START_INDEX int = \d+/, petFile).line.match(/=\s*(\d+)/)[1]),
      secretFusionCount: Number(find(petCode, /SECRET_FUSION_PET_COUNT int = \d+/, petFile).line.match(/=\s*(\d+)/)[1]),
      secretFusionException: Number(find(petCode, /if petId == \d+/, petFile).line.match(/==\s*(\d+)/)[1]),
      canFuseColumn: "CanFuse", canFuseSource: required(petCode, /CsvConfigEnum.Pet_CanFuse/, petFile),
      roadWeightColumns: [1, 2, 3, 4, 5].map(index => `Weight${index}`),
      roadSource: required(petCode, /return _PetId2Weight1\[petId\] != 0 \|\| _PetId2Weight2/, petFile),
      specialListSource: required(petCode, /PET_OBTAIN_GIFTCODE_PET_IDS List<int>/, petFile)
    },
    recipe: {
      when: "unowned and PetConfigs.GetPetObtainSource(...) == PET_OBTAIN_SOURCE_FUSION",
      conditionSource: required(hud, /if !isOwned && CanOpenRecipe\(petId\)/, hudFile),
      equalitySource: required(hud, /return source == PetConfigs.PET_OBTAIN_SOURCE_FUSION/, hudFile),
      hidesDetailsTabs: true, source: required(hud, /func OpenRecipe\(\)/, hudFile),
      previousRankOffset: Number(find(hud, /var previousRank int = petRank - \d+/, hudFile).line.match(/-\s*(\d+)/)[1]),
      previousRankSource: required(hud, /var previousRank int = petRank - \d+/, hudFile),
      previousPetSelection: "scan descending from previousRank; skip ranks without a pet or with CanFuse=false",
      previousPetSelectionSource: required(petCode, /func GetPetIdWithPrevRank\(/, petFile)
    },
    counters: {
      pets: { owned: "GetPCPetsCountByRarity", total: "GetCollectionPetIdsByRarity.length", source: required(hud, /var ownPetsCount int = CollectionManager.GetPCPetsCountByRarity/, hudFile) },
      mutations: { owned: "GetPCMutationsCountByRarity", total: "GetPetCountByRarity * (GetMutationCount - 1)", source: required(manager, /totalCount = PetConfigs.GetPetCountByRarity\(rarity\) \* \(MutationConfigs.GetMutationCount\(\) - 1\)/, managerFile) },
      weathers: { owned: "GetPCWeathersCountByRarity", total: "GetPetCountByRarity * (GetWeatherEffectCount - WEATHER_START_INDEX + 1)", source: required(manager, /totalCount = PetConfigs.GetPetCountByRarity\(rarity\) \* \(WeatherConfigs.GetWeatherEffectCount/, managerFile) },
      progress: "owned / total; 0 when total <= 0 or owned < 0", source: required(hud, /progress<UIWidgetImage>\.FillAmount = Convert.IntToFloat\(owned\)/, hudFile)
    },
    loading: { visibleWhen: "Collection database not ready", source: required(hud, /if !DatabaseController.IsDatabaseReady\(thisEntity<Player>\.UserUID, DatabaseType.Collection\)/, hudFile) },
    close: { function: "CloseCollection sets Collection widget IsVisible = false", source: required(hud, /func CloseCollection\(\)/, hudFile), buttonRoutingUnverified: true },
    ownership: { source: required(manager, /func IsOwnPet\(/, managerFile), simulated: true }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--project-root");
  if (at < 0 || !args[at + 1]) throw new Error("Usage: node tools/sync-ui-preview.mjs --project-root <StealAPet checkout>");
  syncUiPreview(args[at + 1], path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
}
