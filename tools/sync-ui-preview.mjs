import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mailRules } from "./ui-mail-source.mjs";
import { shopRules } from "./ui-shop-source.mjs";
import { activitiesRules } from "./ui-activities-source.mjs";
import { sourceScreenRules } from "./ui-source-screen.mjs";
import { shopEventSpec } from "./ui-shop-event-source.mjs";
import { rebirthSpec } from "./ui-rebirth-source.mjs";
import { lobbySpec } from "./ui-lobby-source.mjs";
import { fusionConfirmSpec, fusionResultSpec } from "./ui-fusion-source.mjs";
import { leaderboardSpec } from "./ui-leaderboard-source.mjs";
import { permanentSpec } from "./ui-permanent-source.mjs";
import { storageSpec } from "./ui-storage-source.mjs";

const SOURCE_SCREENS = [shopEventSpec, rebirthSpec, lobbySpec, fusionConfirmSpec, fusionResultSpec, leaderboardSpec, permanentSpec, storageSpec];

const UI_FILES = [{ id: "collection", name: "Collection", file: "PetsCollection.ui", status: "ready" }, { id: "activities", name: "Activities", file: "Activities.ui", status: "ready" }, { id: "shop", name: "Shop", file: "Shop.ui", status: "ready" }, { id: "mail", name: "Mail", file: "Mail.ui", status: "ready" }];
UI_FILES.push(...SOURCE_SCREENS.map(spec => ({ id: spec.id, name: spec.name || "Shop Event", file: spec.ui, status: "ready" })));
const PLANNED = ["Mission"].map(name => ({ id: name.toLowerCase(), name, status: "planned" }));
const PROTOTYPES = [{ id: "lock-base", name: "Lock Base", status: "ready", sourceScreen: "fusion-confirm" }];
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

