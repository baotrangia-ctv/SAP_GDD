import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATCH_FIELDS, ENTITY_TYPES, validateField } from './ui-proposal-fields.mjs';
import { generatePrompt } from './ui-proposal-prompt.mjs';

export const GDD_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAME_ROOT = String.raw`C:\_Code\craftland\StealAPet`;
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const clone = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function within(parent, file) { const rel = path.relative(parent, file); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); }
export function guard(root, file) {
  const target = path.resolve(file);
  if (!within(root, target)) throw new Error('Unsafe path: ' + target);
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (!within(realpathSync(root), realpathSync(ancestor))) throw new Error('Symlink outside boundary: ' + target);
  return target;
}
const json = file => JSON.parse(readFileSync(file, 'utf8'));
export function nodes(tree) { const result = []; (function walk(n) { result.push(n); n.children.forEach(walk); })(tree); return result; }
function keys(object, allowed, context) { if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error(`Expected object: ${context}`); for (const key of Object.keys(object)) if (!allowed.includes(key)) throw new Error(`Unknown ${context} field: ${key}`); }
function get(node, field) { return field.split('.').reduce((v, k) => v?.[k], node); }
function put(node, field, value) { const parts = field.split('.'); let target = node; for (const key of parts.slice(0, -1)) target = target[key] ||= {}; target[parts.at(-1)] = clone(value); }
function reindex(tree, baseline) {
  const ids = new Set(), paths = new Set();
  function walk(n, parent = '') {
    if (typeof n.id !== 'string' || !n.id || ids.has(n.id)) throw new Error('Duplicate/invalid entity id: ' + n.id);
    if (typeof n.name !== 'string' || !n.name.trim() || /[\\/\r\n]/.test(n.name)) throw new Error('Invalid entity name');
    n.path = parent ? `${parent}/${n.name}` : n.name;
    if (paths.has(n.path) && !baseline.filter(item => item.path === n.path).some(item => item.id === n.id)) throw new Error('New ambiguous entity path: ' + n.path);
    ids.add(n.id); paths.add(n.path); n.children.forEach(child => walk(child, n.path));
  }
  walk(tree);
  const all = nodes(tree);
  for (const p of paths) {
    const group = all.filter(n => n.path === p);
    if (group.length > 1 && group.some(n => !baseline.some(b => b.path === p && b.id === n.id))) throw new Error('New ambiguous entity path: ' + p);
  }
}
function spriteCheck(key, manifest) {
  const entry = manifest.sprites.find(item => item.key === key);
  if (!entry || entry.missing || !entry.output) throw new Error('Sprite missing or not registered: ' + key);
}
function newEntity(input, manifest) {
  keys(input, ['id', 'name', 'type', 'active', 'alpha', 'transform', 'image', 'button', 'text', 'layout', 'children'], 'entity');
  if (!Object.hasOwn(ENTITY_TYPES, input.type) || input.type === 'UIRootEntity') throw new Error('Unsupported added entity type: ' + input.type);
  const result = { id: input.id, name: input.name, type: input.type, active: true, alpha: 100, transform: null, priority: 0, image: null, button: null, text: null, layout: null, propsData: {}, ecaProps: {}, unsupported: [], children: [] };
  const group = ENTITY_TYPES[input.type]; if (group) result[group] = {};
  function visit(value, prefix) {
    if (prefix === 'image.spriteKey' || prefix === 'button.spriteKey') { if (group !== prefix.split('.')[0]) throw new Error('Wrong sprite component'); spriteCheck(value, manifest); put(result, prefix, value); return; }
    if (PATCH_FIELDS[prefix]) { validateField(result, prefix, value); put(result, prefix, value); return; }
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) throw new Error('Unsupported entity field: ' + prefix);
    for (const [key, item] of Object.entries(value)) visit(item, prefix ? `${prefix}.${key}` : key);
  }
  for (const [key, value] of Object.entries(input)) if (!['id', 'name', 'type', 'children'].includes(key)) visit(value, key);
  if (input.children != null && !Array.isArray(input.children)) throw new Error('Entity children must be an array');
  result.children = (input.children || []).map(child => newEntity(child, manifest));
  return result;
}

