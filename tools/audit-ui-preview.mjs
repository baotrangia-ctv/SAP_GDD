import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const i18n = JSON.parse(readFileSync(path.join(gdd, "dist", "data", "ui", "collection-i18n.json"), "utf8"));
const sourceEntities = [];
const exportedEntities = [];
function sourceWalk(node, parent = "") {
  const name = node._entityName || "PetsCollection";
  const p = parent ? `${parent}/${name}` : name;
  sourceEntities.push({ id: node._entityId, path: p, type: node._tag?.type });
  (node.children || []).forEach(child => sourceWalk(child, p));
}
function exportWalk(node) {
  exportedEntities.push({ id: node.id, path: node.path, type: node.type });
  (node.children || []).forEach(exportWalk);
}
sourceWalk(original); exportWalk(data.tree);
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
  unsupportedEntityCount: manifest.unsupported.length,
  unsupportedFieldCount: manifest.unsupported.reduce((sum, item) => sum + item.fields.length, 0),
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
