"use strict";

Object.assign(pages, { uiproposal: "UI Proposal" });
const uiProposal = { registry: null, entry: null, base: null, proposed: null, resources: null, diff: null, prompt: "", mode: "proposed", opacity: .5, outlines: true, baseline: null, ticket: 0 };

function uiProposalPage() {
  return '<div class="ui-preview-page ui-proposal-page"><div class="section-heading"><div><p class="eyebrow">UI GAME</p><h1>UI Proposal</h1><p>Patch trên cây UI đã sync · người chơi mô phỏng · scaler và hình ảnh runtime chưa xác minh.</p></div></div>' +
    '<div class="ui-preview-toolbar"><label>Đề xuất <select id="ui-proposal-select" aria-label="Chọn đề xuất"></select></label><span id="ui-proposal-status"></span></div>' +
    '<p id="ui-proposal-summary"></p><div class="ui-preview-toolbar"><label>So sánh <select id="ui-proposal-mode"><option value="current">Hiện tại</option><option value="proposed" selected>Đề xuất</option><option value="overlay">Chồng lớp</option></select></label><label id="ui-proposal-opacity-label" hidden>Opacity đề xuất <input id="ui-proposal-opacity" type="range" min="0" max="1" step="0.05" value="0.5"><output id="ui-proposal-opacity-value">50%</output></label><label><input id="ui-proposal-outlines" type="checkbox" checked> Viền thêm / đổi / xoá</label><label><input id="ui-proposal-inspect" type="checkbox"> Chạm widget để Inspect</label></div>' +
    uiStageToolbar() + '<p class="ui-proposal-legend">Thêm: xanh lá · Đổi: vàng · Xoá: đỏ (xem Hiện tại / Chồng lớp)</p>' +
    '<div id="ui-preview-workspace" class="ui-preview-workspace"><div id="ui-preview-stage" class="ui-preview-stage"></div><aside id="ui-player-panel" class="ui-player-panel"></aside></div><p id="ui-proposal-warning" role="status"></p>' +
    '<div id="ui-proposal-details"></div></div>';
}

async function updateUiProposalPage() {
  const ticket = ++uiProposal.ticket;
  try {
    uiProposal.registry ||= await fetch('./data/ui/proposals/registry.json').then(checkUiJson);
    const entries = uiProposal.registry.proposals;
    if (s.page !== 'uiproposal' || ticket !== uiProposal.ticket) return;
    const select = document.getElementById('ui-proposal-select');
    select.innerHTML = entries.map(e => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');
    let remembered = ''; try { remembered = localStorage.getItem('uiProposalLast') || ''; } catch {}
    const segments = location.hash.slice(1).split('/');
    const hasRoute = segments[0] === 'uiproposal' && segments.length > 1;
    const entry = hasRoute ? entries.find(e => e.screen === segments[1] && e.id === segments[2]) : entries.find(e => e.id === remembered) || entries[0];
    if (!entry) throw new Error(hasRoute ? 'Deep-link đề xuất không tồn tại.' : 'Chưa có đề xuất.');
    const [base, proposed, resources, diff, prompt, rules, i18n] = await Promise.all([
      fetch(`./data/ui/${entry.screen}.json`).then(checkUiJson), fetch(entry.data).then(checkUiJson), fetch(entry.resources).then(checkUiJson), fetch(entry.diff).then(checkUiJson),
      fetch(entry.prompt).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }),
      fetch(`./data/ui/${entry.screen}-rules.json`).then(checkUiJson), fetch(`./data/ui/${entry.screen}-i18n.json`).then(checkUiJson)
    ]);
    if (s.page !== 'uiproposal' || ticket !== uiProposal.ticket) return;
    Object.assign(uiProposal, { entry, base, proposed, resources, diff, prompt });
    Object.assign(uiPreview, { screen: proposed, manifest: resources.manifest, rules, i18n, width: base.referenceSize.width, height: base.referenceSize.height, open: true });
    select.value = entry.id;
    document.getElementById('ui-proposal-status').textContent = `${entry.status} · ${entry.author}`;
    document.getElementById('ui-proposal-summary').textContent = entry.summary;
    document.getElementById('ui-proposal-mode').value = uiProposal.mode;
    document.getElementById('ui-proposal-outlines').checked = uiProposal.outlines;
    document.getElementById('ui-proposal-opacity').value = uiProposal.opacity;
    document.getElementById('ui-language').value = uiPreview.language;
    document.getElementById('ui-preview-aspect').value = uiPreview.aspect;
    try { localStorage.setItem('uiProposalLast', entry.id); } catch {}
    history.replaceState(null, '', `#uiproposal/${entry.screen}/${entry.id}`);
    mountUiProposal();
    if (typeof renderUiProposalDetails === 'function') renderUiProposalDetails();
  } catch (error) {
    if (s.page === 'uiproposal' && ticket === uiProposal.ticket) document.getElementById('ui-preview-stage').textContent = 'Không tải được UI Proposal: ' + error.message;
  }
}

