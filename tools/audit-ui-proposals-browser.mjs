import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { GDD_ROOT } from './sync-ui-proposals.mjs';

export async function auditProposalBrowser(url, registry, fixture) {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: process.env.UI_AUDIT_BROWSER || 'msedge' });
  const reports = [];
  try {
    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', msg => { if (msg.type() === 'error' && !msg.location().url.endsWith('/favicon.ico')) errors.push(msg.text()); });
      for (const entry of registry.proposals) {
        await page.goto(new URL(`/#uiproposal/${entry.screen}/${entry.id}`, url).href);
        await page.waitForSelector('#ui-proposal-resource-rows tr');
        assert.ok((await page.locator('#ui-proposal-summary').innerText()).includes('kiểm pipeline'));
        const modes = [];
        for (const mode of ['current', 'proposed', 'overlay']) {
          await page.selectOption('#ui-proposal-mode', mode);
          const audit = await page.evaluate(() => ({ ...JSON.parse(document.getElementById('ui-preview-meta').dataset.uiAudit),
            layers: document.querySelectorAll('#ui-preview-stage > .ui-canvas').length,
            left: uiPreview.rendered.byId.get('JRxpWV4m').style.left,
            expectedLeft: uiRenderer.rect(uiPreview.screen.tree.children.find(n=>n.name==='Container').children.find(n=>n.name==='Title').children.find(n=>n.id==='JRxpWV4m').transform, {width:800,height:80}).left
          }));
          assert.equal(audit.actual, audit.expected); assert.equal(audit.mismatches, 0);
          assert.equal(audit.layers, mode === 'overlay' ? 2 : 1);
          assert.equal(parseFloat(audit.left), mode === 'current' ? 40 : 44);
          // Shared collection binding still accepts real clicks in all modes.
          const rarity = page.locator('#ui-preview-stage > .ui-canvas:last-child button[data-ui-name="RareTabButton"]');
          await rarity.click();
          assert.equal(await page.evaluate(() => collectionPreview.rarity), 'RARE');
          await page.selectOption('#ui-player-mode', 'none');
          assert.equal(await page.evaluate(() => collectionPreview.mode), 'none');
          await page.selectOption('#ui-player-mode', 'all');
          await page.locator('#ui-preview-stage > .ui-canvas:last-child button[data-ui-name="AllTabButton"]').click();
          modes.push({ mode, entityCount: audit.actual, layers: audit.layers, labelLeft: audit.left });
        }
        await page.locator('#ui-proposal-opacity').fill('0.25');
        assert.equal(await page.locator('#ui-preview-stage > .ui-canvas:last-child').evaluate(el => el.style.opacity), '0.25');
        await page.locator('#ui-proposal-outlines').uncheck();
        assert.equal(await page.locator('#ui-preview-stage').evaluate(el => el.classList.contains('ui-proposal-outlines')), false);
        await page.locator('#ui-proposal-outlines').check();
        await page.selectOption('#ui-proposal-mode', 'proposed');
        // Tap-to-inspect is available on mobile; right-click remains available.
        await page.locator('#ui-proposal-inspect').check();
        const label = page.locator('#ui-preview-stage > .ui-canvas:last-child [data-ui-id="JRxpWV4m"]');
        await label.scrollIntoViewIfNeeded();
        const rect = await label.boundingBox();
        await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.waitForSelector('.ui-inspector-dialog');
        const choices = page.locator('.ui-inspector-layer-choice').filter({ hasText: /Label · UITextEntity/ });
        if (await choices.count()) await choices.first().click();
        assert.match(await page.locator('.ui-inspector-proposal').innerText(), /40 → 44/);
        assert.match(await page.locator('.ui-inspector-proposal').innerText(), /Reason:/);
        const inspectorBounds = await page.locator('.ui-inspector-dialog').boundingBox();
        assert.ok(inspectorBounds.x >= 0 && inspectorBounds.x + inspectorBounds.width <= viewport.width + 1);
        await page.keyboard.press('Escape');
        await page.locator('#ui-proposal-inspect').uncheck();
        await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2, { button: 'right' });
        await page.waitForSelector('.ui-inspector-dialog'); await page.keyboard.press('Escape');
        await page.locator('#ui-proposal-copy').click();
        await page.waitForFunction(() => document.getElementById('ui-proposal-copy-status').textContent === 'Đã sao chép prompt');
        assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), await page.locator('#ui-proposal-prompt-text').innerText());
        await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('audit clipboard denied'); }; });
        await page.locator('#ui-proposal-copy').click();
        await page.waitForFunction(() => document.getElementById('ui-proposal-copy-status').textContent.includes('audit clipboard denied'));
        await page.selectOption('#ui-proposal-filter', 'changed');
        const changedCount = await page.locator('#ui-proposal-resource-rows tr:visible').count(); assert.ok(changedCount >= 2);
        await page.locator('#ui-proposal-search').fill('Title/Label');
        assert.equal(await page.locator('#ui-proposal-resource-rows tr:visible').count(), 1);
        await page.locator('#ui-proposal-search').fill('');
        await page.selectOption('#ui-proposal-filter', '');
        await page.selectOption('#ui-proposal-file-filter', 'missing');
        assert.ok(await page.locator('#ui-proposal-resource-rows tr:visible').count() > 0);
        await page.selectOption('#ui-proposal-file-filter', '');
        await page.selectOption('#ui-proposal-filter', 'added'); assert.equal(await page.locator('#ui-proposal-resource-rows tr:visible').count(), 0);
        await page.selectOption('#ui-proposal-filter', 'removed'); assert.equal(await page.locator('#ui-proposal-resource-rows tr:visible').count(), 0);
        await page.selectOption('#ui-proposal-filter', 'changed');
        await page.selectOption('#ui-preview-aspect', '4:3');
        await page.selectOption('#ui-preview-aspect', '18:9');
        await page.locator('#ui-debug').check(); await page.locator('#ui-show-inactive').check();
        await page.locator('#ui-debug').uncheck(); await page.locator('#ui-show-inactive').uncheck();
        await page.selectOption('#ui-language', 'en'); await page.selectOption('#ui-language', 'vi');
        await page.locator('#ui-open-toggle').click(); await page.locator('#ui-open-toggle').click();
        const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, table: document.querySelector('.ui-resource-scroll').scrollWidth, tableWidth: document.querySelector('.ui-resource-scroll').clientWidth }));
        assert.ok(overflow.width <= overflow.viewport, 'Page horizontal overflow'); assert.ok(overflow.table <= overflow.tableWidth + 1, 'Resource horizontal overflow');
        await page.evaluate(() => { window.scrollTo(0, 0); document.getElementById('ui-proposal-copy-status').textContent = ''; });
        await page.screenshot({ path: path.join(GDD_ROOT, 'dist/data/ui', `proposals-browser-${viewport.width}.png`), fullPage: true });
        // Re-entering Preview must restore the unpatched tree.
        await page.evaluate(() => go('uipreview'));
        await page.waitForFunction(() => s.page === 'uipreview' && uiPreview.screen?.tree && document.querySelector('#ui-resource-rows tr'));
        assert.equal(await page.evaluate(() => uiPreview.screen.tree.children.find(n => n.name==='Container').children.find(n=>n.name==='Title').children.find(n=>n.id==='JRxpWV4m').transform.anchoredPosition.x), 40);
        await page.evaluate(() => go('uiproposal'));
        await page.waitForSelector('#ui-proposal-prompt-text');
        await page.goto(new URL('/#uiproposal/collection/not-found', url).href);
        await page.waitForFunction(() => document.getElementById('ui-preview-stage')?.textContent.includes('không tồn tại'));
        await page.goto(new URL('/', url).href);
        await page.waitForFunction(() => !!s.data);
        await page.evaluate(() => go('uiproposal'));
        await page.waitForSelector('#ui-proposal-prompt-text');
        assert.ok(page.url().endsWith(`#uiproposal/${entry.screen}/${entry.id}`));
        reports.push({ viewport, id: entry.id, modes, tapAndRightClickInspector: true, clipboardSuccessAndFailure: true, resourceFilters: true, deepLinkAndRememberedSelection: true, previewRestored: true, horizontalOverflow: false, consoleErrors: errors.length });
      }
      // Network-only fixture exercises structural patches without adding a
      // second proposal to the GDD registry or writing any game file.
      if (fixture) {
        const prefix = './data/ui/proposals/browser-fixture';
        const entry = { ...fixture.screen.proposal, data: prefix + '.json', diff: prefix + '-diff.json', resources: prefix + '-resources.json', prompt: prefix + '-prompt.md' };
        const payloads = new Map([['registry.json', { proposals: [entry] }], ['browser-fixture.json', fixture.screen], ['browser-fixture-diff.json', fixture.diff], ['browser-fixture-resources.json', { resources: fixture.resources, manifest: fixture.manifest }], ['browser-fixture-prompt.md', fixture.prompt]]);
        await page.route('**/data/ui/proposals/*', route => {
          const payload = payloads.get(new URL(route.request().url()).pathname.split('/').at(-1));
          return payload == null ? route.continue() : route.fulfill({ contentType: typeof payload === 'string' ? 'text/markdown' : 'application/json', body: typeof payload === 'string' ? payload : JSON.stringify(payload) });
        });
        await page.goto(new URL('/?audit-fixture=1#uiproposal/collection/browser-fixture', url).href);
        await page.waitForSelector('#ui-proposal-resource-rows tr', { timeout: 5000 }).catch(async error => { throw new Error(await page.locator('#ui-preview-stage').innerText() + ' / ' + errors.join('; ')); });
        for (const mode of ['current', 'proposed', 'overlay']) {
          await page.selectOption('#ui-proposal-mode', mode);
          const audit = await page.evaluate(() => JSON.parse(document.getElementById('ui-preview-meta').dataset.uiAudit));
          assert.equal(audit.actual, mode === 'current' ? 107 : fixture.screen.entityCount); assert.equal(audit.mismatches, 0);
        }
        await page.selectOption('#ui-proposal-filter', 'added'); assert.ok(await page.locator('#ui-proposal-resource-rows tr:visible').count() > 0);
        await page.selectOption('#ui-proposal-filter', 'removed'); assert.ok(await page.locator('#ui-proposal-resource-rows tr:visible').count() > 0);
        await page.locator('#ui-preview-stage > .ui-canvas:last-child button[data-ui-name="RareTabButton"]').click();
        assert.equal(await page.evaluate(() => collectionPreview.rarity), 'RARE');
        await page.addInitScript(() => {
          const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
          Storage.prototype.getItem = function(key) { if (key.startsWith('uiProposal')) throw new Error('storage denied'); return read.call(this, key); };
          Storage.prototype.setItem = function(key, value) { if (key.startsWith('uiProposal')) throw new Error('storage denied'); return write.call(this, key, value); };
        });
        await page.reload(); await page.waitForSelector('#ui-proposal-resource-rows tr');
        reports.at(-1).structuralFixture = { operations: 5, expectedEntities: fixture.screen.entityCount, domMatchesAllModes: true, addedRemovedFilters: true, retainedCollectionBinding: true, storageDeniedHandled: true };
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    return reports;
  } finally { await browser.close(); }
}