export function applyProposal(base, sourceManifest, proposal) {
  keys(proposal, ['$schema', 'id', 'screen', 'title', 'author', 'status', 'summary', 'ops', 'newAssets'], 'proposal');
  for (const field of ['title', 'author', 'summary']) if (typeof proposal[field] !== 'string' || !proposal[field].trim()) throw new Error('Missing proposal ' + field);
  if (!slug(proposal.id) || proposal.screen !== 'collection' || base.id !== proposal.screen) throw new Error('Invalid proposal id or unregistered screen');
  if (!['draft', 'review', 'approved'].includes(proposal.status)) throw new Error('Invalid proposal status');
  if (!Array.isArray(proposal.ops) || !Array.isArray(proposal.newAssets)) throw new Error('ops/newAssets must be arrays');
  const screen = clone(base), manifest = clone(sourceManifest), operations = [], removedEntities = [];
  const retiredIds = new Set(nodes(base.tree).map(n => n.id));
  // New asset entries are prepared/validated by the caller before patching.
  const lookup = (p, id) => { const found = nodes(screen.tree).filter(item => item.path === p && (id == null || item.id === id)); if (!found.length) throw new Error('Entity path/id not found: ' + p); if (found.length > 1) throw new Error('Ambiguous path; supply id/parentId: ' + p); return found[0]; };
  const parentOf = node => nodes(screen.tree).find(n => n.children.includes(node));
  function insert(parent, node, index) { if (index == null) index = parent.children.length; if (!Number.isInteger(index) || index < 0 || index > parent.children.length) throw new Error('Invalid child index: ' + index); parent.children.splice(index, 0, node); }
  for (const [index, op] of proposal.ops.entries()) {
    try {
      const shape = { set: ['path', 'id', 'field', 'value'], add: ['parent', 'parentId', 'entity', 'index'], remove: ['path', 'id'], move: ['path', 'id', 'parent', 'parentId', 'index'], replaceSprite: ['path', 'id', 'sprite'] }[op.op];
      if (!shape) throw new Error('Unknown operation: ' + op.op);
      keys(op, ['op', 'reason', ...shape], 'op');
      if (typeof op.reason !== 'string' || !op.reason.trim()) throw new Error('Every operation needs reason');
      let node = op.op === 'add' ? null : lookup(op.path, op.id);
      if (op.id != null && node.id !== op.id) throw new Error('Entity id/path mismatch');
      const oldPath = node?.path, oldNode = node ? clone(node) : null;
      const structuralIds = [];
      let field, before, after;
      if (op.op === 'set') {
        if (!Object.hasOwn(op, 'value')) throw new Error('set needs value');
        validateField(node, op.field, op.value); field = op.field; before = get(node, field) ?? null; after = op.value; put(node, field, after);
      } else if (op.op === 'replaceSprite') {
        field = node.image ? 'image.spriteKey' : node.button ? 'button.spriteKey' : null;
        if (!field) throw new Error('Entity has no sprite');
        spriteCheck(op.sprite, manifest); before = get(node, field); after = op.sprite; put(node, field, after);
      } else if (op.op === 'add') {
        const parent = lookup(op.parent, op.parentId); node = newEntity(op.entity, manifest);
        structuralIds.push(parent.id);
        for (const child of nodes(node)) { if (retiredIds.has(child.id)) throw new Error('Reused entity id: ' + child.id); retiredIds.add(child.id); }
        insert(parent, node, op.index); field = 'entity'; before = null;
      } else if (op.op === 'remove') {
        const parent = parentOf(node); if (!parent) throw new Error('Cannot remove root');
        structuralIds.push(parent.id);
        parent.children.splice(parent.children.indexOf(node), 1); removedEntities.push(clone(node)); field = 'entity'; before = oldNode; after = null;
      } else if (op.op === 'move') {
        const parent = parentOf(node), nextParent = lookup(op.parent, op.parentId);
        if (!parent || nodes(node).includes(nextParent)) throw new Error('Cannot move root or create a cycle');
        structuralIds.push(parent.id, nextParent.id);
        before = { parent: parent.path, parentId: parent.id, index: parent.children.indexOf(node) }; field = 'parent/index';
        parent.children.splice(before.index, 1); insert(nextParent, node, op.index); after = { parent: nextParent.path, parentId: nextParent.id, index: nextParent.children.indexOf(node) };
      }
      reindex(screen.tree, nodes(base.tree));
      if (op.op === 'add') after = clone(node);
      operations.push({ index: index + 1, op: op.op, path: oldPath || node.path, afterPath: op.op === 'remove' ? null : node.path, id: node.id, field, before: clone(before ?? null), after: clone(after ?? null), reason: op.reason,
        affectedIds: [...new Set(['add', 'remove', 'move'].includes(op.op) ? [...nodes(oldNode || node).map(n => n.id), ...structuralIds] : [node.id])] });
    } catch (error) { throw new Error(`${proposal.id} op ${index + 1}: ${error.message}`); }
  }
  const originalById = new Map(nodes(base.tree).map(n => [n.id, n]));
  const finalById = new Map(nodes(screen.tree).map(n => [n.id, n]));
  const location = tree => new Map(nodes(tree).flatMap(parent => parent.children.map((n, index) => [n.id, { parent: parent.id, index }])));
  const oldLocations = location(base.tree), finalLocations = location(screen.tree);
  const own = n => n && Object.fromEntries(Object.entries(n).filter(([k]) => !['children', 'proposalState'].includes(k)));
  const movedIds = new Set(operations.filter(op => op.op === 'move').map(op => op.id));
  const netChanged = new Set([...originalById.keys(), ...finalById.keys()].filter(id => {
    const a = originalById.get(id), b = finalById.get(id);
    return !same(own(a), own(b)) || !same(a?.children.map(c => c.id), b?.children.map(c => c.id)) || !same(oldLocations.get(id)?.parent, finalLocations.get(id)?.parent) || (movedIds.has(id) && !same(oldLocations.get(id)?.index, finalLocations.get(id)?.index));
  }));
  for (const node of nodes(screen.tree)) node.proposalState = !originalById.has(node.id) ? 'added' : netChanged.has(node.id) ? 'changed' : 'unchanged';
  const changes = operations.filter(item => !same(item.before, item.after) && item.affectedIds.some(id => netChanged.has(id)));
  // Tombstones represent the source-before tree, excluding transient additions
  // and descendants that were moved out and still exist after the patch.
  const removedIds = new Set([...originalById.keys()].filter(id => !finalById.has(id)));
  function tombstone(node) { return { ...clone(node), proposalState: 'removed', children: node.children.filter(n => removedIds.has(n.id)).map(tombstone) }; }
  removedEntities.splice(0, removedEntities.length, ...nodes(base.tree).filter(n => removedIds.has(n.id) && !removedIds.has(oldLocations.get(n.id)?.parent)).map(tombstone));
  screen.entityCount = nodes(screen.tree).length;
  screen.proposal = Object.fromEntries(['id', 'screen', 'title', 'author', 'status', 'summary'].map(k => [k, proposal[k]]));
  screen.removedEntities = removedEntities;
  const resources = [...nodes(screen.tree), ...removedEntities.flatMap(nodes)].filter(n => n.image || n.button || n.text).map(n => {
    const key = (n.image || n.button)?.spriteKey || '';
    const sprite = manifest.sprites.find(item => item.key === key);
    return { id: n.id, path: n.path, proposalState: n.proposalState, spriteKey: key, spriteSource: sprite?.proposalAsset ? 'asset đề xuất' : key ? 'game' : '—', missing: !!key && (!sprite || !!sprite.missing), sprite: sprite || null, alpha: n.alpha, image: n.image || n.button, text: n.text };
  });
  return { screen, manifest, diff: { id: proposal.id, operationCount: operations.length, operations, changes }, resources };
}