function mountUiProposal() {
  const stage = document.getElementById('ui-preview-stage');
  if (!stage || !uiProposal.proposed) return;
  const current = uiProposal.mode === 'current';
  uiPreview.screen = current ? uiProposal.base : uiProposal.proposed;
  const states = Object.fromEntries(uiProposal.resources.resources.map(r => [r.id, r.proposalState]));
  // Include non-visual entities too; removal subtrees remain on the before tree.
  function collect(node) { states[node.id] = node.proposalState; node.children.forEach(collect); }
  collect(uiProposal.proposed.tree);
  for (const tree of uiProposal.proposed.removedEntities || []) collect(tree);
  uiPreview.rendered = uiStageMount(stage, uiPreview, { proposalStates: states });
  const rendered = uiPreview.rendered;
  rendered.canvas.dataset.proposalLayer = current ? 'current' : 'proposed';
  uiProposal.baseline = null;
  let baselineBinding = null;
  const refresh = () => { baselineBinding?.refresh(); if (typeof renderUiProposalResources === 'function') renderUiProposalResources(); };
  // Structural patches can invalidate Collection's template bindings. Show the
  // tree faithfully and request developer bindings instead of inventing them.
  const structural = uiProposal.diff.operations.some(op => ['add', 'remove', 'move'].includes(op.op));
  const bind = (screen, rendered, passive = false) => {
    if (structural) return null;
    return initCollectionPreview(screen, uiPreview.rules, rendered, { context: uiPreview, passive, onUpdate: passive ? () => {} : refresh });
  };
  if (uiProposal.mode === 'overlay') {
    const context = { ...uiPreview, screen: uiProposal.base };
    const baseline = uiRenderer.render(context.screen, context.manifest, context.width, context.height, { proposalStates: states });
    baseline.canvas.classList.add('ui-proposal-baseline'); baseline.canvas.dataset.proposalLayer = 'current';
    stage.prepend(baseline.canvas); uiStageScale(stage, baseline.canvas, uiPreview);
    uiProposal.baseline = baseline;
    baselineBinding = bind(context.screen, baseline, true);
  }
  bind(uiPreview.screen, rendered);
  if (structural) document.getElementById('ui-player-panel').textContent = 'Cây đã áp patch. Cần dev xác nhận binding tương tác cho thay đổi cấu trúc.';
  document.getElementById('ui-proposal-warning').textContent = structural ? 'Có add/remove/move: mô phỏng tương tác cần dev xác nhận binding; không tự suy code mới.' : '';
  document.getElementById('ui-open-toggle').textContent = uiPreview.open ? 'Đóng UI' : 'Mở UI';
  rendered.canvas.classList.toggle('ui-closed', !uiPreview.open);
  for (const canvas of [rendered.canvas, uiProposal.baseline?.canvas].filter(Boolean)) {
    canvas.classList.toggle('ui-debug', document.getElementById('ui-debug').checked);
    canvas.classList.toggle('ui-show-inactive', document.getElementById('ui-show-inactive').checked);
  }
  const audit = auditUiPreviewDom(uiPreview.screen.tree, rendered.canvas);
  const meta = document.getElementById('ui-preview-meta'); meta.dataset.uiAudit = JSON.stringify(audit);
  meta.textContent = `DOM ${audit.actual}/${audit.expected}, lệch ${audit.mismatches} · root ${uiPreview.width}×${uiPreview.height} · scaler/safe area chưa xác minh`;
  applyUiProposalComparison();
  refresh();
}
function applyUiProposalComparison() {
  const stage = document.getElementById('ui-preview-stage'); if (!stage) return;
  stage.classList.toggle('ui-proposal-outlines', uiProposal.outlines);
  if (uiPreview.rendered) uiPreview.rendered.canvas.style.opacity = uiProposal.mode === 'overlay' ? uiProposal.opacity : 1;
  document.getElementById('ui-proposal-opacity-label').hidden = uiProposal.mode !== 'overlay';
  document.getElementById('ui-proposal-opacity-value').textContent = Math.round(uiProposal.opacity * 100) + '%';
}
window.addEventListener('resize', () => { if (s.page === 'uiproposal') uiStageScale(document.getElementById('ui-preview-stage'), uiProposal.baseline?.canvas, uiPreview); });
document.addEventListener('change', event => {
  if (s.page !== 'uiproposal' || !uiProposal.proposed) return;
  const target = event.target;
  if (target.id === 'ui-proposal-select') { const entry = uiProposal.registry.proposals.find(e => e.id === target.value); location.hash = `uiproposal/${entry.screen}/${entry.id}`; }
  if (target.id === 'ui-proposal-mode') { uiProposal.mode = target.value; mountUiProposal(); }
  if (target.id === 'ui-proposal-outlines') { uiProposal.outlines = target.checked; applyUiProposalComparison(); }
  if (target.id === 'ui-language') { uiPreview.language = target.value; mountUiProposal(); }
  if (target.id === 'ui-preview-aspect') { uiPreview.aspect = target.value; scaleUiPreview(); uiStageScale(document.getElementById('ui-preview-stage'), uiProposal.baseline?.canvas, uiPreview); }
  if (target.id === 'ui-debug' || target.id === 'ui-show-inactive') for (const canvas of [uiPreview.rendered.canvas, uiProposal.baseline?.canvas].filter(Boolean)) canvas.classList.toggle(target.id === 'ui-debug' ? 'ui-debug' : 'ui-show-inactive', target.checked);
});
document.addEventListener('input', event => { if (s.page === 'uiproposal' && event.target.id === 'ui-proposal-opacity') { uiProposal.opacity = Number(event.target.value); applyUiProposalComparison(); } });
document.addEventListener('click', event => {
  if (s.page !== 'uiproposal' || event.target.id !== 'ui-open-toggle' || !uiPreview.rendered) return;
  uiPreview.open = !uiPreview.open;
  for (const canvas of [uiPreview.rendered.canvas, uiProposal.baseline?.canvas].filter(Boolean)) canvas.classList.toggle('ui-closed', !uiPreview.open);
  event.target.textContent = uiPreview.open ? 'Đóng UI' : 'Mở UI';
});
