import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { applyProposal, GDD_ROOT, guard, nodes, prepareAssets, syncUiProposals, within } from './sync-ui-proposals.mjs';
import { PATCH_FIELDS } from './ui-proposal-fields.mjs';
import { generatePrompt } from './ui-proposal-prompt.mjs';
import { GAME_ROOT } from './sync-ui-proposals.mjs';

const readJson = rel => JSON.parse(readFileSync(path.join(GDD_ROOT, rel), 'utf8'));
const base = readJson('dist/data/ui/collection.json');
const manifest = readJson('dist/data/ui/collection-sprites.json');
const demo = readJson('design/ui-proposals/collection/collection-pipeline-example.json');
const make = ops => ({ ...structuredClone(demo), ops });
const title = 'PetsCollection/Container/Title/Label';
const container = 'PetsCollection/Container';
const node = nodes(base.tree).find(n => n.path === title);
const set = { op: 'set', path: title, field: 'text.fontSize', value: 36, reason: 'Audit fixture' };
const add = { op: 'add', parent: container, entity: { id: 'audit-new-widget', name: 'AuditLabel', type: 'UITextEntity', text: { value: 'Audit', fontSize: 20 }, transform: { sizeDelta: { x: 100, y: 30 } } }, reason: 'Audit fixture' };
const remove = { op: 'remove', path: title, reason: 'Audit fixture' };
const move = { op: 'move', path: title, parent: container, index: 0, reason: 'Audit fixture' };
const sprite = { op: 'replaceSprite', path: 'PetsCollection/Container/BG/DecorLeft', sprite: manifest.sprites.find(s => s.output)?.key, reason: 'Audit fixture' };
let cases = 0;
const check = fn => { fn(); cases++; };
const apply = ops => applyProposal(base, manifest, make(ops));
check(() => {
  const result = apply([]); assert.equal(result.diff.changes.length, 0); assert.equal(result.diff.operations.length, 0);
  const tree = structuredClone(result.screen.tree); nodes(tree).forEach(n => delete n.proposalState); assert.deepEqual(tree, base.tree);
});
check(() => { const r = apply([set]); assert.equal(nodes(r.screen.tree).find(n => n.id === node.id).text.fontSize, 36); assert.equal(r.diff.operations[0].before, node.text.fontSize); });
check(() => { const r = apply([add]); assert.equal(r.screen.entityCount, base.entityCount + 1); assert.equal(nodes(r.screen.tree).find(n => n.id === add.entity.id).proposalState, 'added'); });
check(() => { const r = apply([remove]); assert.equal(r.screen.entityCount, base.entityCount - 1); assert.equal(r.screen.removedEntities[0].proposalState, 'removed'); assert.ok(r.resources.some(r => r.id === node.id && r.proposalState === 'removed')); });
check(() => { const r = apply([move]); assert.equal(nodes(r.screen.tree).find(n => n.id === node.id).path, container + '/Label'); assert.equal(r.screen.entityCount, base.entityCount); });
check(() => { const r = apply([sprite]); assert.equal(r.diff.operations[0].after, sprite.sprite); });
check(() => { const r = apply([set, { ...set, value: node.text.fontSize }]); assert.equal(r.diff.changes.length, 0); assert.ok(nodes(r.screen.tree).every(n => n.proposalState === 'unchanged')); });
check(() => { const r = apply([add, { ...remove, path: container + '/AuditLabel' }]); assert.equal(r.diff.changes.length, 0); assert.deepEqual(r.screen.removedEntities, []); });
check(() => { const r = apply([{ op: 'move', path: 'PetsCollection/Container/BG', parent: container, index: 0, reason: 'Audit reorder' }]); assert.equal(nodes(r.screen.tree).find(n => n.name === 'BG').proposalState, 'changed'); });
check(() => { const r = apply([{ ...set, path: 'PetsCollection/Container/Recipe/Pet/Name', id: 'ZXLnmn4U' }]); assert.equal(nodes(r.screen.tree).find(n => n.id === 'ZXLnmn4U').text.fontSize, 36); });
for (const bad of [
  { ...set, path: 'does-not-exist' }, { ...set, id: 'wrong-id' }, { ...set, field: '__proto__.polluted' }, { ...set, field: 'image.flip' },
  { ...set, field: 'text.fontSize', value: '36' }, { ...set, field: 'alpha', value: 101 }, { ...set, reason: '' },
  { ...set, path: 'PetsCollection/Container/Recipe/Pet/Name' }, { ...set, field: 'image.color', value: '#FFFFFF' },
  { ...sprite, sprite: 'unregistered' }, { ...sprite, sprite: manifest.missing[0].key },
  { ...remove, path: base.tree.path }, { ...move, path: base.tree.path }, { ...move, path: container, parent: title },
  { ...add, entity: { ...add.entity, id: node.id } }, { ...add, index: -1 }, { ...add, entity: { ...add.entity, text: { font: 'unverified' } } },
  { ...add, parent: 'PetsCollection/Container/Recipe', index: 0, entity: { ...add.entity, name: 'Pet' } }, { ...set, op: 'unknown' }
]) check(() => assert.throws(() => apply([bad])));
check(() => assert.throws(() => apply([remove, { ...add, entity: { ...add.entity, id: node.id } }]), /Reused/));
check(() => {
  const r = apply([{ ...move, path: 'PetsCollection/Container/Recipe/Pet/Name', id: 'ZXLnmn4U', parent: 'PetsCollection/Container/Recipe/Pet', parentId: 'Attj9eJg' }]);
  assert.equal(nodes(r.screen.tree).filter(n => n.path.endsWith('/Recipe/Pet/Name')).length, 2);
  assert.equal(r.diff.changes.length, 1);
});

