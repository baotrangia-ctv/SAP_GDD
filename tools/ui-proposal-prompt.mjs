import { readFileSync } from 'node:fs';
import path from 'node:path';

// Explicit subset already read by Collection sync; no recursive source scan.
export const BINDING_FILES = Object.freeze([
  'Assets/Scripts/HUDs/HudCollection.fcg',
  'Assets/Scripts/Manager/CollectionManager.fcg',
  'Assets/Scripts/Configs/PetConfigs.fcg',
  'Assets/Scripts/ClientConfigs/PetConfigs_Client.fcg'
]);
const cell = value => String(typeof value === 'string' ? value : JSON.stringify(value)).replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function scanBindings(diff, before, after, gameRoot, checkedPath) {
  const allNodes = [];
  function walk(n) { allNodes.push(n); n.children.forEach(walk); }
  walk(before.tree); walk(after.tree);
  const touched = new Set(diff.operations.flatMap(op => op.affectedIds));
  const relevant = allNodes.filter(n => touched.has(n.id));
  const files = BINDING_FILES.map(file => ({ file, lines: readFileSync(checkedPath(gameRoot, path.resolve(gameRoot, file)), 'utf8').split(/\r?\n/) }));
  const bindings = [];
  for (const { file, lines } of files) lines.forEach((line, index) => {
    for (const node of relevant) {
      let kind = '';
      if (line.includes(node.id)) kind = 'entity-id';
      else if (new RegExp(`\\bEResKeyPetsCollection\\.${escape(node.name)}\\b`).test(line)) kind = 'key-name-candidate';
      else if (line.includes(`"${node.name}"`)) kind = 'child-name-candidate';
      if (kind && !bindings.some(b => b.file === file && b.line === index + 1 && b.id === node.id)) bindings.push({ id: node.id, path: node.path, file, line: index + 1, kind, note: kind === 'entity-id' ? 'Trùng ID nguồn' : 'Trùng tên: cần dev xác nhận identity/alias, chưa khẳng định binding chính xác' });
    }
  });
  return bindings;
}
export function generatePrompt({ proposal, result, base, root, gameRoot, checkedPath }) {
  const bindings = scanBindings(result.diff, base, result.screen, gameRoot, checkedPath);
  result.diff.bindings = bindings;
  result.diff.bindingScan = { files: [...BINDING_FILES], status: 'literal candidates; dynamic aliases/runtime writes require developer review' };
  const operations = ['| # | Path / sau move | _entityId | Op / field | Cũ → mới | Reason |', '|---|---|---|---|---|---|', ...result.diff.operations.map(op => `| ${op.index} | ${cell(op.path)}${op.afterPath && op.afterPath !== op.path ? ' → ' + cell(op.afterPath) : ''} | ${cell(op.id)} | ${op.op} · ${cell(op.field)} | ${cell(op.before)} → ${cell(op.after)} | ${cell(op.reason)} |`)].join('\n');
  const spriteKeys = new Set(result.diff.operations.filter(op => op.field.endsWith('spriteKey')).map(op => op.after));
  for (const sprite of result.manifest.sprites.filter(s => s.proposalAsset)) spriteKeys.add(sprite.key);
  for (const resource of result.resources.filter(r => r.proposalState === 'added' && r.spriteKey)) spriteKeys.add(resource.spriteKey);
  const sprites = [...spriteKeys].map(key => {
    const entry = result.manifest.sprites.find(s => s.key === key);
    return `- ${key} · ${entry.proposalAsset ? 'mới — chưa có trong game; GDD ' + entry.source : 'game; bản GDD ' + entry.output} · PNG ${entry.width}×${entry.height} · 9-grid ${entry.border ? JSON.stringify(entry.border) : 'chưa có dữ liệu — cần dev xác minh, không đoán'}`;
  }).join('\n') || 'Không thêm hoặc đổi sprite.';
  const bindingText = bindings.length ? bindings.map(b => `- ${b.file}:${b.line} · ${b.id} · ${b.path} · ${b.kind} · ${b.note}`).join('\n') : 'Không tìm thấy literal ID/key/tên tương ứng trong tập .fcg đã quét. Điều này không chứng minh không có binding runtime.';
  const devWork = 'Cần dev: xác nhận alias, các assignment runtime và thứ tự GetChildByIndex/GetChildren trước mọi add/remove/move; widget thêm mới cần dev viết code binding/ecaScripts nếu có hành vi. Không tự suy hoặc tự tạo binding mới.\nTập quét: ' + BINDING_FILES.join(', ') + '. Không phải phân tích luồng dữ liệu toàn bộ code.';
  const values = { title: proposal.title, gameRoot, gddRoot: root, uiFile: base.source, proposalFile: `design/ui-proposals/${proposal.screen}/${proposal.id}.json`, status: proposal.status, summary: proposal.summary, operationCount: proposal.ops.length, operations, sprites, bindings: bindingText, devWork };
  const template = readFileSync(checkedPath(root, path.join(root, 'tools/templates/ui-proposal-prompt.md')), 'utf8');
  const prompt = template.replace(/\{\{(\w+)\}\}/g, (_, key) => { if (!(key in values)) throw new Error('Unknown template field: ' + key); return values[key]; });
  for (const match of prompt.matchAll(/[a-zA-Z]:[\\/][^\s<>|]*/g)) {
    const value = match[0].replace(/[).,;]+$/, '');
    const allowed = [root, gameRoot].some(parent => { const rel = path.relative(parent, value); return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep)); });
    if (!allowed) throw new Error('Prompt contains path outside game/GDD');
  }
  if (/\b(?:giftcode|Compensate)[\\/.]/i.test(prompt)) throw new Error('Operational path in prompt');
  if (/(?:^|\s)(?:\\\\[^\s]+|\/(?:etc|home|Users|tmp|var)\/[^\s]+|\.\.[\\/])/m.test(prompt)) throw new Error('Prompt contains path outside game/GDD');
  return prompt;
}