export function prepareAssets(proposal, manifest, root = GDD_ROOT) {
  const prepared = clone(manifest), copies = [], assetKeys = new Set(manifest.sprites.map(s => s.key));
  if (!Array.isArray(proposal.newAssets)) throw new Error('newAssets must be an array');
  for (const asset of proposal.newAssets) {
    keys(asset, ['key', 'file', 'border'], 'asset');
    if (typeof asset.key !== 'string' || !/^proposal\/[a-z0-9/-]+$/.test(asset.key) || assetKeys.has(asset.key)) throw new Error('Duplicate/invalid asset key: ' + asset.key);
    assetKeys.add(asset.key);
    if (typeof asset.file !== 'string' || !/^assets\/[a-zA-Z0-9_-]+\.png$/.test(asset.file)) throw new Error('Asset must be assets/<filename>.png');
    const assetRoot = path.join(root, 'design', 'ui-proposals', proposal.screen);
    const input = guard(assetRoot, path.resolve(assetRoot, asset.file));
    const buffer = readFileSync(input);
    if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid PNG: ' + asset.file);
    const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
    keys(asset.border, ['left', 'right', 'top', 'bottom'], 'border');
    if (!width || !height || ['left', 'right', 'top', 'bottom'].some(k => !Number.isFinite(asset.border[k]) || asset.border[k] < 0) || asset.border.left + asset.border.right > width || asset.border.top + asset.border.bottom > height) throw new Error('Invalid declared 9-grid border');
    const output = `./assets/ui-proposals/${proposal.screen}/${proposal.id}/${path.basename(asset.file)}`;
    prepared.sprites.push({ key: asset.key, output, width, height, border: asset.border, missing: false, proposalAsset: true, source: `design/ui-proposals/${proposal.screen}/${asset.file}`, origins: ['asset đề xuất'], references: [] });
    copies.push({ output, buffer });
  }
  return { manifest: prepared, copies };
}