const before = JSON.stringify(base);
const first = syncUiProposals({ dryRun: true });
const second = syncUiProposals({ dryRun: true });
check(() => assert.deepEqual([...first.output], [...second.output]));
check(() => assert.equal(JSON.stringify(base), before));
for (const item of first.all) {
  check(() => assert.equal(item.diff.operations.length, item.proposal.ops.length));
  const outputPath = `dist/data/ui/proposals/${item.proposal.id}`;
  const actual = readJson(outputPath + '.json');
  check(() => assert.deepEqual(actual, item.screen));
  check(() => assert.deepEqual(readJson(outputPath + '-diff.json'), item.diff));
  check(() => assert.deepEqual(readJson(outputPath + '-resources.json'), { resources: item.resources, manifest: item.manifest }));
  const prompt = readFileSync(path.join(GDD_ROOT, outputPath + '-prompt.md'), 'utf8');
  for (const op of item.diff.operations) check(() => { assert.ok(prompt.includes(`| ${op.index} |`)); assert.ok(prompt.includes(op.id)); assert.ok(prompt.includes(op.reason)); });
  for (const resource of item.resources) check(() => {
    if (resource.spriteKey) assert.ok(resource.missing || (resource.sprite?.output && existsSync(guard(path.join(GDD_ROOT, 'dist'), path.resolve(GDD_ROOT, 'dist', resource.sprite.output)))));
  });
}
// Exercise the real sync writer in an isolated audit folder under dist only.
const auditParent = guard(GDD_ROOT, path.join(GDD_ROOT, 'dist'));
const temp = mkdtempSync(path.join(auditParent, '.ui-proposal-audit-'));
try {
  const put = (rel, content) => { const p = guard(temp, path.join(temp, rel)); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, content); };
  put('dist/data/ui/collection.json', JSON.stringify(base)); put('dist/data/ui/collection-sprites.json', JSON.stringify(manifest));
  put('tools/templates/ui-proposal-prompt.md', readFileSync(path.join(GDD_ROOT, 'tools/templates/ui-proposal-prompt.md')));
  for (const sprite of manifest.sprites.filter(s => s.output)) put('dist/' + sprite.output.slice(2), readFileSync(guard(auditParent, path.resolve(auditParent, sprite.output))));
  put('design/ui-proposals/collection/' + demo.id + '.json', JSON.stringify(demo));
  const invalid = { ...make([{ ...set, path: 'invalid' }]), id: 'zz-invalid' };
  put('design/ui-proposals/collection/zz-invalid.json', JSON.stringify(invalid));
  check(() => assert.throws(() => syncUiProposals({ root: temp }), /path.*not found/));
  check(() => assert.equal(existsSync(path.join(temp, 'dist/data/ui/proposals')), false));
  put('design/ui-proposals/collection/zz-invalid.json', JSON.stringify({ ...invalid, ops: [] }));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZioAAAAASUVORK5CYII=', 'base64');
  put('design/ui-proposals/collection/assets/audit.png', png);
  const assetProposal = { ...demo, newAssets: [{ key: 'proposal/audit', file: 'assets/audit.png', border: { left: 0, right: 0, top: 0, bottom: 0 } }], ops: [{ ...sprite, sprite: 'proposal/audit' }] };
  put('design/ui-proposals/collection/' + demo.id + '.json', JSON.stringify(assetProposal));
  const generated = syncUiProposals({ root: temp });
  check(() => assert.equal(generated.all[0].resources.find(r => r.id === 'gr8BcPhJ').spriteSource, 'asset đề xuất'));
  check(() => assert.deepEqual(readFileSync(path.join(temp, 'dist/assets/ui-proposals/collection', demo.id, 'audit.png')), png));
  check(() => assert.deepEqual([...syncUiProposals({ root: temp }).output], [...generated.output]));
  for (const asset of [{ ...assetProposal.newAssets[0], file: '../outside.png' }, { ...assetProposal.newAssets[0], border: null }, { ...assetProposal.newAssets[0], border: { left: 2, right: 0, top: 0, bottom: 0 } }]) check(() => assert.throws(() => prepareAssets({ ...demo, newAssets: [asset] }, manifest, temp)));
  check(() => assert.throws(() => guard(temp, path.join(temp, '..', 'outside'))));
  check(() => { put('design/ui-proposals/collection/' + demo.id + '.json', JSON.stringify({ ...demo, summary: 'Read C:\\outside\\secret.txt' })); assert.throws(() => syncUiProposals({ root: temp }), /outside game\/GDD/); });
  put('design/ui-proposals/collection/' + demo.id + '.json', JSON.stringify(demo));
  put('design/ui-proposals/collection/registry.json', JSON.stringify({ ...demo, id: 'registry' }));
  check(() => assert.throws(() => syncUiProposals({ root: temp }), /filename collision/));
} finally {
  if (!within(auditParent, path.resolve(temp)) || temp === auditParent) throw new Error('Unsafe audit cleanup');
  rmSync(temp, { recursive: true, force: true });
}
for (const file of ['app-uiproposal.js', 'app-ui-shared.js']) check(() => assert.doesNotMatch(readFileSync(path.join(GDD_ROOT, 'dist', file), 'utf8'), /pointerenter|\.title\s*=|:hover/));
let browser = null;
const urlAt = process.argv.indexOf('--browser-url');
if (urlAt >= 0) {
  const { auditProposalBrowser } = await import('./audit-ui-proposals-browser.mjs');
  const proposal = { ...make([set, { ...add, entity: { ...add.entity, children: [{ id: 'audit-new-child', name: 'Child', type: 'UIEmptyEntity' }] } }, sprite, move, { op: 'remove', path: 'PetsCollection/Container/BG/DecorRight', reason: 'Audit remove' }]), id: 'browser-fixture' };
  const result = applyProposal(base, manifest, proposal);
  const prompt = generatePrompt({ proposal, result, base, root: GDD_ROOT, gameRoot: GAME_ROOT, checkedPath: guard });
  browser = await auditProposalBrowser(process.argv[urlAt + 1], first.registry, { ...result, prompt });
}
const report = { cases, proposals: first.all.length, fieldCount: Object.keys(PATCH_FIELDS).length, idempotent: true, invalidBatchWritesNothing: true, allFiveOps: true, newAssetCopyAndBorder: true, duplicatePathsRequireId: true, emptyAndCancelledDiff: true, browser };
const output = guard(auditParent, path.join(auditParent, 'data/ui/proposals-audit.json'));
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