export function syncUiPreview(sourceRoot, gddRoot, screenId = null) {
  if (screenId && !UI_FILES.some(ui => ui.id === screenId)) throw new Error("Unregistered UI: " + screenId);
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
  const registry = { screens: [...UI_FILES.map(({ id, name, status }) => ({ id, name, status, data: `./data/ui/${id}.json`, rules: `./data/ui/${id}-rules.json` })), ...PROTOTYPES, ...PLANNED] };
  json(["data", "ui", "registry.json"], registry);

  for (const ui of UI_FILES.filter(ui => !screenId || ui.id === screenId)) {
    const uiRel = path.join("Assets", "HUDs", ui.file);
    const raw = readFileSync(source(uiRel), "utf8");
    const commentAt = raw.lastIndexOf("\n//");
    const parsed = JSON.parse(commentAt >= 0 ? raw.slice(0, commentAt) : raw);
    const sprites = new Map();
    // Studio keeps the asset identity when a sprite is moved or renamed;
    // serialized filePath values in older HUDs can still point to its old name.
    // Only index metadata in the relocation directory confirmed for this HUD.
    const relocatedById = new Map();
    if (ui.id !== "collection") {
      const registration = readFileSync(source("ProjectSettings/ResourceRegisteration.asset"), "utf8");
      const resources = JSON.parse(registration.includes("\n//") ? registration.slice(0, registration.lastIndexOf("\n//")) : registration).Resource.texture;
      (function walk(node) {
        const ref = node.refer, key = ref?.filePath?.replaceAll("\\", "/");
        if (key?.startsWith("Assets/") && key.endsWith(".png") && existsSync(source(key))) {
          const candidates = relocatedById.get(ref.fileId) || [];
          if (!candidates.includes(key)) candidates.push(key);
          relocatedById.set(ref.fileId, candidates);
        }
        (node.children || []).forEach(walk);
      })(resources);
    }
    const relocationDirectory = "Assets/Sprites/NewAssets";
    for (const name of readdirSync(source(relocationDirectory)).sort()) {
      if (!name.toLowerCase().endsWith(".png.meta")) continue;
      const key = `${relocationDirectory}/${name.slice(0, -5)}`;
      const metadata = JSON.parse(readFileSync(source(key + ".meta"), "utf8"));
      if (!metadata.fileId) continue;
      const candidates = relocatedById.get(metadata.fileId) || [];
      if (!candidates.includes(key)) candidates.push(key);
      relocatedById.set(metadata.fileId, candidates);
    }
    const legacySpritePaths = {
      "Assets/Sprites/UIComponents/Backgrounds/BG.png": "Assets/Sprites/Backgrounds/BG.png",
      "Assets/Sprites/ShadowTriangleRounded.png": "Assets/Sprites/Shapes/ShadowTriangleRounded.png",
      ...(ui.id === "activities" ? { "Assets/Sprites/Icons/PetPointIcon.png": "Assets/Sprites/Icons/DMMPointIcon.png" } : {})
    };
    const unsupported = [];
    let entityCount = 0;
    function sprite(ref, entityPath, origin = ".ui") {
      if (!ref || typeof ref !== "object") return null;
      const filePath = String(ref.filePath || "");
      if (!filePath) return null;
      const declaredKey = filePath.replaceAll("\\", "/");
      let key = declaredKey;
      if (declaredKey.startsWith("Assets/") && !existsSync(source(declaredKey))) {
        const candidates = ref.fileId ? relocatedById.get(ref.fileId) || [] : [];
        if (ui.id !== "collection" && declaredKey.includes("/UIComponents/")) {
          const candidate = declaredKey.replace("/UIComponents/", "/");
          if (existsSync(source(candidate)) && existsSync(source(candidate + ".meta")) && JSON.parse(readFileSync(source(candidate + ".meta"), "utf8")).fileId === ref.fileId && !candidates.includes(candidate)) candidates.push(candidate);
        }
        if (candidates.length > 1) throw new Error(`Ambiguous sprite fileId ${ref.fileId}: ${candidates.join(", ")}`);
        if (candidates.length === 1) key = candidates[0];
        else if (legacySpritePaths[declaredKey]) {
          const candidate = legacySpritePaths[declaredKey];
          const meta = source(candidate + ".meta");
          if (existsSync(source(candidate)) && existsSync(meta) && JSON.parse(readFileSync(meta, "utf8")).fileId === ref.fileId) key = candidate;
        }
      }
      if (!sprites.has(key)) {
        const entry = { key, declaredKey, declaredKeys: [], fileId: ref.fileId || null, output: null, missing: false, references: [], origins: [], border: null, width: null, height: null };
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
      if (!sprites.get(key).declaredKeys.includes(declaredKey)) sprites.get(key).declaredKeys.push(declaredKey);
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
        priority: props.priority ?? 0,
        image: null, button: null, text: null, layout: null,
        propsData: props, ecaProps: node.ecaProps || {}, unsupported: [], children: []
      };
      if (!["collection", "activities"].includes(ui.id)) result.sourceFields = Object.fromEntries(Object.entries(node).filter(([key]) => !["children", "propsData", "ecaProps"].includes(key)));
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
    const spec = SOURCE_SCREENS.find(spec => spec.id === ui.id);
    if (spec) {
      const { rules, i18n } = sourceScreenRules(spec, source, tree, sprite, parseCsv);
      json(["data", "ui", `${ui.id}-rules.json`], rules);
      json(["data", "ui", `${ui.id}-i18n.json`], i18n);
    }
    json(["data", "ui", `${ui.id}.json`], {
      id: ui.id, source: uiRel.replaceAll("\\", "/"), entityCount,
      referenceSize: { width: tree.transform?.sizeDelta?.x || null, height: tree.transform?.sizeDelta?.y || null },
      referenceSizeNote: "suy từ sizeDelta của root; độ phân giải tham chiếu engine chưa có dữ liệu",
      renderingPolicy: {
        ...(spec?.nonGridLayout ? { nonGridLayout: spec.nonGridLayout, layoutStatus: "non-grid layout uses authored serialized child transforms; engine fill algorithm unverified" } : {}),
        alpha: "subtree-composite", alphaStatus: "existing web approximation retained; runtime cascade unverified",
        hitTest: "button-rect-unless-disableCollider", hitTestStatus: "DisableCollider documented; alpha threshold and image blocking unverified",
        stacking: "source-tree-order", stackingStatus: ui.id === "activities" ? "runtime mission priority is applied by the source grid sortType; engine depth ordering unverified" : "all source priorities are zero; engine depth ordering unverified",
        tint: "per-pixel RGB multiplication by Color with source sprite alpha retained",
        tintStatus: "matches requested blend model; Craftland runtime pixel output not verified",
        imageGradient: "vertical interpolation from GradientTop to GradientBottom when gradient is nonzero",
        imageGradientStatus: "MCP documents top/bottom gradient colors; numeric mode semantics and runtime output are unverified",
        text: "source font style and horizontal/vertical alignment; overflow 0 reduces font size to fit the label; source fontSize is the maximum; text clips to RectTransform",
        textStatus: "Overflow 0 (Reduce when exceed) confirmed by designer; Default uses an explicit browser sans-serif fallback, not the engine font; lineSpacing units, other overflow modes and exact effects remain unverified",
        textBackground: "backgroundRGBA when alpha is nonzero; otherwise backgroundColor when background is enabled",
        fill: "FillType values use simple/sliced/tiled/filled/fit rendering; horizontal/vertical/radial fills use CSS clip-path or conic mask",
        fillStatus: "enum labels confirmed by MCP; radial origin/sweep/invert behavior and Fit sizing are approximations",
        flip: "reverse.x/reverse.y map to visual axis flips; numeric flip is retained",
        flipStatus: "all source flip values are zero; numeric FlipType behavior is not documented",
        rotation: "CSS rotation uses the RectTransform pivot as transform origin",
        rotationStatus: ui.id === "mail" ? "source includes rotated alert icon; web uses serialized CSS angle, engine sign unverified" : ui.id === "activities" ? "serialized spin reward rotations use negative CSS angles; engine sign and tween easing unverified" : "all source rotations are zero; angle sign in nonzero runtime cases is unverified",
        viewport: "root sizeDelta and selectable viewport aspect frame; cover-crop preview",
        viewportStatus: "Editor docs describe root adaptation to device aspect ratio; reference resolution, match mode, and safe area are not specified"
      },
      tree
    });
    if (ui.id === "activities") {
      const { rules, i18n } = activitiesRules(source, tree, sprite, parseCsv);
      json(["data", "ui", "activities-rules.json"], rules);
      json(["data", "ui", "activities-i18n.json"], i18n);
    }
    if (ui.id === "mail") {
      const { rules, i18n } = mailRules(source, tree, sprite, parseCsv);
      json(["data", "ui", "mail-rules.json"], rules);
      json(["data", "ui", "mail-i18n.json"], i18n);
    }
    if (ui.id === "shop") {
      const { rules, i18n } = shopRules(source, tree, sprite, parseCsv);
      json(["data", "ui", "shop-rules.json"], rules);
      json(["data", "ui", "shop-i18n.json"], i18n);
    }
    if (ui.id === "collection") {
      const rules = collectionRules(source);
      deriveCollectionPets(source, rules);
      const files = readdirSync(source("Assets/Sprites"), { recursive: true }).filter(name => String(name).toLowerCase().endsWith(".png")).map(name => `Assets/Sprites/${String(name).replaceAll("\\", "/")}`);
      for (const [kind, name] of Object.entries(rules.obtain.icons)) {
        const matches = files.filter(file => file.split("/").at(-1) === `${name}.png`);
        if (matches.length === 1) { rules.obtain.iconSpriteKeys[kind] = matches[0]; sprite({ filePath: matches[0] }, `runtime:obtain:${kind}`, "runtime-code"); }
        else rules.obtain.iconSpriteKeys[kind] = null;
      }
      rules.recipe.iconSpriteKeys = {};
      for (const recipe of Object.values(rules.recipe.byPetId)) {
        const key = recipe.thumbnailKey;
        if (key in rules.recipe.iconSpriteKeys) continue;
        const file = `Assets/Sprites/Summon/${recipe.previousRarity}.png`;
        rules.recipe.iconSpriteKeys[key] = sprite({ filePath: file }, `runtime:recipe:${key}`, "runtime-code");
      }
      json(["data", "ui", "collection-rules.json"], rules);
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
    json(["data", "ui", `${ui.id}-sprites.json`], { sprites: [...sprites.values()], missing: [...sprites.values()].filter(item => item.missing), unsupported });
    console.log(`UI ${ui.id}: ${entityCount} entities, ${sprites.size} sprites, ${[...sprites.values()].filter(item => item.missing).length} missing, ${unsupported.length} entities with unsupported fields`);
  }
}

function deriveCollectionPets(source, rules) {
  const petCsv = "Assets/CSV/Pet.csv";
  const rawPets = parseCsv(readFileSync(source(petCsv), "utf8"));
  const pets = rawPets.slice(2).map(row => Object.fromEntries(rawPets[0].map((key, index) => [key, row[index] || ""])));
  const poolFiles = { fishing: "Assets/CSV/Event/Fishing/PoolFishing.csv", dig: "Assets/CSV/Event/Dig/DigPools.csv" };
  const pools = Object.fromEntries(Object.entries(poolFiles).map(([kind, file]) => {
    const rows = parseCsv(readFileSync(source(file), "utf8"));
    if (rows[0][0] !== "IDPET") throw new Error(`Unexpected Collection pool ID column: ${file}`);
    return [kind, new Set(rows.slice(2).map(row => Number(row[0])))];
  }));
  const o = rules.obtain;
  const isSecret = id => id !== o.secretFusionException && id > o.secretFusionStart && id <= o.secretFusionStart + o.secretFusionCount;
  o.byPetId = {};
  o.poolSources = poolFiles;
  rules.recipe.byPetId = {};
  for (const pet of pets) {
    const id = Number(pet.ID), canFuse = pet[o.canFuseColumn] === "1";
    const road = o.roadWeightColumns.some(column => Number(pet[column]) !== 0);
    const fishing = pools.fishing.has(id), dig = pools.dig.has(id);
    const kind = o.giftcodePetIds.includes(id) ? "giftcode" : o.luckyboxPetIds.includes(id) ? "luckybox" :
      canFuse && (isSecret(id) || !road) ? "fusion" : road ? "road" : !canFuse && fishing ? "fishing" : !canFuse && dig ? "dig" : "event";
    o.byPetId[pet.ID] = { kind, canFuse, road, fishing, dig, source: petCsv };
    if (kind !== "fusion") continue;
    const rank = Number(pet.Rank) - rules.recipe.previousRankOffset;
    let previousRank = rank;
    let previous = pets.find(row => Number(row.Rank) === previousRank);
    while (!previous || previous[o.canFuseColumn] !== "1") {
      previousRank -= 1;
      if (previousRank < 1) { previous = pets.find(row => Number(row.Rank) === rank); break; }
      previous = pets.find(row => Number(row.Rank) === previousRank);
    }
    if (!previous) continue;
    rules.recipe.byPetId[pet.ID] = { previousPetId: previous.ID, previousRarity: previous.Rarity,
      anyRarity: pet.Rarity, thumbnailKey: `Summon${previous.Rarity}`, secondIsSpecific: isSecret(Number(previous.ID)) };
  }
}

function collectionRules(source) {
  const hudFile = "Assets/Scripts/HUDs/HudCollection.fcg";
  const managerFile = "Assets/Scripts/Manager/CollectionManager.fcg";
  const petFile = "Assets/Scripts/Configs/PetConfigs.fcg";
  const clientPetFile = "Assets/Scripts/ClientConfigs/PetConfigs_Client.fcg";
  const widgetFile = "Assets/Scripts/Utils/UIUtils.fcg";
  const fishingFile = "Assets/Scripts/ClientConfigs/EventFishingConfig_Client.fcg";
  const digFile = "Assets/Scripts/ClientConfigs/EventDigConfig_Client.fcg";
  const hud = readFileSync(source(hudFile), "utf8").split(/\r?\n/);
  const manager = readFileSync(source(managerFile), "utf8").split(/\r?\n/);
  const petCode = readFileSync(source(petFile), "utf8").split(/\r?\n/);
  const clientPetCode = readFileSync(source(clientPetFile), "utf8").split(/\r?\n/);
  const widgetCode = readFileSync(source(widgetFile), "utf8").split(/\r?\n/);
  const fishingCode = readFileSync(source(fishingFile), "utf8").split(/\r?\n/);
  const digCode = readFileSync(source(digFile), "utf8").split(/\r?\n/);
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
  function readColor(lines, pattern, file) {
    const found = find(lines, pattern, file);
    const value = found.line.match(/#[0-9A-Fa-f]{6,8}/)?.[0];
    if (!value) throw new Error(`Collection color missing in ${found.source}`);
    return { value, source: found.source };
  }
  function readRarityColors() {
    const found = find(clientPetCode, /RARITY_COLOR Map<RarityEnum, Color>/, clientPetFile);
    const colors = {};
    const start = Number(found.source.split(":").at(-1)) - 1;
    for (let i = start; i < clientPetCode.length && !clientPetCode[i].includes("}"); i++) {
      const match = clientPetCode[i].match(/RarityEnum\.(\w+):\s*(#[0-9A-Fa-f]{6,8})/);
      if (match) colors[match[1].toUpperCase()] = { value: match[2], source: `${clientPetFile}:${i + 1}` };
    }
    if (Object.keys(colors).length < 7) throw new Error("Expected seven verified PetConfigs_Client rarity colors");
    return { values: colors, source: found.source };
  }
  const runtimeProperties = new Set(["Color", "OutlineColor", "SpriteName", "SpriteResource", "Content", "IsVisible", "Size", "Position", "Alpha", "FillAmount"]);
  const runtimeAssignments = hud.flatMap((line, index) => {
    const match = line.match(/^\s*(.+?)<(\w+)>\.(\w+)\s*=\s*(.+?)\s*$/);
    if (!match || !runtimeProperties.has(match[3])) return [];
    return [{ target: match[1].trim(), widgetType: match[2], property: match[3], expression: match[4], source: `${hudFile}:${index + 1}` }];
  });
  const runtimeColorRules = {
    petUnowned: readColor(hud, /DEFAULT_COLOR = #[0-9A-Fa-f]{6,8}/, hudFile),
    mutationWeatherOwned: readColor(hud, /OWNED_MW_ICON_COLOR = #[0-9A-Fa-f]{6,8}/, hudFile),
    mutationWeatherUnowned: readColor(hud, /NOT_OWNED_MW_ICON_COLOR = #[0-9A-Fa-f]{6,8}/, hudFile),
    tabActive: readColor(hud, /ACTIVE_TEXT_COLOR = #[0-9A-Fa-f]{6,8}/, hudFile),
    tabDefault: readColor(hud, /DEFAULT_TEXT_COLOR = #[0-9A-Fa-f]{6,8}/, hudFile)
  };
  const unownedNameRule = find(hud, /petName<UIWidgetLabel>\.Content = ".*"/, hudFile);
  const unownedName = unownedNameRule.line.match(/\.Content\s*=\s*"([^"]*)"/)?.[1];
  if (unownedName == null) throw new Error(`Collection unowned name missing in ${unownedNameRule.source}`);
  const tabCalls = hud.map((line, index) => ({ line, index })).filter(item => /SetTabButtonState\(/.test(item.line) && /EResSprite\./.test(item.line));
  const tabGroups = [...new Map(tabCalls.map(({ line, index }) => {
    const match = line.match(/SetTabButtonState\([^,]+, "(Text|Label)", EResSprite\.(\w+), EResSprite\.(\w+),/);
    if (!match) throw new Error(`Unrecognized tab state call at ${hudFile}:${index + 1}`);
    return [match[1] + match[2] + match[3], { textChild: match[1], selectedSprite: `Assets/Sprites/NewAssets/${match[2]}.png`, normalSprite: `Assets/Sprites/NewAssets/${match[3]}.png`, selectedTextColor: find(hud, /ACTIVE_TEXT_COLOR = #/, hudFile).line.match(/#[0-9A-Fa-f]+/)[0], normalTextColor: find(hud, /DEFAULT_TEXT_COLOR = #/, hudFile).line.match(/#[0-9A-Fa-f]+/)[0], source: `${hudFile}:${index + 1}` }];
  }))].map(([, value]) => value);
  if (tabGroups.length !== 2) throw new Error("Expected rarity and details tab sprite rules");
  const iconFunction = petCode.slice(Number(find(petCode, /func GetPetObtainIcon\(/, petFile).source.split(":").at(-1)) - 1, Number(find(petCode, /func GetPetObtainBadgeIcon\(/, petFile).source.split(":").at(-1)) - 1).join("\n");
  const iconMatches = [...iconFunction.matchAll(/source == PET_OBTAIN_SOURCE_(\w+)[\s\S]*?return EResSprite\.(\w+)/g)];
  const obtainIcons = Object.fromEntries(iconMatches.map(match => [match[1].toLowerCase(), match[2]]));
  obtainIcons.road = [...iconFunction.matchAll(/return EResSprite\.(\w+)/g)].at(-1)?.[1];
  return {
    sourceFiles: [hudFile, managerFile, petFile, clientPetFile, widgetFile, fishingFile, digFile],
    petWidget: { rarityColorSource: required(widgetCode, /func UpdatePetWidgetV3\(/, widgetFile) },
    rarityColors: readRarityColors(),
    runtimeColorRules,
    runtimeAssignments,
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
    unowned: { name: unownedName, nameSource: unownedNameRule.source, tint: runtimeColorRules.petUnowned.value, source: required(hud, /if !CollectionManager.IsOwnPet/, hudFile), tintSource: runtimeColorRules.petUnowned.source },
    details: {
      defaultTab: "Info", source: required(hud, /_CurrentDetailsTab = DETAILS_TAB_INFO/, hudFile),
      tabs: { Info: 0, Mutations: 1, Weathers: 2 },
      tabsSource: required(hud, /DETAILS_TAB_INFO int = 0/, hudFile),
      ownedValue: "PetConfigs.GetPetValue(petId) formatted by BigNumberHandler.ToDisplayFormat(..., 1) + '/s'",
      valueSource: required(hud, /valueText = BigNumberHandler.ToDisplayFormat/, hudFile),
      unownedValue: "???", unownedValueSource: required(hud, /var valueText string = "\?\?\?"/, hudFile),
      mutationStartId: Number(mutationStart.line.match(/=\s*(\d+)/)[1]), mutationStartSource: mutationStart.source,
      weatherStartId: Number(weatherStart.line.match(/=\s*(\d+)/)[1]), weatherStartSource: weatherStart.source,
      ownedIconColor: runtimeColorRules.mutationWeatherOwned.value,
      unownedIconColor: runtimeColorRules.mutationWeatherUnowned.value,
      iconSource: required(hud, /icon<UIWidgetImage>\.Color = NOT_OWNED_MW_ICON_COLOR/, hudFile)
    },
    mwGrid: {
      size: Number(find(hud, /MW_ICON_SIZE int = \d+/, hudFile).line.match(/=\s*(\d+)/)[1]),
      verticalSpacing: Number(find(hud, /MW_LAYOUT_VERTICAL_SPACING int = \d+/, hudFile).line.match(/=\s*(\d+)/)[1]),
      columns: Number(find(hud, /MW_LAYOUT_MAX_ICONS_PER_ROW int = \d+/, hudFile).line.match(/=\s*(\d+)/)[1]),
      source: required(hud, /MW_LAYOUT_MAX_ICONS_PER_ROW int = \d+/, hudFile)
    },
    obtain: {
      icons: obtainIcons, iconSpriteKeys: {},
      showOwnedPanelWhenOwned: true, showUnlockWhenUnowned: true,
      source: required(hud, /_UnlockObtainWidget<UIWidget>\.IsVisible = !isOwned/, hudFile),
      sourceFunction: "PetConfigs.GetPetObtainSource(petId, fishingPool, digPool)",
      sourceFunctionAt: required(hud, /var source int = PetConfigs.GetPetObtainSource/, hudFile),
      precedence: ["giftcode", "luckybox", "fusion", "road", "fishing", "dig", "event"],
      precedenceSource: required(petCode, /func GetPetObtainSource\(/, petFile),
      eventFallbackSource: required(petCode, /return PET_OBTAIN_SOURCE_EVENT/, petFile),
      fishingPoolSource: required(fishingCode, /CSVData.ReadCSV\(EResCSV.PoolFishing\)/, fishingFile),
      digPoolSource: required(digCode, /CSVData.ReadCSV\(EResCSV.DigPools\)/, digFile),
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
      previousPetSelectionSource: required(petCode, /func GetPetIdWithPrevRank\(/, petFile),
      thumbnailSource: required(hud, /var previousPetSprite string = "Summon" \+ previousPetRarity/, hudFile),
      anyRaritySource: required(hud, /UpdateAnyRarityPetWidget\(_RecipeMaterial1, petRarity, previousPetSprite\)/, hudFile)
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
  const screenAt = args.indexOf("--screen");
  if (screenAt >= 0 && (!args[screenAt + 1] || args[screenAt + 1].startsWith("--"))) throw new Error("--screen requires a registered screen ID");
  syncUiPreview(args[at + 1], path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), screenAt < 0 ? null : args[screenAt + 1]);
}
