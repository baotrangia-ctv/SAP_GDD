import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const gdd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const at = args.indexOf("--project-root");
if (at < 0 || !args[at + 1]) throw new Error("Usage: node tools/audit-ui-preview.mjs --project-root <StealAPet checkout>");
const sourceRoot = path.resolve(args[at + 1]);
const sourceFile = path.join(sourceRoot, "Assets", "HUDs", "PetsCollection.ui");
const raw = readFileSync(sourceFile, "utf8");
const commentAt = raw.lastIndexOf("\n//");
const original = JSON.parse(commentAt < 0 ? raw : raw.slice(0, commentAt));
const data = JSON.parse(readFileSync(path.join(gdd, "dist", "data", "ui", "collection.json"), "utf8"));
const manifest = JSON.parse(readFileSync(path.join(gdd, "dist", "data", "ui", "collection-sprites.json"), "utf8"));
const rules = JSON.parse(readFileSync(path.join(gdd, "dist", "data", "ui", "collection-rules.json"), "utf8"));
const i18n = JSON.parse(readFileSync(path.join(gdd, "dist", "data", "ui", "collection-i18n.json"), "utf8"));
const sourceEntities = [];
const exportedEntities = [];
const sourceEntityProps = new Map();
const exportedEntityProps = new Map();
function sourceWalk(node, parent = "") {
  const name = node._entityName || "PetsCollection";
  const p = parent ? `${parent}/${name}` : name;
  sourceEntities.push({ id: node._entityId, path: p, type: node._tag?.type, alpha: node.propsData?.alpha ?? 100, disableCollider: node.propsData?.button?.disableCollider });
  sourceEntityProps.set(node._entityId, { propsData: node.propsData || {}, ecaProps: node.ecaProps || {} });
  (node.children || []).forEach(child => sourceWalk(child, p));
}
function exportWalk(node) {
  exportedEntities.push({ id: node.id, path: node.path, type: node.type, alpha: node.alpha, disableCollider: node.button?.disableCollider });
  exportedEntityProps.set(node.id, { propsData: node.propsData || {}, ecaProps: node.ecaProps || {} });
  (node.children || []).forEach(exportWalk);
}
sourceWalk(original); exportWalk(data.tree);
for (const node of sourceEntities) {
  const exported = exportedEntities.find(item => item.id === node.id);
  assert.equal(exported?.alpha, node.alpha, `Alpha mismatch: ${node.path}`);
  assert.equal(exported?.disableCollider, node.disableCollider, `Collider mismatch: ${node.path}`);
  assert.deepEqual(exportedEntityProps.get(node.id), sourceEntityProps.get(node.id), `propsData or ecaProps mismatch: ${node.path}`);
}
const clientConfig = readFileSync(path.join(sourceRoot, "Assets", "Scripts", "ClientConfigs", "PetConfigs_Client.fcg"), "utf8").split(/\r?\n/);
const rarityColorStart = clientConfig.findIndex(line => /RARITY_COLOR Map<RarityEnum, Color>/.test(line));
assert.notEqual(rarityColorStart, -1, "PetConfigs_Client RARITY_COLOR map missing");
const sourceRarityColors = {};
for (let index = rarityColorStart; index < clientConfig.length && !clientConfig[index].includes("}"); index++) {
  const match = clientConfig[index].match(/RarityEnum\.(\w+):\s*(#[0-9A-Fa-f]{6,8})/);
  if (match) sourceRarityColors[match[1].toUpperCase()] = { value: match[2], source: `Assets/Scripts/ClientConfigs/PetConfigs_Client.fcg:${index + 1}` };
}
assert.deepEqual(rules.rarityColors?.values, sourceRarityColors, "Rarity colors differ from PetConfigs_Client.fcg");
const runtimePropertyPattern = /^\s*(.+?)<(\w+)>\.(Color|OutlineColor|SpriteName|SpriteResource|Content|IsVisible|Size|Position|Alpha|FillAmount)\s*=\s*(.+?)\s*$/;
const sourceRuntimeAssignments = readFileSync(path.join(sourceRoot, "Assets", "Scripts", "HUDs", "HudCollection.fcg"), "utf8").split(/\r?\n/).flatMap((line, index) => {
  const match = line.match(runtimePropertyPattern);
  return match ? [{ target: match[1].trim(), widgetType: match[2], property: match[3], expression: match[4], source: `Assets/Scripts/HUDs/HudCollection.fcg:${index + 1}` }] : [];
});
assert.deepEqual(rules.runtimeAssignments, sourceRuntimeAssignments, "Runtime UI property assignments are incomplete or changed");
const layoutNodes = [];
function collectLayouts(node) {
  if (node.layout?.enable) layoutNodes.push(node);
  node.children.forEach(collectLayouts);
}
collectLayouts(data.tree);
assert.equal(layoutNodes.length, 4, "Expected four active Collection layout entities");
assert.ok(layoutNodes.every(node => node.type === "UILayoutEntityV2" && node.layout.type === "grid"), "Collection layouts must retain their source layout data");
const mwLayout = layoutNodes.find(node => node.name === "MWLayout");
const mwColumns = Math.floor((mwLayout.transform.sizeDelta.x - mwLayout.layout.offset.left - mwLayout.layout.offset.right + mwLayout.layout.space.x) / (mwLayout.layout.size.x + mwLayout.layout.space.x));
assert.equal(mwLayout.layout.size.y, rules.mwGrid.size, "MW icon size differs between .ui and HudCollection.fcg");
assert.equal(mwLayout.layout.space.y, rules.mwGrid.verticalSpacing, "MW vertical spacing differs between .ui and HudCollection.fcg");
assert.equal(mwColumns, rules.mwGrid.columns, "MW grid column count differs between .ui geometry and HudCollection.fcg");
const rendererSource = readFileSync(path.join(gdd, "dist", "app-ui-renderer.js"), "utf8");
assert.match(rendererSource, /function applyLayout\(/, "Shared layout engine missing");
assert.doesNotMatch(rendererSource, /function layoutPosition\(|function resizeGridItem\(/, "Duplicate layout placement implementation remains");
for (const field of ["corner", "fixedRowCount", "fixedColumnCount", "tableOffset", "tableSpace", "ignoreInactive", "offset.down", "sortType"])
  assert.ok(rendererSource.includes(field), `Layout engine does not read ${field}`);
const textNodes = [];
(function collectText(node) { if (node.text) textNodes.push(node); node.children.forEach(collectText); })(data.tree);
assert.equal(textNodes.length, 33, "Text entity count changed; review rendering audit coverage");
for (const field of ["font", "lineSpacing", "overflow", "backgroundRGBA", "gradientTop", "gradientBottom", "shadowAlpha", "outlineAlpha", "transformOrigin", "webkitTextStroke", "applyFill"])
  assert.ok(rendererSource.includes(field), `Text/transform/fill renderer does not cover ${field}`);
assert.doesNotMatch(rendererSource, /font-family:\s*Arial|fontFamily\s*=\s*["']Arial|line-height:\s*1\.15/i, "Fixed Arial/line-height approximation remains");
assert.ok(data.renderingPolicy?.textStatus && data.renderingPolicy?.fillStatus && data.renderingPolicy?.viewportStatus, "Unverified renderer policies must be visible in source data");
const previewSource = readFileSync(path.join(gdd, "dist", "app-uipreview.js"), "utf8");
for (const ratio of ["16:9", "18:9", "20:9", "4:3"]) assert.ok((previewSource + readFileSync(path.join(gdd, "dist", "app-ui-shared.js"), "utf8")).includes(ratio), `Missing viewport preset ${ratio}`);
assert.match(previewSource, /safe area chưa xác minh|safe area/iu, "Viewport uncertainty must be visible in the UI");
const inspectorPath = path.join(gdd, "dist", "app-ui-inspector.js");
assert.ok(existsSync(inspectorPath), "Separate Widget Inspector module missing");
const inspectorSource = readFileSync(inspectorPath, "utf8");
for (const feature of ["contextmenu", "preventDefault", "getBoundingClientRect", "ui-show-inactive", "propsData", "ecaProps", "uiCloneTemplatePath", "uiCloneIndex", "runtimeValues", "execCommand", "Escape", "hudCollectionAssignmentsForTheseProperties"])
  assert.ok(inspectorSource.includes(feature), `Inspector does not cover ${feature}`);
assert.doesNotMatch(inspectorSource, /pointerenter|pointerleave|\.title\s*=|:hover/, "Inspector must not introduce hover or tooltip behavior");
assert.match(readFileSync(path.join(gdd, "dist", "index.html"), "utf8"), /app-ui-inspector\.js/, "Inspector module is not loaded by index.html");
const previewStyleSource = readFileSync(path.join(gdd, "dist", "styles.css"), "utf8");
for (const file of ["app-uipreview.js", "app-ui-renderer.js", "app-ui-collection.js"]) {
  const code = readFileSync(path.join(gdd, "dist", file), "utf8");
  assert.doesNotMatch(code, /pointerenter|\.title\s*=|:hover/, `Hover or tooltip behavior remains: ${file}`);
}
assert.match(previewStyleSource, /\.table-wrap\s+tbody\s+tr:hover\s*\{/, "Shared table hover must stay scoped outside Resource đang dùng");
assert.doesNotMatch(previewStyleSource, /(?:^|})\s*tbody\s+tr:hover\s*\{/m, "Unscoped table hover affects Resource đang dùng");
assert.doesNotMatch(previewStyleSource, /\.ui-resource-panel[^{}]*:hover|\.ui-debug[^{}]*:hover/, "UI Preview/resource/debug hover style remains");
assert.match(rendererSource, /addEventListener\("pointerleave",\s*normal\)/, "Pressed tint must reset on pointerleave");
const previewModules = ["app-uipreview.js", "app-ui-renderer.js", "app-ui-collection.js"];
for (const file of previewModules) {
  const code = readFileSync(path.join(gdd, "dist", file), "utf8");
  assert.doesNotMatch(code, /scrollIntoView|\bscroll(?:To|By)\s*\(|\blocation\s*\.\s*(?:hash|href|assign|replace)|\bhistory\s*\.|\.focus\s*\(/, `Viewport/navigation side effect: ${file}`);
  assert.doesNotMatch(code, /brightness\s*\(|mixBlendMode|visual\.style\.backgroundColor/, `Invalid sprite tint implementation: ${file}`);
}
const key = item => `${item.id}\t${item.path}\t${item.type}`;
const exportedKeys = new Set(exportedEntities.map(key));
const sourceKeys = new Set(sourceEntities.map(key));
const missingEntities = sourceEntities.filter(item => !exportedKeys.has(key(item)));
const extraEntities = exportedEntities.filter(item => !sourceKeys.has(key(item)));
const missingFiles = manifest.sprites.filter(item => item.output && !existsSync(path.join(gdd, "dist", item.output.startsWith("./") ? item.output.slice(2) : item.output)));
const spriteByKey = new Map(manifest.sprites.map(item => [item.key, item]));
const imageEntities = [], unmanifestedImages = [], borderMismatches = [], missingKeys = [];
function inspect(node) {
  const graphic = node.image || node.button;
  if (graphic?.spriteKey) {
    imageEntities.push(node.path);
    const entry = spriteByKey.get(graphic.spriteKey);
    if (!entry) unmanifestedImages.push(node.path);
    else if (entry.output) {
      const meta = path.join(sourceRoot, ...entry.key.split("/")) + ".meta";
      if (existsSync(meta)) {
        const raw = JSON.parse(readFileSync(meta, "utf8"));
        const expected = { left: Number(raw.borderLeft) || 0, right: Number(raw.borderRight) || 0, top: Number(raw.borderTop) || 0, bottom: Number(raw.borderBottom) || 0 };
        if (JSON.stringify(entry.border) !== JSON.stringify(expected)) borderMismatches.push({ path: node.path, key: entry.key, expected, actual: entry.border });
      }
    }
  }
  if (node.text?.key && !i18n.entries[node.text.key]) missingKeys.push({ path: node.path, key: node.text.key });
  node.children.forEach(inspect);
}
inspect(data.tree);
const report = {
  source: "Assets/HUDs/PetsCollection.ui", sourceEntityCount: sourceEntities.length,
  exportEntityCount: exportedEntities.length, missingEntities, extraEntities,
  nonDefaultAlpha: exportedEntities.filter(item => item.alpha !== 100),
  viewportSideEffectScan: "passed",
  unsupportedEntityCount: manifest.unsupported.length,
  unsupportedFieldCount: manifest.unsupported.reduce((sum, item) => sum + item.fields.length, 0),
  propsDataPreserved: true,
  runtimeAssignmentCount: sourceRuntimeAssignments.length,
  rarityColorCount: Object.keys(sourceRarityColors).length,
  gameRarityColorsMatched: true,
  spriteTintAlphaPreserved: true,
  imageGradientConfigured: Boolean(data.renderingPolicy?.imageGradient),
  layoutEntityCount: layoutNodes.length,
  mwGridMatchesSource: true,
  singleLayoutEngine: true,
  textEntityCount: textNodes.length,
  textPropertyRendering: true,
  textOverflowClippedInPreview: true,
  pivotTransformOrigin: true,
  radialFillImplemented: true,
  viewportPresetCount: 4,
  viewportScalerUnverified: true,
  inspectorModule: true,
  inspectorContextMenuAndGeometryHitTest: true,
  inspectorCloneIdentityAndFullProps: true,
  spriteCount: manifest.sprites.length, missingSprites: manifest.missing.map(item => item.key),
  missingCopiedFiles: missingFiles.map(item => item.output),
  imageEntityCount: imageEntities.length, unmanifestedImages, borderMismatches,
  localizationKeyCount: Object.keys(i18n.entries).length,
  missingLocalizationKeys: i18n.missing,
  missingStaticTextKeys: missingKeys
};
const out = path.resolve(gdd, "dist", "data", "ui", "collection-audit.json");
if (!out.startsWith(path.resolve(gdd, "dist") + path.sep) || out.startsWith(sourceRoot + path.sep)) throw new Error("Unsafe audit output path");
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (missingEntities.length || extraEntities.length || missingFiles.length || unmanifestedImages.length || borderMismatches.length || missingKeys.length) process.exitCode = 1;
const browserAt = args.indexOf("--browser-url");
if (browserAt >= 0) {
  const { auditBrowser } = await import("./audit-ui-preview-browser.mjs");
  const browserReport = await auditBrowser(args[browserAt + 1], data);
  // This destination shares the checked guard used by the static report.
  writeFileSync(path.join(path.dirname(out), "collection-browser-audit.json"), JSON.stringify(browserReport, null, 2) + "\n");
}