export function syncUiProposals({ root = GDD_ROOT, dryRun = false } = {}) {
  root = path.resolve(root);
  if (within(GAME_ROOT, root) || within(realpathSync(GAME_ROOT), realpathSync(root))) throw new Error('GDD output must not be in game project');
  const dist = guard(root, path.join(root, 'dist'));
  const proposalRoot = guard(root, path.join(root, 'design', 'ui-proposals'));
  const output = new Map(), registry = { proposals: [] }, all = [], ids = new Set();
  const addJson = (name, data) => {
    const destination = `data/ui/proposals/${name}.json`;
    if (output.has(destination)) throw new Error('Proposal output filename collision: ' + destination);
    output.set(destination, JSON.stringify(data, null, 2) + '\n');
  };
  for (const screen of readdirSync(proposalRoot, { withFileTypes: true }).filter(item => item.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
    if (screen.name !== 'collection') throw new Error('Unregistered proposal screen: ' + screen.name);
    const folder = guard(proposalRoot, path.join(proposalRoot, screen.name));
    for (const file of readdirSync(folder).filter(f => f.endsWith('.json')).sort()) {
      const proposal = json(guard(folder, path.join(folder, file)));
      if (!slug(proposal.id) || proposal.screen !== screen.name || file !== proposal.id + '.json' || ids.has(proposal.id)) throw new Error('Proposal filename/screen/id mismatch or duplicate: ' + file);
      ids.add(proposal.id);
      const base = json(guard(dist, path.join(dist, 'data/ui', screen.name + '.json')));
      const sourceManifest = json(guard(dist, path.join(dist, 'data/ui', screen.name + '-sprites.json')));
      for (const sprite of sourceManifest.sprites.filter(s => s.output)) {
        if (!sprite.output.startsWith('./assets/ui-sprites/' + screen.name + '/')) throw new Error('Unregistered source sprite path');
        if (!existsSync(guard(dist, path.resolve(dist, sprite.output)))) throw new Error('Source sprite file missing: ' + sprite.key);
      }
      const assets = prepareAssets(proposal, sourceManifest, root);
      const result = applyProposal(base, assets.manifest, proposal);
      const prompt = generatePrompt({ proposal, result, base, root, gameRoot: GAME_ROOT, checkedPath: guard });
      output.set(`data/ui/proposals/${proposal.id}-prompt.md`, prompt);
      all.push({ proposal, ...result });
      addJson(proposal.id, result.screen); addJson(proposal.id + '-diff', result.diff); addJson(proposal.id + '-resources', { resources: result.resources, manifest: result.manifest });
      for (const copy of assets.copies) output.set(copy.output.slice(2), copy.buffer);
      registry.proposals.push({ ...result.screen.proposal, data: `./data/ui/proposals/${proposal.id}.json`, diff: `./data/ui/proposals/${proposal.id}-diff.json`, resources: `./data/ui/proposals/${proposal.id}-resources.json`, prompt: `./data/ui/proposals/${proposal.id}-prompt.md` });
    }
  }
  addJson('registry', registry);
  // Validate every destination before the first write; invalid batches write nothing.
  for (const rel of output.keys()) guard(dist, path.resolve(dist, rel));
  if (!dryRun) for (const [rel, value] of output) { const target = guard(dist, path.resolve(dist, rel)); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, value); }
  return { registry, all, output };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = syncUiProposals(); console.log(`UI proposals: ${result.all.length} validated; ${result.output.size} outputs`); }
  catch (error) { console.error('UI proposal sync failed: ' + error.message); process.exitCode = 1; }
}
