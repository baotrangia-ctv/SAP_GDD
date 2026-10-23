// GDD normalized fields, verified against renderer + PetsCollection.ui.
// MCP: ScriptManual/Types/UIWidget, UIWidgetLabel, UIWidgetImage,
// UIWidgetButton. Layout serialization is observed in .ui; see DA-015.
const fields = {};
const add = (prefix, names, type) => names.split(' ').forEach(name => fields[prefix + name] = type);
add('', 'active', 'boolean'); add('', 'alpha', 'alpha');
for (const name of ['anchorMin', 'anchorMax', 'pivot', 'anchoredPosition', 'sizeDelta']) add(`transform.${name}.`, 'x y', 'number');
add('transform.', 'rotate', 'number');
for (const group of ['image', 'button']) {
  add(group + '.', group === 'image' ? 'color' : 'normal pressed disabled', 'color');
  add(group + '.', 'fillType fillDir', 'integer');
  add(group + '.', 'fillAmount', 'unit');
  add(group + '.', 'centerInvisible invertFill reverse.x reverse.y', 'boolean');
}
add('button.', 'disableCollider', 'boolean');
add('text.', 'value key', 'string'); add('text.', 'fontSize', 'positive');
add('text.', 'color shadowColor outlineColor backgroundColor', 'color');
add('text.', 'lineSpacing shadowOffset.x shadowOffset.y outlineOffset', 'number');
add('text.', 'outlineAlpha shadowAlpha', 'unit');
add('text.', 'shadow outline background fontStyle.bold fontStyle.italic fontStyle.underline', 'boolean');
add('text.alignment.', 'h', 'horizontal'); add('text.alignment.', 'v', 'vertical');
add('layout.', 'enable ignoreInactive', 'boolean');
add('layout.', 'corner constraint direction fixedRowCount fixedColumnCount sortType', 'integer');
add('layout.', 'size.x size.y space.x space.y offset.left offset.right offset.up offset.down tableOffset.left tableOffset.right tableOffset.up tableOffset.down tableSpace', 'number');
export const PATCH_FIELDS = Object.freeze(fields);
export const ENTITY_TYPES = Object.freeze({ UIRootEntity: null, UIEmptyEntity: null, UIImageEntity: 'image', UIButtonEntity: 'button', UITextEntity: 'text', UILayoutEntityV2: 'layout' });
export function validateField(node, field, value) {
  const type = PATCH_FIELDS[field];
  if (!type) throw new Error(`Unsupported patch field: ${field}`);
  const group = field.split('.')[0];
  if (['image', 'button', 'text', 'layout'].includes(group) && (ENTITY_TYPES[node.type] !== group || !node[group])) throw new Error(`Field ${field} does not belong to ${node.type}`);
  let valid = false;
  if (type === 'number') valid = Number.isFinite(value);
  if (type === 'integer') valid = Number.isInteger(value) && value >= 0;
  if (type === 'boolean' || type === 'string') valid = typeof value === type;
  if (type === 'color') valid = typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
  if (type === 'positive') valid = Number.isFinite(value) && value > 0;
  if (type === 'unit') valid = Number.isFinite(value) && value >= 0 && value <= 1;
  if (type === 'alpha') valid = Number.isFinite(value) && value >= 0 && value <= 100;
  if (type === 'horizontal') valid = ['left', 'center', 'right'].includes(value);
  if (type === 'vertical') valid = ['top', 'middle', 'bottom'].includes(value);
  if (!valid) throw new Error(`Invalid ${type} value for ${field}: ${JSON.stringify(value)}`);
  if (/fillType$/.test(field) && ![0, 1, 2, 3, 5].includes(value)) throw new Error(`Unsupported fillType: ${value}`);
  if (/fillDir$/.test(field) && value > 4) throw new Error(`Unsupported fillDir: ${value}`);
}
