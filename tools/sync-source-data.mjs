import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const rootAt = args.indexOf("--project-root");
if (rootAt < 0 || !args[rootAt + 1]) {
  console.error("Usage: node tools/sync-source-data.mjs --project-root <StealAPet checkout>");
  process.exit(64);
}
const sourceRoot = path.resolve(args[rootAt + 1]);
const csvRoot = path.join(sourceRoot, "Assets", "CSV");
const outPath = path.resolve("dist", "data", "config-snapshot.json");
const csvFiles = [
  "Pet.csv", "mutation.csv", "rebirth.csv", "PassivePet.csv", "GlobalConfigs.csv",
  "weather.csv", "weatherEffects.csv", "weatherWaves.csv", "WeatherGen.csv",
  "Mutagen.csv", "MutateCost.csv", "DailyMissions.csv", "DailyEvent.csv",
  "DailyRewards.csv", "RevivalMission.csv", "milestone.csv", "reward.csv",
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
  "Assets/Scripts/Configs/GlobalConfigs.fcg",
  "Assets/Scripts/Configs/WeatherConfigs.fcg",
  "Assets/Scripts/Configs/MutagenConfigs.fcg",
  "Assets/Scripts/Configs/WeatherGenConfigs.fcg",
  "Assets/Scripts/Configs/LuckyBoxConfigs.fcg",
  "Assets/Scripts/Manager/WeatherManager.fcg",
  "Assets/Scripts/Manager/LuckyBoxManager.fcg",
  "Assets/Scripts/Configs/DustHuntConfigs.fcg",
  "Assets/Scripts/Manager/PetParadeManager.fcg",
  "Assets/Scripts/Manager/TrackingManager.fcg",
  "Assets/GMT/Scripts/HudDebug.fcg"
];
const typeTokens = new Set(["int", "string", "float", "bool", "double", "long", "object", "datatype"]);
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
  const absolute = path.join(sourceRoot, rel);
  return existsSync(absolute) ? readFileSync(absolute, "utf8").replace(/^\uFEFF/, "") : "";
}
function parseCsvFile(rel) {
  const absolute = path.join(csvRoot, rel);
  if (!existsSync(absolute)) return { path: "Assets/CSV/" + rel.replaceAll("\\", "/"), missing: true, rows: [], headers: [] };
  const raw = readFileSync(absolute);
  const parsed = parseCsv(raw.toString("utf8"));
  const headers = (parsed[0] || []).map((h, i) => String(h || ("column_" + (i + 1))).trim());
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
const tables = csvFiles.map(parseCsvFile);
const byName = new Map(tables.map((t) => [path.basename(t.path), t]));
const code = Object.fromEntries(codeFiles.map((rel) => [rel, readSource(rel)]));
const petConfig = code["Assets/Scripts/Configs/PetConfigs.fcg"];
const rebirthConfig = code["Assets/Scripts/Configs/RebirthConfigs.fcg"];
const unlockConfig = code["Assets/Scripts/Configs/FeatureUnlockConfigs.fcg"];
const dailyConfig = code["Assets/Scripts/Configs/DailyPoolConfigs.fcg"];
const activitiesConfig = code["Assets/Scripts/Manager/ActivitiesManager.fcg"];
const weatherConfig = code["Assets/Scripts/Configs/WeatherConfigs.fcg"];
const mutagenConfig = code["Assets/Scripts/Configs/MutagenConfigs.fcg"];
const weatherGenConfig = code["Assets/Scripts/Configs/WeatherGenConfigs.fcg"];
const luckyBoxConfig = code["Assets/Scripts/Configs/LuckyBoxConfigs.fcg"];
const weatherManager = code["Assets/Scripts/Manager/WeatherManager.fcg"];
const luckyBoxManager = code["Assets/Scripts/Manager/LuckyBoxManager.fcg"];
const dustConfig = code["Assets/Scripts/Configs/DustHuntConfigs.fcg"];
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
const docsRebirth = readSource("Docs/BusinessLogic/40-rebirth-rewards.md");
if (/30\s+level/i.test(docsRebirth) && rebirthRows.length !== 30) findings.push({
  kind: "documentation_drift",
  severity: "review",
  title: "Rebirth documentation count differs from the checkout",
  detail: "The domain note describes 30 rows; RebirthConfigs reads the CSV and increments its count for each data row. The checked-in rebirth.csv currently contains " + rebirthRows.length + " data rows."
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
const petSpriteRoot = path.join(sourceRoot, "Assets", "Sprites", "Pets");
const iconSpriteRoot = path.join(sourceRoot, "Assets", "Sprites", "Icons");
const petOutputRoot = path.resolve("dist", "assets", "pets");
const actionOutputRoot = path.resolve("dist", "assets", "actions");
mkdirSync(petOutputRoot, { recursive: true });
mkdirSync(actionOutputRoot, { recursive: true });
const iconAliases = { ARCTICFOX: "ARTICFOX" };
const petIcons = {};
const missingPetIcons = [];
for (const row of petCsv?.rows ?? []) {
  const name = String(row.Name ?? "").trim();
  const sourceName = iconAliases[name] || name;
  const sourcePath = path.join(petSpriteRoot, sourceName + ".png");
  if (!name || !existsSync(sourcePath)) { missingPetIcons.push({ id: row.ID, name }); continue; }
  const outputName = sourceName + ".png";
  copyFileSync(sourcePath, path.join(petOutputRoot, outputName));
  petIcons[String(row.ID)] = "./assets/pets/" + outputName;
}
const actionIconNames = ["ActivitiesIcon", "RebirthIcon", "LeaderboardIcon", "Road3DIcon", "BoostSpawnIcon", "CollectionIcon", "BaseIcon"];
const actionIcons = {};
for (const name of actionIconNames) {
  const sourcePath = path.join(iconSpriteRoot, name + ".png");
  if (!existsSync(sourcePath)) continue;
  copyFileSync(sourcePath, path.join(actionOutputRoot, name + ".png"));
  actionIcons[name] = "./assets/actions/" + name + ".png";
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
  dustHuntDurations: (dustWaves?.rows ?? []).map((row) => ({ isAppear: row.IsAppear, rawDuration: row.Duration })),
  dustHuntDurationUnitAmbiguous: /GetDustHuntWaveDurationSeconds\(waveId int\) int\s*\{\s*return GetDustHuntWaveDuration\(waveId\)/.test(dustConfig),
  featureUnlocks: parseFeatureUnlocks(unlockConfig),
  globalMilestoneTrackingDisabled: globalTrackingDisabled,
  sourceBranch: runGit("branch", "--show-current"),
  sourceCommit: runGit("rev-parse", "HEAD")
};
const output = {
  generatedAt: new Date().toISOString(),
  sourceLabel: "StealAPet repository",
  sourceBranch: versionCode.sourceBranch,
  sourceCommit: versionCode.sourceCommit,
  currentSourceFiles: tables.filter((t) => !t.missing).length,
  excludedSources: [
    { path: "Assets/CSV/giftcode.csv", reason: "Operational redeem-code data is outside this GDD." },
    { path: "Assets/CSV/Compensate/*", reason: "Player compensation exports are excluded." }
  ],
  tables,
  visualAssets: { petIcons, missingPetIcons, iconAliases, actionIcons },
  recentCommits,
  codeFacts: versionCode,
  findings
};
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log("Wrote " + path.relative(process.cwd(), outPath) + " from " + tables.filter((t) => !t.missing).length + " CSV tables; source " + versionCode.sourceCommit.slice(0, 8) + ".");



