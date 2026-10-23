import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const rootAt = args.indexOf("--project-root");
if (rootAt < 0 || !args[rootAt + 1]) {
  console.error("Usage: node tools/sync-source-data.mjs --project-root <StealAPet checkout>");
  process.exit(64);
}
const sourceRoot = path.resolve(args[rootAt + 1]);
const gddRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const protectedGameRoot = path.resolve("D:\\Craftland\\StealAPet");
const csvRoot = path.join(sourceRoot, "Assets", "CSV");
const outPath = outputPath("dist", "data", "config-snapshot.json");
const csvFiles = [
  "Pet.csv", "mutation.csv", "rebirth.csv", "PassivePet.csv", "GlobalConfigs.csv",
  "weather.csv", "weatherEffects.csv", "weatherWaves.csv", "WeatherGen.csv",
  "Mutagen.csv", "MutateCost.csv", "DailyMissions.csv", "DailyEvent.csv",
  "DailyRewards.csv", "RevivalMission.csv", "milestone.csv", "reward.csv",
  "onboard.csv", "loginReward.csv", "luckySpin.csv", "Event/EventSchedule.csv",
  "shopItems.csv", "RotationShopItems.csv", "RotationShopWaves.csv",
  "GuaranteePool.csv", "PoolRandomItem.csv", "poolRewardSecret.csv",
  "DustHuntWave.csv", "DustHuntReward.csv", "Event/shopEventItems.csv",
  "Event/Ball/BallWave.csv", "Event/Collector/poolPetEventCollector.csv",
  "Event/FuseContract/PoolPetEventFuseContract.csv", "Event/Dig/DigPools.csv",
  "Event/Dig/DigPoolMap.csv", "Event/Dig/DigScan.csv", "Event/Dig/DigSpotRarity.csv",
  "Event/Dig/DigGuaranteedChest.csv", "Event/Fishing/PoolFishing.csv",
  "Event/Fishing/GuaranteedFishingChest.csv", "Event/Fishing/FishingChestReward.csv",
  "Event/LuckyBox/LuckyBox.csv", "Event/Meteorite/MeteoriteWave.csv",
  "Event/Meteorite/MeteoriteReward.csv", "Event/Mole/MoleWave.csv",
  "Event/Mole/MoleReward.csv", "Event/RarityContract/RarityBonus.csv",
  "Event/RarityContract/RarityContract.csv"
];
const codeFiles = [
  "Assets/Scripts/Configs/PetConfigs.fcg",
  "Assets/Scripts/Configs/RebirthConfigs.fcg",
  "Assets/Scripts/Configs/FeatureUnlockConfigs.fcg",
  "Assets/Scripts/Configs/DailyPoolConfigs.fcg",
  "Assets/Scripts/Manager/ActivitiesManager.fcg",
  "Assets/Scripts/Configs/ActivitiesConfigs.fcg",
  "Assets/Scripts/Configs/DailyRewardConfigs.fcg",
  "Assets/Scripts/Manager/DailyRewardManager.fcg",
  "Assets/Scripts/Configs/RevivalMissionConfigs.fcg",
  "Assets/Scripts/Configs/OnboardConfigs.fcg",
  "Assets/Scripts/Configs/MilestoneConfig.fcg",
  "Assets/Scripts/Configs/MailConfigs.fcg",
  "Assets/Scripts/Manager/RewardManager.fcg",
  "Assets/Scripts/Configs/RewardRandomConfig.fcg",
  "Assets/Scripts/Configs/GuaranteePool.fcg",
  "Assets/Scripts/Configs/EventDigConfig.fcg",
  "Assets/Scripts/Manager/EventDigManager.fcg",
  "Assets/Scripts/Configs/EventFishingConfig.fcg",
  "Assets/Scripts/Manager/EventFishingManager.fcg",
  "Assets/Scripts/Events/Collector/EventCollectorConfigs.fcg",
  "Assets/Scripts/Events/Collector/EventCollectorManager.fcg",
  "Assets/Scripts/Events/FuseContract/EventFuseConfigs.fcg",
  "Assets/Scripts/Events/Core/EventShopManager.fcg",
  "Assets/Scripts/Events/Core/EventShopConfigs.fcg",
  "Assets/Scripts/Events/Core/EventSettings.fcg",
  "Assets/Scripts/Events/Ball/EventStealABallManager.fcg",
  "Assets/Scripts/Utils/WeightedRandom.fcg",
  "Assets/Scripts/Configs/GlobalConfigs.fcg",
  "Assets/Scripts/Configs/WeatherConfigs.fcg",
  "Assets/Scripts/Configs/MutagenConfigs.fcg",
  "Assets/Scripts/Configs/WeatherGenConfigs.fcg",
  "Assets/Scripts/Configs/LuckyBoxConfigs.fcg",
  "Assets/Scripts/Manager/WeatherManager.fcg",
  "Assets/Scripts/Manager/LuckyBoxManager.fcg",
  "Assets/Scripts/Configs/DustHuntConfigs.fcg",
  "Assets/Scripts/Configs/RotationShopConfigs.fcg",
  "Assets/Scripts/Manager/RotationShopManager.fcg",
  "Assets/Scripts/Configs/ShopItemsConfigs.fcg",
  "Assets/Scripts/Manager/PetParadeManager.fcg",
  "Assets/Scripts/Manager/TrackingManager.fcg",
  "Assets/GMT/Scripts/HudDebug.fcg"
];
const typeTokens = new Set(["int", "string", "float", "bool", "double", "long", "object", "datatype"]);
function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}
function outputPath(...parts) {
  const absolute = path.resolve(gddRoot, ...parts);
  if (isWithin(protectedGameRoot, absolute)) throw new Error("Refusing output under protected game project: " + absolute);
  if (!isWithin(gddRoot, absolute)) throw new Error("Refusing output outside GDD project: " + absolute);
  return absolute;
}
function ensureOutputDir(dir) {
  mkdirSync(outputPath(path.relative(gddRoot, dir)), { recursive: true });
}
function writeOutput(file, data) {
  const destination = outputPath(path.relative(gddRoot, file));
  ensureOutputDir(path.dirname(destination));
  writeFileSync(destination, data);
}
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}
function isTypeRow(row) {
  if (!row || !row.length) return false;
  if (String(row[0]).trim().toLowerCase() === "datatype") return true;
  return row.every((value) => !String(value).trim() || typeTokens.has(String(value).trim().toLowerCase()));
}
function runGit(...gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: sourceRoot, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : "";
}
function readSource(rel) {
  if (!rel.toLowerCase().endsWith(".fcg")) throw new Error("Only .fcg source files may be read: " + rel);
  const absolute = path.join(sourceRoot, rel);
  return existsSync(absolute) ? readFileSync(absolute, "utf8").replace(/^\uFEFF/, "") : "";
}
function parseCsvFile(rel) {
  if (!rel.toLowerCase().endsWith(".csv")) throw new Error("Only CSV config files may be read: " + rel);
  const absolute = path.join(csvRoot, rel);
  if (!existsSync(absolute)) return { path: "Assets/CSV/" + rel.replaceAll("\\", "/"), missing: true, rows: [], headers: [] };
  const raw = readFileSync(absolute);
  const parsed = parseCsv(raw.toString("utf8"));
  const headerCounts = new Map();
  const headers = (parsed[0] || []).map((h, i) => {
    const base = String(h || ("column_" + (i + 1))).trim();
    const count = (headerCounts.get(base) || 0) + 1;
    headerCounts.set(base, count);
    return count === 1 ? base : base + "_" + count;
  });
  const records = parsed.slice(1).filter((r) => !isTypeRow(r)).map((r) => {
    const item = {};
    headers.forEach((h, i) => { item[h] = String(r[i] ?? "").trim(); });
    return item;
  });
  return {
    path: "Assets/CSV/" + rel.replaceAll("\\", "/"),
    rows: records,
    rowCount: records.length,
    headers,
    sha256: createHash("sha256").update(raw).digest("hex"),
    bytes: raw.length
  };
}
function constant(text, name) {
  const re = new RegExp("^\\s*" + name + "\\s+(?:int|float|string|bool)\\s*=\\s*([^\\s/]+)", "m");
  const match = text.match(re);
  return match ? match[1] : null;
}
function parseFeatureUnlocks(text) {
  const matches = text.matchAll(/(?:if|else if)\s+([^{}]+)\{\s*return\s+(-?\d+)/g);
  const result = [];
  for (const match of matches) {
    const features = [...match[1].matchAll(/FEATURE_([A-Z0-9_]+)/g)].map((m) => m[1]);
    if (features.length) result.push({ features, rebirth: Number(match[2]) });
  }
  return result;
}
function parseChanceRules(text) {
  const rarityMultiplier = {};
  for (const match of text.matchAll(/RarityEnum\.(Common|Rare|Epic|Legendary|Mythic|Apex|Limited)\s*:\s*([0-9.]+)/g)) {
    rarityMultiplier[match[1].toUpperCase()] = Number(match[2]);
  }
  return {
    min: Number(constant(text, "MUTATE_MIN_CHANCE")),
    max: Number(constant(text, "MUTATE_MAX_CHANCE")),
    levelMultiplier: Number(constant(text, "LEVEL_MULTIPLIER")),
    useCostMultiplier: Number(constant(text, "MUTAGEN_USE_COST_MULTIPLIER")),
    secretMultiplier: Number(constant(text, "SECRET_MULTIPLIER")),
    rarityMultiplier
  };
}
function splitRawList(value, delimiter) {
  const raw = String(value ?? "");
  return raw === "" ? [] : raw.split(delimiter).map((item) => item.trim());
}
function parseGiftRewardLinks() {
  const absolute = path.join(csvRoot, "giftcode.csv");
  if (!existsSync(absolute)) return [];
  const parsed = parseCsv(readFileSync(absolute).toString("utf8"));
  const headers = parsed[0] || [];
  const idIndex = headers.indexOf("ID");
  const rewardIndex = headers.indexOf("Reward");
  if (idIndex < 0 || rewardIndex < 0) return [];
  return parsed.slice(1).filter((row) => !isTypeRow(row)).map((row) => ({
    giftId: String(row[idIndex] ?? "").trim(),
    rewardIds: splitRawList(row[rewardIndex], ";")
  })).filter((row) => row.giftId);
}
const tables = csvFiles.map(parseCsvFile);
const byName = new Map(tables.map((t) => [path.basename(t.path), t]));
const byPath = new Map(tables.map((t) => [t.path.replaceAll("\\", "/"), t]));
const code = Object.fromEntries(codeFiles.map((rel) => [rel, readSource(rel)]));
const petConfig = code["Assets/Scripts/Configs/PetConfigs.fcg"];
const rebirthConfig = code["Assets/Scripts/Configs/RebirthConfigs.fcg"];
const unlockConfig = code["Assets/Scripts/Configs/FeatureUnlockConfigs.fcg"];
const dailyConfig = code["Assets/Scripts/Configs/DailyPoolConfigs.fcg"];
const activitiesConfig = code["Assets/Scripts/Manager/ActivitiesManager.fcg"];
const activitiesRules = code["Assets/Scripts/Configs/ActivitiesConfigs.fcg"];
const dailyRewardRules = code["Assets/Scripts/Configs/DailyRewardConfigs.fcg"];
const dailyRewardManagerRules = code["Assets/Scripts/Manager/DailyRewardManager.fcg"];
const revivalMissionRules = code["Assets/Scripts/Configs/RevivalMissionConfigs.fcg"];
const onboardRules = code["Assets/Scripts/Configs/OnboardConfigs.fcg"];
const milestoneRules = code["Assets/Scripts/Configs/MilestoneConfig.fcg"];
const mailConfigRules = code["Assets/Scripts/Configs/MailConfigs.fcg"];
const rewardManagerRules = code["Assets/Scripts/Manager/RewardManager.fcg"];
const rewardRandomRules = code["Assets/Scripts/Configs/RewardRandomConfig.fcg"];
const guaranteePoolRules = code["Assets/Scripts/Configs/GuaranteePool.fcg"];
const digRules = code["Assets/Scripts/Configs/EventDigConfig.fcg"];
const digManagerRules = code["Assets/Scripts/Manager/EventDigManager.fcg"];
const fishingRules = code["Assets/Scripts/Configs/EventFishingConfig.fcg"];
const fishingManagerRules = code["Assets/Scripts/Manager/EventFishingManager.fcg"];
const collectorRules = code["Assets/Scripts/Events/Collector/EventCollectorConfigs.fcg"];
const collectorManagerRules = code["Assets/Scripts/Events/Collector/EventCollectorManager.fcg"];
const fuseRules = code["Assets/Scripts/Events/FuseContract/EventFuseConfigs.fcg"];
const eventShopRules = code["Assets/Scripts/Events/Core/EventShopManager.fcg"];
const eventBallRules = code["Assets/Scripts/Events/Ball/EventStealABallManager.fcg"];
const weightedRandomRules = code["Assets/Scripts/Utils/WeightedRandom.fcg"];
const weatherConfig = code["Assets/Scripts/Configs/WeatherConfigs.fcg"];
const mutagenConfig = code["Assets/Scripts/Configs/MutagenConfigs.fcg"];
const weatherGenConfig = code["Assets/Scripts/Configs/WeatherGenConfigs.fcg"];
const luckyBoxConfig = code["Assets/Scripts/Configs/LuckyBoxConfigs.fcg"];
const weatherManager = code["Assets/Scripts/Manager/WeatherManager.fcg"];
const luckyBoxManager = code["Assets/Scripts/Manager/LuckyBoxManager.fcg"];
const dustConfig = code["Assets/Scripts/Configs/DustHuntConfigs.fcg"];
const rotationShopConfig = code["Assets/Scripts/Configs/RotationShopConfigs.fcg"];
const rotationShopManager = code["Assets/Scripts/Manager/RotationShopManager.fcg"];
const paradeManager = code["Assets/Scripts/Manager/PetParadeManager.fcg"];
const debugHud = code["Assets/GMT/Scripts/HudDebug.fcg"];
const tracking = code["Assets/Scripts/Manager/TrackingManager.fcg"];
const globals = byName.get("GlobalConfigs.csv");
const weatherWaves = byName.get("weatherWaves.csv");
const dustWaves = byName.get("DustHuntWave.csv");
const rebirthRows = byName.get("rebirth.csv")?.rows ?? [];
const weatherMinutes = (weatherWaves?.rows ?? []).reduce((sum, row) => sum + (Number(row.Duration) || 0), 0);
const globalRow = (globals?.rows ?? []).find((row) => row.ConfigName === "value") || (globals?.rows ?? []).at(-1) || {};
const logs = runGit("log", "-3", "--date=short", "--pretty=format:%H%x1f%h%x1f%ad%x1f%s").split("\n").filter(Boolean);
const recentCommits = logs.map((line) => {
  const [hash, shortHash, date, subject] = line.split("\x1f");
  const changed = runGit("diff-tree", "--no-commit-id", "--name-only", "-r", hash).split("\n").filter(Boolean);
  return { hash, shortHash, date, subject, files: changed };
});
const petCsv = byName.get("Pet.csv");
const rarityCounts = {};
for (const row of petCsv?.rows ?? []) rarityCounts[row.Rarity] = (rarityCounts[row.Rarity] || 0) + 1;
const findings = [];
const loadedPetIds = new Set();
for (let id = 1; id <= (Number(constant(petConfig, "PET_COUNT")) || 0); id += 1) loadedPetIds.add(id);
for (let id = 1; id <= (Number(constant(petConfig, "SECRET_FUSION_PET_COUNT")) || 0); id += 1) loadedPetIds.add(1000 + id);
for (let id = 1; id <= (Number(constant(petConfig, "LUCKY_BOX_COUNT")) || 0); id += 1) loadedPetIds.add(6000 + id);
const roadSpawnPetIds = new Set();
for (let id = 1; id <= (Number(constant(petConfig, "PET_COUNT")) || 0); id += 1) roadSpawnPetIds.add(id);
for (let id = 1; id <= (Number(constant(petConfig, "LUCKY_BOX_COUNT")) || 0); id += 1) roadSpawnPetIds.add(6000 + id);
const petRowsOutsideRuntimeRanges = (petCsv?.rows ?? []).filter((row) => !loadedPetIds.has(Number(row.ID))).map((row) => ({ id: row.ID, name: row.Name, rarity: row.Rarity }));
if (petRowsOutsideRuntimeRanges.length) findings.push({
  kind: "config_coverage",
  severity: "review",
  title: "Pet.csv has rows outside the current loader ranges",
  detail: "PetConfigs loads normal IDs 1–" + constant(petConfig, "PET_COUNT") + ", secret-fusion IDs 1001–" + (1000 + Number(constant(petConfig, "SECRET_FUSION_PET_COUNT"))) + ", and lucky-box IDs 6001–" + (6000 + Number(constant(petConfig, "LUCKY_BOX_COUNT"))) + ". These CSV rows fall outside those lookup loops; confirm whether they are reserved or stale.",
  rows: petRowsOutsideRuntimeRanges
});
const productionHasDailyModifier = /DailyPoolConfigs\.GetDailyModifier\s*\(petId\)/.test(paradeManager);
const debugClaimsNoModifier = /production road spawn currently does not apply it/i.test(debugHud);
if (productionHasDailyModifier && debugClaimsNoModifier) findings.push({
  kind: "annotation_drift",
  severity: "review",
  title: "Pet Parade debug note conflicts with production code",
  detail: "HudDebug's rate-test output says production road spawn does not apply the daily modifier, while PetParadeManager.CalculateRoadSpawnWeights multiplies by DailyPoolConfigs.GetDailyModifier(petId). Confirm the note against the shipped build."
});
const rebirthCountIsDynamic = /_RebirthCount\s*\+=\s*1/.test(rebirthConfig);
const globalTrackingDisabled = /\/\/\s*start TrackingGlobalMilestones\(player\)/.test(tracking);
const userRefreshBody = (paradeManager.match(/async func UpdateUsers\([\s\S]*?\n    }/) || [""])[0];
const paradePoolWeights = [1, 2, 3, 4, 5].map((i) => Number(constant(paradeManager, "POOL_" + i + "_WEIGHT")) || 0);
const weekendPredicate = (paradeManager.match(/func ShouldApplyWeekendSpawnMultiplier\([\s\S]*?\n    }/) || [""])[0];
const cycleDayBody = (activitiesConfig.match(/func GetCycleDayByDate\([\s\S]*?\n    }/) || [""])[0];
const cycleDayFormula = cycleDayBody.match(/return\s+([^\n]+)/)?.[1]?.trim() || "((dayIndex + 3) % DAYS_PER_WEEK) + 1";
const luckyBoxRewardIdFormula = petConfig.match(/func GetLuckyBoxRewardBoxId\([\s\S]*?return\s+([^\n]*LUCKY_BOX_START_INDEX[^\n]*)/)?.[1]?.trim() || null;
const luckyBoxDrawIsWeighted = /GetRandomWeightedIndex\(_BoxId2Weights\[boxId\]\)/.test(luckyBoxConfig);
const luckyBoxManagerMakesSingleDraw = /var resultPetId int = LuckyBoxConfigs\.GetRandomPetIdByBoxId\(boxId\)/.test(luckyBoxManager);
const luckyBoxStormSpawnCounts = [1, 2, 3].map((i) => Number(constant(luckyBoxManager, "GIFTBOX_STORM_LUCKY_BOX_" + i + "_COUNT")) || 0);
const weatherRollPicksUniformEffect = /Math\.RandomInt\(0,\s*List\.Length\(weatherEffects\)\)/.test(weatherManager);
const weatherWaveDurationUsesMinutes = /func GetWeatherWaveDurationSeconds\(waveId int\) int\s*\{\s*return GetWeatherWaveDuration\(waveId\)\s*\*\s*SECONDS_PER_MINUTE/.test(weatherConfig);
const rebirthBands = [
  { label: "RB 0–5", min: 0, max: Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_1_USER")) || 5, weightColumn: "Weight1", playerType: "Type1User" },
  { label: "RB 6–10", min: (Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_1_USER")) || 5) + 1, max: Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_2_USER")) || 10, weightColumn: "Weight2", playerType: "Type2User" },
  { label: "RB 11–15", min: (Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_2_USER")) || 10) + 1, max: Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_3_USER")) || 15, weightColumn: "Weight3", playerType: "Type3User" },
  { label: "RB 16–20", min: (Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_3_USER")) || 15) + 1, max: Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_4_USER")) || 20, weightColumn: "Weight4", playerType: "Type4User" },
  { label: "RB 21+", min: (Number(constant(petConfig, "REBIRTH_LEVEL_WEIGHT_4_USER")) || 20) + 1, max: null, weightColumn: "Weight5", playerType: "Type5User" }
].map((band, index) => ({ ...band, poolWeight: paradePoolWeights[index] }));
const rotationShopItemsTable = byName.get("RotationShopItems.csv");
const rotationShopWavesTable = byName.get("RotationShopWaves.csv");
const rotationItemsById = new Map((rotationShopItemsTable?.rows ?? []).map((row) => [String(row.ID), row]));
const wavePresence = new Map();
const rotationWaves = (rotationShopWavesTable?.rows ?? []).map((row) => {
  const entries = [];
  for (const match of String(row.Items ?? "").matchAll(/\{([^{}]*)\}/g)) {
    const id = match[1].match(/(?:^|;)\s*ID\s*:\s*([^;]+)/i)?.[1]?.trim();
    const count = match[1].match(/(?:^|;)\s*Count\s*:\s*([^;]+)/i)?.[1]?.trim();
    if (!id || count === undefined) continue;
    entries.push({ id, count });
    if (!wavePresence.has(id)) wavePresence.set(id, new Set());
    wavePresence.get(id).add(String(row.ID));
  }
  return { id: String(row.ID), durationMinutes: Number(row.Duration) || 0, sourceDuration: row.Duration, items: entries };
});
const rotationWaveCount = rotationWaves.length;
const rotationScheduleItems = rotationWaves.flatMap((wave) => wave.items.map((entry) => {
  const item = rotationItemsById.get(entry.id) || {};
  const presenceCount = wavePresence.get(entry.id)?.size || 0;
  return {
    waveId: wave.id,
    durationMinutes: wave.durationMinutes,
    itemId: entry.id,
    type: item.Type ?? "",
    value: item.Value ?? "",
    stock: entry.count,
    price: item.Price ?? "",
    discountPrice: item.DiscountPrice ?? "",
    wavePresenceCount: presenceCount,
    waveCount: rotationWaveCount,
    wavePresencePercent: rotationWaveCount ? presenceCount / rotationWaveCount * 100 : null,
    missingItemConfig: !rotationItemsById.has(entry.id)
  };
}));
const randomItemPoolUsesWeightedDraw = /GetRandomWeightedIndex\(rewardWeight\)/.test(weightedRandomRules) && /GetRewardRandomItem\(\)[\s\S]*?CalculateRewardRandomItemWeight/.test(weightedRandomRules) && /WeightedRandom\.GetRewardRandomItem\(\)/.test(eventShopRules + eventBallRules);
const randomPetPoolUsesWeightedDraw = /GetRandomWeightedIndex\(petRewardWeight\)/.test(weightedRandomRules) && /WeightedRandom\.GetPetInSecretPool\(/.test(collectorManagerRules);
const randomPetPoolId = Number(rewardRandomRules.match(/\bCURREWARDID\s*=\s*(\d+)/)?.[1]) || null;
const eventTypeList = code["Assets/Scripts/Events/Core/EventSettings.fcg"]?.match(/EVENT_TYPES\s+List<EventType>\s*=\s*List<EventType>\s*\{([\s\S]*?)\}/)?.[1] || "";
const eventTypeNames = Object.fromEntries([...eventTypeList.matchAll(/EventType\.(\w+)/g)].map(([_, name], id) => [String(id), name.replace(/^Event/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")]));
const rotationScheduleData = {
  generatedAt: new Date().toISOString(),
  sourceCommit: runGit("rev-parse", "HEAD"),
  waveCount: rotationWaveCount,
  itemConfigCount: rotationShopItemsTable?.rowCount ?? 0,
  scheduledSlotCount: rotationScheduleItems.length,
  totalCycleMinutes: rotationWaves.reduce((sum, wave) => sum + wave.durationMinutes, 0),
  waves: rotationWaves.map(({ items, ...wave }) => wave),
  items: rotationScheduleItems,
  shopItems: byName.get("shopItems.csv")?.rows ?? [],
  shopItemsHeaders: byName.get("shopItems.csv")?.headers ?? [],
  eventShopItems: byPath.get("Assets/CSV/Event/shopEventItems.csv")?.rows ?? [],
  eventShopItemsHeaders: byPath.get("Assets/CSV/Event/shopEventItems.csv")?.headers ?? [],
  eventSchedule: (byPath.get("Assets/CSV/Event/EventSchedule.csv")?.rows ?? []).map(row => ({
    ...row,
    eventName: eventTypeNames[String(row.EventType)] || ""
  })),
  eventTypeNames,
  eventScheduleHeaders: byPath.get("Assets/CSV/Event/EventSchedule.csv")?.headers ?? [],
  eventShopFacts: {
    timeAvailableIsTimestamp: /_ItemID2TimeAvailable\[itemId\]\s*<=\s*TimeManager\.GetCurrentTimestamp\(\)/.test(code["Assets/Scripts/Events/Core/EventShopConfigs.fcg"]),
    itemsGroupedByShopId: /_ShopID2SortedItem\[shopId\]/.test(code["Assets/Scripts/Events/Core/EventShopConfigs.fcg"]),
    eventTypeSelectsShopId: /GetShopId\(eventType\)/.test(eventShopRules),
    randomItemPoolUsesWeightedDraw,
    randomPetPoolUsesWeightedDraw,
    randomPetPoolId
  }
};
if (rotationShopItemsTable && !rotationShopItemsTable.missing) {
  writeOutput(outputPath("dist", "data", "tables", "rotation-shop-items.json"), JSON.stringify(rotationShopItemsTable, null, 2) + "\n");
  rotationShopItemsTable.file = "tables/rotation-shop-items.json";
  delete rotationShopItemsTable.rows;
}
writeOutput(outputPath("dist", "data", "shop-schedule.json"), JSON.stringify(rotationScheduleData, null, 2) + "\n");
const rewardTable = byName.get("reward.csv");
if (rewardTable && !rewardTable.missing) {
  writeOutput(outputPath("dist", "data", "tables", "rewards.json"), JSON.stringify(rewardTable, null, 2) + "\n");
  rewardTable.file = "tables/rewards.json";
  delete rewardTable.rows;
}
const petOutputRoot = outputPath("dist", "assets", "pets");
const actionOutputRoot = outputPath("dist", "assets", "actions");
const systemIconOutputRoot = outputPath("dist", "assets", "system-icons");
const iconAliases = { ARCTICFOX: "ARTICFOX" };
const petIcons = {};
const missingPetIcons = [];
for (const row of petCsv?.rows ?? []) {
  const name = String(row.Name ?? "").trim();
  const sourceName = iconAliases[name] || name;
  const outputName = sourceName + ".png";
  if (!name || !existsSync(path.join(petOutputRoot, outputName))) { missingPetIcons.push({ id: row.ID, name }); continue; }
  petIcons[String(row.ID)] = "./assets/pets/" + outputName;
}
const actionIconNames = ["ActivitiesIcon", "RebirthIcon", "LeaderboardIcon", "Road3DIcon", "BoostSpawnIcon", "CollectionIcon", "BaseIcon"];
const actionIcons = {};
for (const name of actionIconNames) {
  if (!existsSync(path.join(actionOutputRoot, name + ".png"))) continue;
  actionIcons[name] = "./assets/actions/" + name + ".png";
}
const mutationIcons = {};
const weatherEffectIcons = {};
const missingSystemIcons = [];
function referenceSystemIcon(iconName, id, target) {
  const name = String(iconName ?? "").trim();
  if (!name || !existsSync(path.join(systemIconOutputRoot, name + ".png"))) {
    missingSystemIcons.push({ id: String(id), name });
    return;
  }
  const outputName = name + ".png";
  target[String(id)] = "./assets/system-icons/" + outputName;
}
for (const row of byName.get("mutation.csv")?.rows ?? []) {
  if (String(row.Name).toLowerCase() === "normal") continue;
  referenceSystemIcon(row.Name, row.ID, mutationIcons);
}
for (const row of byName.get("weatherEffects.csv")?.rows ?? []) {
  referenceSystemIcon(row.Icon || row.Name, row.ID, weatherEffectIcons);
}
const guaranteeMythicIds = (petCsv?.rows ?? []).filter((row) => roadSpawnPetIds.has(Number(row.ID)) && row.Rarity === "MYTHIC" && Number(row.GuaranteeWeight) > 0).map((row) => Number(row.ID));
const versionCode = {
  petCount: Number(constant(petConfig, "PET_COUNT")),
  secretFusionPetCount: Number(constant(petConfig, "SECRET_FUSION_PET_COUNT")),
  luckyBoxCount: Number(constant(petConfig, "LUCKY_BOX_COUNT")),
  rebirthCountIsDynamic,
  rebirthCsvRows: rebirthRows.length,
  petCsvRows: petCsv?.rowCount ?? 0,
  petCsvRarityRows: rarityCounts,
  petRowsOutsideRuntimeRanges,
  spawnIntervalMs: Number(globalRow.PetSpawnInterval) || null,
  paradePetsPerWave: Number(constant(paradeManager, "PETS_COUNT_PER_WAVE")),
  weekendSpawnMultiplier: Number(constant(paradeManager, "WEEKEND_SPAWN_RATE_MULTIPLIER")),
  dailyModifiers: {
    up: Number(constant(dailyConfig, "UP_MODIFIER")),
    normal: Number(constant(dailyConfig, "DEFAULT_MODIFIER")),
    down: Number(constant(dailyConfig, "DOWN_MODIFIER"))
  },
  roadSpawnPetCount: roadSpawnPetIds.size,
  roadSpawnPetIds: [...roadSpawnPetIds].sort((a, b) => a - b),
  secretFusionPetsInRoadSpawn: false,
  rebirthBands,
  paradePoolWeights,
  paradePoolMaxCount: Number(constant(paradeManager, "MAX_POOL_PET_COUNT")) || 400,
  paradePoolMinCount: Number(constant(paradeManager, "MIN_POOL_PET_COUNT")) || 60,
  weekendEligiblePlayerTypes: [...weekendPredicate.matchAll(/userType\s*!=\s*"([^"]+)"/g)].map((match) => match[1]),
  weekendEligibleRarities: [...weekendPredicate.matchAll(/petRarity\s*==\s*RarityEnum\.([A-Za-z]+)/g)].map((match) => match[1].toUpperCase()),
  guaranteeMythicIds,
  cycleDayNames: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  cycleDayFormula,
  paradePoolsRefreshOnPlayerJoin: /^\s*UpdatePools\(\)/m.test(userRefreshBody),
  dailyModifierAppliedInProduction: productionHasDailyModifier,
  debugNoteClaimsNoDailyModifier: debugClaimsNoModifier,
  weatherCycleMinutesFromTable: weatherMinutes,
  weatherDurationUnitVerifiedByCode: weatherWaveDurationUsesMinutes,
  weatherRollPicksUniformEffect,
  mutagenChanceRules: parseChanceRules(mutagenConfig),
  weatherGenChanceRules: parseChanceRules(weatherGenConfig),
  luckyBoxDrawIsWeighted,
  luckyBoxManagerMakesSingleDraw,
  luckyBoxRewardIdFormula,
  luckyBoxStartIndex: Number(constant(petConfig, "LUCKY_BOX_START_INDEX")),
  luckyBoxCount: Number(constant(petConfig, "LUCKY_BOX_COUNT")),
  luckyBoxStormSpawnCounts,
  luckyBoxRandomPreviewCount: Number(constant(luckyBoxManager, "RANDOM_PREVIEW_COUNT")),
  rotationShopWaveDurationUsesMinutes: /GetWaveDuration\(waveId int\) int\s*\{\s*return _RSWave2Duration\[waveId\]\s*\*\s*SECONDS_PER_MINUTE/.test(rotationShopConfig),
  rotationShopUsesFixedWaveItems: /GetWaveItems\(_CurrentWave\)/.test(rotationShopManager),
  rotationShopHasCycleBasedWaveSelection: /currSeconds\s*%\s*totalWavesSeconds/.test(rotationShopManager),
  dustHuntDurations: (dustWaves?.rows ?? []).map((row) => ({ isAppear: row.IsAppear, rawDuration: row.Duration })),
  dustHuntDurationUnitAmbiguous: /GetDustHuntWaveDurationSeconds\(waveId int\) int\s*\{\s*return GetDustHuntWaveDuration\(waveId\)/.test(dustConfig),
  missionSources: {
    dailyMissionsLoadedByActivitiesConfig: /CSVData\.ReadCSV\(EResCSV\.DailyMissions\)/.test(activitiesRules),
    dailyRewardsLoadedByActivitiesConfig: /CSVData\.ReadCSV\(EResCSV\.DailyRewards\)/.test(activitiesRules),
    dailyMissionRewardsPairByIndex: /return DataUtils\.StringToListIntV2\(_MissionId2RewardType\[missionId\], "\|"\)/.test(activitiesRules) && /return Split\(_MissionId2RewardValue\[missionId\], "\|"\)/.test(activitiesRules) && /for key, rewardType in rewardsType\s*\{[\s\S]*?rewardsValue\[key\]/.test(activitiesConfig),
    revivalTargetPassedToTimeFormatter: /UIUtils\.FormatTime\(targetValue,\s*2\)/.test(revivalMissionRules),
    milestoneGiftLookupUsesMatchingIndex: /List\.IndexOf\(milestones, milestone\)[\s\S]*?return _MilestoneIdToGifts\[id\]\[index\]/.test(milestoneRules),
    rewardCsvReferencedByMissionCode: /EResCSV\.Reward\b/.test(activitiesRules + activitiesConfig + rewardManagerRules),
    giftIdsResolveToRewardIdLists: /_GiftId2Rewards\[giftId\]\s*=\s*DataUtils\.StringToListIntV2\(giftInfo\[GiftCodeConfigEnum\.Reward/.test(mailConfigRules),
    onboardingRewardsLoadRewardTypeAndValue: /_OnboardStep2RewardType/.test(onboardRules) && /_OnboardStep2RewardValue/.test(onboardRules),
    luckySpinChoosesByWeight: /GetRandomWeightedIndex\(dailyRewardWeight\)/.test(weightedRandomRules),
    luckySpinRewardMapsThroughGiftId: /GetLoginRewardGiftId\(rewardId\)/.test(dailyRewardManagerRules),
    luckySpinAngleIsReadAfterRewardChoice: /var rewardId int = WeightedRandom\.GetDailyRewardRandomID\(\)[\s\S]*?RandomAngleSpin\(rewardId\)/.test(dailyRewardManagerRules)
  },
  poolSources: {
    poolRandomItemsUseWeightedDraw: randomItemPoolUsesWeightedDraw,
    secretPoolItemsUseIndexAlignedWeights: randomPetPoolUsesWeightedDraw,
    digSpotRarityUsesWeightedDraw: /GetValueRandomWeightedIndex\(_ScanTier2SpotRarityWeights\[scanTier\], _ScanTier2TotalSpotRarityWeight\[scanTier\]\)/.test(digRules),
    digPetPoolUsesWeightedDraw: /GetValueRandomWeightedIndex\(weights, _PoolTier2TotalDigPetWeight\[poolTier\]\)/.test(digRules),
    fishingPetPoolUsesWeightedDraw: /GetValueRandomWeightedIndex\(weightFish, totalWeightFish\)/.test(fishingRules),
    fishingChestRewardsUseWeightedDraw: /GetValueRandomWeightedIndex\(EventFishingConfig\.GetListWeightReward\(\), EventFishingConfig\.GetTotalWeightReward\(\)\)/.test(weightedRandomRules) && /RandomChestRewardFishing\(\)/.test(fishingManagerRules + digManagerRules),
    digChestTableReadByRuntime: /EventDigConfig\.GetGuaranteedDigChestRate\(/.test(digManagerRules),
    fishingChestTableReadByRuntime: /EventFishingConfig\.GetGuaranteedFishingChestRate\(/.test(fishingManagerRules),
    guaranteePoolRuntimeDrawVerified: /GetGuaranteePool|GuaranteePool\./.test(petConfig + weightedRandomRules + paradeManager)
  },
  featureUnlocks: parseFeatureUnlocks(unlockConfig),
  globalMilestoneTrackingDisabled: globalTrackingDisabled,
  sourceBranch: runGit("branch", "--show-current"),
  sourceCommit: runGit("rev-parse", "HEAD")
};
const missionFacts = versionCode.missionSources;
const giftRewardSource = parseGiftRewardLinks();
const giftRewardSourceById = new Map(giftRewardSource.map((row) => [row.giftId, row.rewardIds]));
const referencedGiftIds = new Set();
const giftReferenceTables = [
  ["Assets/CSV/DailyRewards.csv", "Gift"],
  ["Assets/CSV/DailyEvent.csv", "Gift"],
  ["Assets/CSV/milestone.csv", "Gift"],
  ["Assets/CSV/loginReward.csv", "RewardId"],
  ["Assets/CSV/PoolRandomItem.csv", "GiftID"],
  ["Assets/CSV/poolRewardSecret.csv", "IDGift"],
  ["Assets/CSV/Event/shopEventItems.csv", "IDGift"],
  ["Assets/CSV/Event/FuseContract/PoolPetEventFuseContract.csv", "Gift"]
];
for (const [tablePath, key] of giftReferenceTables) {
  for (const row of byPath.get(tablePath)?.rows ?? []) {
    for (const giftId of splitRawList(row[key], ";")) if (giftId) referencedGiftIds.add(giftId);
  }
}
const giftRewardLinks = [...referencedGiftIds].sort((a, b) => Number(a) - Number(b)).map((giftId) => ({
  giftId,
  rewardIds: giftRewardSourceById.get(giftId) ?? [],
  resolved: giftRewardSourceById.has(giftId)
}));
const giftRewardData = {
  generatedAt: new Date().toISOString(),
  sourceCommit: versionCode.sourceCommit,
  sourceFacts: {
    giftIdsResolveToRewardIdLists: missionFacts.giftIdsResolveToRewardIdLists,
    rewardCatalogIsRewardCsv: true,
    exportedGiftFields: ["ID", "Reward"],
    referencedGiftCount: giftRewardLinks.length
  },
  giftLinks: giftRewardLinks
};
writeOutput(outputPath("dist", "data", "gift-rewards.json"), JSON.stringify(giftRewardData, null, 2) + "\n");
const missionRewardPairsById = Object.fromEntries((byName.get("DailyMissions.csv")?.rows ?? []).map((row) => {
  const types = splitRawList(row.RewardType, "|");
  const values = splitRawList(row.RewardValue, "|");
  const pairs = missionFacts.dailyMissionRewardsPairByIndex ? types.map((type, index) => ({
    type,
    value: values[index] ?? "",
    hasValue: index < values.length
  })) : [];
  return [String(row.ID), { pairs, listLengthsMatch: types.length === values.length }];
}));
const milestoneEntries = (byName.get("milestone.csv")?.rows ?? []).flatMap((row) => {
  const milestones = splitRawList(row.Milestone, ";");
  const gifts = splitRawList(row.Gift, ";");
  if (!missionFacts.milestoneGiftLookupUsesMatchingIndex) return [];
  return milestones.map((milestone, index) => ({
    configId: String(row.ID),
    type: String(row.Type ?? ""),
    milestone,
    giftId: gifts[index] ?? "",
    hasGift: index < gifts.length
  }));
});
const missionData = {
  generatedAt: new Date().toISOString(),
  sourceCommit: versionCode.sourceCommit,
  sourceFacts: missionFacts,
  dailyMissionRewardsById: missionRewardPairsById,
  milestoneEntries,
  rewardTable: rewardTable && !rewardTable.missing ? {
    path: rewardTable.path,
    file: rewardTable.file,
    rowCount: rewardTable.rowCount,
    headers: rewardTable.headers,
    sha256: rewardTable.sha256
  } : null
};
writeOutput(outputPath("dist", "data", "missions.json"), JSON.stringify(missionData, null, 2) + "\n");
const poolFacts = versionCode.poolSources;
const asWeight = (value) => Number(value) || 0;
function weightedEntries(rows, idKey, weightKey, groupValue, totalWeight, verified) {
  return rows.map((row) => {
    const weight = asWeight(row[weightKey]);
    return {
      ...(groupValue === undefined ? {} : { group: groupValue }),
      id: String(row[idKey] ?? ""),
      weight: String(row[weightKey] ?? ""),
      totalWeight,
      weightSharePercent: verified && totalWeight > 0 ? weight / totalWeight * 100 : null
    };
  });
}
const poolRandomItems = byName.get("PoolRandomItem.csv")?.rows ?? [];
const poolRandomItemTotalWeight = poolRandomItems.reduce((sum, row) => sum + asWeight(row.Weight), 0);
const poolRandomItemWeights = weightedEntries(poolRandomItems, "ID", "Weight", undefined, poolRandomItemTotalWeight, poolFacts.poolRandomItemsUseWeightedDraw);
const secretRewardRows = byName.get("poolRewardSecret.csv")?.rows ?? [];
const secretRewardEntries = secretRewardRows.flatMap((row) => {
  const petIds = splitRawList(row.Pool, ";");
  const weights = splitRawList(row.Weight, ";");
  const giftIds = splitRawList(row.IDGift, ";");
  const aligned = petIds.length === weights.length && weights.length === giftIds.length;
  const totalWeight = weights.reduce((sum, weight) => sum + asWeight(weight), 0);
  return petIds.map((petId, index) => ({
    poolId: String(row.ID),
    petId,
    giftId: giftIds[index] ?? "",
    weight: weights[index] ?? "",
    totalWeight,
    arraysAligned: aligned,
    weightSharePercent: poolFacts.secretPoolItemsUseIndexAlignedWeights && aligned && totalWeight > 0 ? asWeight(weights[index]) / totalWeight * 100 : null
  }));
});
const digPoolRows = byName.get("DigPools.csv")?.rows ?? [];
const digPoolBands = [
  { id: "common", label: "Common pool", weightColumn: "Weight", sourceRarity: "COMMON" },
  { id: "rare", label: "Rare pool", weightColumn: "Weight_2", sourceRarity: "RARE" },
  { id: "epic", label: "Epic pool", weightColumn: "Weight_3", sourceRarity: "EPIC" },
  { id: "legendary", label: "Legendary pool", weightColumn: "Weight_4", sourceRarity: "LEGENDARY" },
  { id: "mythic", label: "Mythic pool", weightColumn: "Weight_5", sourceRarity: "MYTHIC" }
].map((band) => {
  const totalWeight = digPoolRows.reduce((sum, row) => sum + asWeight(row[band.weightColumn]), 0);
  return {
    ...band,
    totalWeight,
    items: digPoolRows.map((row) => ({
      petId: String(row.IDPET ?? ""),
      weight: String(row[band.weightColumn] ?? ""),
      weightSharePercent: poolFacts.digPetPoolUsesWeightedDraw && totalWeight > 0 ? asWeight(row[band.weightColumn]) / totalWeight * 100 : null
    }))
  };
});
const digSpotRows = byName.get("DigSpotRarity.csv")?.rows ?? [];
const digSpotTotals = new Map();
for (const row of digSpotRows) digSpotTotals.set(String(row.ScanTier), (digSpotTotals.get(String(row.ScanTier)) || 0) + asWeight(row.Weight));
const digSpotShares = digSpotRows.map((row) => {
  const totalWeight = digSpotTotals.get(String(row.ScanTier)) || 0;
  return {
    scanTier: String(row.ScanTier ?? ""),
    spotRarity: String(row.SpotRarity ?? ""),
    weight: String(row.Weight ?? ""),
    totalWeight,
    weightSharePercent: poolFacts.digSpotRarityUsesWeightedDraw && totalWeight > 0 ? asWeight(row.Weight) / totalWeight * 100 : null
  };
});
const fishingPoolRows = byName.get("PoolFishing.csv")?.rows ?? [];
const fishingPoolBands = [
  { id: "rb-0-5", label: "RB 0–5", weightColumn: "Weight" },
  { id: "rb-6-10", label: "RB 6–10", weightColumn: "Weight_2" },
  { id: "rb-11-15", label: "RB 11–15", weightColumn: "Weight_3" },
  { id: "rb-16-20", label: "RB 16–20", weightColumn: "Weight_4" },
  { id: "rb-21-plus", label: "RB 21+", weightColumn: "Weight_5" }
].map((band) => {
  const totalWeight = fishingPoolRows.reduce((sum, row) => sum + asWeight(row[band.weightColumn]), 0);
  return {
    ...band,
    totalWeight,
    items: fishingPoolRows.map((row) => ({
      petId: String(row.IDPET ?? ""),
      weight: String(row[band.weightColumn] ?? ""),
      weightSharePercent: poolFacts.fishingPetPoolUsesWeightedDraw && totalWeight > 0 ? asWeight(row[band.weightColumn]) / totalWeight * 100 : null
    }))
  };
});
const fishingChestRows = byName.get("FishingChestReward.csv")?.rows ?? [];
const fishingChestTotalWeight = fishingChestRows.reduce((sum, row) => sum + asWeight(row.Weight), 0);
const fishingChestShares = weightedEntries(fishingChestRows, "ID", "Weight", undefined, fishingChestTotalWeight, poolFacts.fishingChestRewardsUseWeightedDraw);
const poolsData = {
  generatedAt: new Date().toISOString(),
  sourceCommit: versionCode.sourceCommit,
  sourceFacts: poolFacts,
  poolRandomItems: {
    totalWeight: poolRandomItemTotalWeight,
    shares: poolRandomItemWeights
  },
  secretRewardPools: {
    entries: secretRewardEntries,
    mismatchedPoolIds: [...new Set(secretRewardEntries.filter((row) => !row.arraysAligned).map((row) => row.poolId))]
  },
  dig: {
    petPoolBands: digPoolBands,
    spotRarity: digSpotShares
  },
  fishing: {
    petPoolBands: fishingPoolBands,
    chestRewardTotalWeight: fishingChestTotalWeight,
    chestRewards: fishingChestShares
  }
};
writeOutput(outputPath("dist", "data", "pools.json"), JSON.stringify(poolsData, null, 2) + "\n");
const output = {
  generatedAt: new Date().toISOString(),
  sourceLabel: "StealAPet repository",
  sourceBranch: versionCode.sourceBranch,
  sourceCommit: versionCode.sourceCommit,
  currentSourceFiles: tables.filter((t) => !t.missing).length,
  excludedSources: [
    { path: "Assets/CSV/giftcode.csv", reason: "Redeem codes and operational fields are excluded; only referenced Gift ID → Reward ID links are projected into gift-rewards.json." },
    { path: "Assets/CSV/Compensate/*", reason: "Player compensation exports are excluded." }
  ],
  tables,
  visualAssets: { petIcons, missingPetIcons, iconAliases, actionIcons, mutationIcons, weatherEffectIcons, missingSystemIcons },
  recentCommits,
  codeFacts: versionCode,
  findings
};
writeOutput(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log("Wrote " + path.relative(process.cwd(), outPath) + " from " + tables.filter((t) => !t.missing).length + " CSV tables; source " + versionCode.sourceCommit.slice(0, 8) + ".");



