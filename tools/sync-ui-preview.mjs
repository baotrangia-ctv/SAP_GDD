import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UI_FILES = [{ id: "collection", name: "Collection", file: "PetsCollection.ui", status: "ready" }];
const PLANNED = ["Shop", "Mail", "Mission", "Leaderboard"].map(name => ({ id: name.toLowerCase(), name, status: "planned" }));
const PROP_FIELDS = {
  image: ["source", "color", "reverse", "fillType", "slicedBorder", "tiledBorder", "centerInvisible", "fillDir", "fillAmount", "invertFill", "flip", "gradient", "gradientTop", "gradientBottom"],
  button: ["spriteName", "normal", "highlight", "pressed", "disabled", "enableBorderImage", "disableCollider", "fillType", "slicedBorder", "tiledBorder", "centerInvisible", "fillDir", "fillAmount", "invertFill", "reverse", "flip", "gradient", "gradientTop", "gradientBottom"],
  text: ["value", "key", "font", "fontSize", "fontStyle", "color", "alignment", "lineSpacing", "background", "backgroundColor", "overflow", "backgroundRGBA", "shadow", "shadowColor", "shadowOffset", "gradient", "gradientTop", "gradientBottom", "outline", "outlineColor", "outlineAlpha", "outlineOffset", "shadowAlpha"],
  layout: ["enable", "type", "corner", "offset", "space", "size", "constraint", "direction", "fixedRowCount", "fixedColumnCount", "tableOffset", "tableSpace", "sortType", "ignoreInactive"]
};
const ENTITY_FIELDS = new Set(["_tag", "_entityId", "_entityName", "children", "prefabVariant", "activeValue", "unlockedValue", "editorLockValue", "editorVisibleValue", "propsData", "ecaScripts", "ecaProps", "componentList", "entityTagData", "layer", "discriminator", "version"]);

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
    function sprite(ref, entityPath) {
      if (!ref || typeof ref !== "object") return null;
      const filePath = String(ref.filePath || "");
      if (!filePath) return null;
      const key = filePath.replaceAll("\\", "/");
      if (!sprites.has(key)) {
        const entry = { key, output: null, missing: false, references: [] };
        if (key.startsWith("lib://") || !key.startsWith("Assets/Sprites/") || !key.toLowerCase().endsWith(".png")) entry.missing = true;
        else {
          const input = source(key);
          if (!existsSync(input)) entry.missing = true;
          else {
            const name = key.slice("Assets/Sprites/".length).replaceAll("/", "__");
            const url = `./assets/ui-sprites/${ui.id}/${name}`;
            copyFileSync(input, output("assets", "ui-sprites", ui.id, name));
            entry.output = url;
          }
        }
        sprites.set(key, entry);
      }
      sprites.get(key).references.push(entityPath);
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
      referenceSize: null, referenceSizeNote: "chưa có dữ liệu trong .ui; kích thước khung xem là cấu hình preview",
      tree
    });
    json(["data", "ui", `${ui.id}-sprites.json`], { sprites: [...sprites.values()], missing: [...sprites.values()].filter(item => item.missing), unsupported });
    if (ui.id === "collection") json(["data", "ui", "collection-rules.json"], collectionRules(source));
    console.log(`UI ${ui.id}: ${entityCount} entities, ${sprites.size} sprites, ${[...sprites.values()].filter(item => item.missing).length} missing, ${unsupported.length} entities with unsupported fields`);
  }
}

function collectionRules(source) {
  const hudFile = "Assets/Scripts/HUDs/HudCollection.fcg";
  const managerFile = "Assets/Scripts/Manager/CollectionManager.fcg";
  const hud = readFileSync(source(hudFile), "utf8").split(/\r?\n/);
  const manager = readFileSync(source(managerFile), "utf8").split(/\r?\n/);
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
  return {
    sourceFiles: [hudFile, managerFile],
    rarityTabs: rarityMap,
    page: {
      size: Number(page.line.match(/=\s*(\d+)/)[1]), source: page.source,
      grouping: "sequential chunks; totalPages = number of chunks; index starts at 0",
      groupingSource: required(hud, /for i = 0, List.Length\(pets\), MAX_PETS_PER_PAGE/, hudFile),
      boundsSource: required(hud, /_TotalPages <= 0 \|\| pageIndex < 0 \|\| pageIndex >= _TotalPages/, hudFile),
      label: "(currentPageIndex + 1) / totalPages when totalPages > 1",
      labelSource: required(hud, /_PageLabel<UIWidgetLabel>\.Content = \(_CurrentPageIndex \+ 1\)/, hudFile)
    },
    petFilter: { excludeLuckyBox: true, source: required(hud, /if PetConfigs.IsLuckyBoxPetId\(petId\)/, hudFile) },
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
    obtain: {
      showOwnedPanelWhenOwned: true, showUnlockWhenUnowned: true,
      source: required(hud, /_UnlockObtainWidget<UIWidget>\.IsVisible = !isOwned/, hudFile),
      sourceFunction: "PetConfigs.GetPetObtainSource(petId, fishingPool, digPool)",
      sourceFunctionAt: required(hud, /var source int = PetConfigs.GetPetObtainSource/, hudFile)
    },
    recipe: {
      when: "unowned and PetConfigs.GetPetObtainSource(...) == PET_OBTAIN_SOURCE_FUSION",
      conditionSource: required(hud, /if !isOwned && CanOpenRecipe\(petId\)/, hudFile),
      equalitySource: required(hud, /return source == PetConfigs.PET_OBTAIN_SOURCE_FUSION/, hudFile),
      hidesDetailsTabs: true, source: required(hud, /func OpenRecipe\(\)/, hudFile)
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
