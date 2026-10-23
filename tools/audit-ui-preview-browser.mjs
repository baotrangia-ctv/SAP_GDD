import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Optional QA dependency; the static site has no build/runtime dependencies.
export async function auditBrowser(url, screen) {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ channel: process.env.UI_AUDIT_BROWSER || "msedge" });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) errors.push(message.text()); });
      await page.goto(new URL("/#uipreview/collection", url).href);
      await page.waitForSelector("[data-ui-pet-id]");
      await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
      const button = name => `#ui-preview-stage button[data-ui-name="${name}"]`;
      let clicks = 0;
      const measurements = [];
      async function position(selector) {
        // Establish the test's starting viewport explicitly. Actions below use
        // raw mouse coordinates, never locator.click()'s implicit scrolling.
        await page.evaluate(selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          window.scrollTo(0, Math.max(0, window.scrollY + r.top - 180));
          document.querySelector(".ui-resource-scroll").scrollTop = 227;
          document.querySelector(".ui-resource-scroll").scrollLeft = 83;
        }, selector);
      }
      const measure = () => page.evaluate(() => ({
        y: window.scrollY, x: window.scrollX, hash: location.hash,
        top: document.querySelector(".ui-resource-scroll").scrollTop,
        left: document.querySelector(".ui-resource-scroll").scrollLeft
      }));
      async function click(selector) {
        await position(selector);
        const point = await page.evaluate(selector => {
          const el = document.querySelector(selector), r = el.getBoundingClientRect();
          const x = r.left + r.width / 2, y = r.top + r.height / 2;
          return { x, y, hit: document.elementFromPoint(x, y) === el, width: r.width, height: r.height };
        }, selector);
        assert.ok(point.hit && point.width > 0 && point.height > 0, `Hit target blocked: ${selector} (${viewport.width}px)`);
        const before = await measure();
        await page.mouse.click(point.x, point.y);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(await measure(), before, `Viewport/resource scroll changed: ${selector}`);
        measurements.push({ selector, before, after: await measure() });
        clicks++;
      }
      // Verify raw values against the source-exported tree, including inactive
      // nodes. The existing web cascade is provisional; this verifies web
      // behavior and raw source values, not engine parity.
      const alpha = await page.evaluate(tree => {
        const values = [];
        function walk(node, parentAlpha = 1) {
          const el = [...document.querySelectorAll("[data-ui-id]")].find(el => el.dataset.uiId === String(node.id));
          const effective = parentAlpha * node.alpha / 100;
          let actual = 1;
          for (let current = el; current?.classList.contains("ui-entity"); current = current.parentElement) actual *= Number(getComputedStyle(current).opacity);
          if (Math.abs(actual - effective) > 1e-8) throw new Error(`Web alpha cascade mismatch: ${node.path}`);
          if (node.alpha !== 100) {
            values.push({ path: node.path, expected: node.alpha / 100, actual: Number(getComputedStyle(el).opacity),
              hit: getComputedStyle(el).pointerEvents, type: node.type, entityOpacity: getComputedStyle(el).opacity });
          }
          node.children.forEach(child => walk(child, effective));
        }
        walk(tree); return values;
      }, screen.tree);
      for (const item of alpha) {
        assert.equal(item.actual, item.expected, item.path);
        assert.equal(item.hit, item.type === "UIButtonEntity" ? "auto" : "none", item.path);
      }
      // Keep table node identity and filter stable throughout gameplay.
      await page.evaluate(() => { window.auditResourceRows = [...document.querySelectorAll("#ui-resource-rows tr")]; });
      for (const rarity of ["Common", "Rare", "Epic", "Legendary", "Mythic", "Apex", "Limited", "All"]) {
        await click(button(`${rarity}TabButton`));
        assert.equal(await page.evaluate(() => collectionPreview.rarity), rarity.toUpperCase());
      }
      let petsClicked = 0;
      for (let pageIndex = 0; ; pageIndex++) {
        const petIds = await page.evaluate(() => [...document.querySelectorAll("[data-ui-pet-id]")].filter(el => el.getBoundingClientRect().width > 0).map(el => el.dataset.uiPetId));
        for (const expected of petIds) {
          await click(`[data-ui-pet-id="${expected}"] button`);
          assert.equal(await page.evaluate(() => collectionPreview.selected.ID), expected);
          petsClicked++;
        }
        if (!await page.locator(button("NextPageButton")).isVisible()) break;
        await click(button("NextPageButton"));
        assert.equal(await page.evaluate(() => collectionPreview.page), pageIndex + 1);
      }
      while (await page.locator(button("PrevPageButton")).isVisible()) await click(button("PrevPageButton"));
      assert.equal(await page.evaluate(() => collectionPreview.page), 0);
      for (const tab of ["Mutations", "Weathers", "Info"]) {
        await click(button(`${tab}TabButton`));
        assert.equal(await page.evaluate(() => collectionPreview.detailTab), tab);
      }
      const selectedBeforeDetails = await page.evaluate(() => collectionPreview.selected.ID);
      await click('[data-ui-path="PetsCollection/Container/PetDetails/Pet/ShowDetailsPetButton"]');
      assert.equal(await page.evaluate(() => collectionPreview.selected.ID), selectedBeforeDetails, "Details button is outside the game's _PetWidgets list");
      const beforeFilter = await page.evaluate(() => {
        const input = document.getElementById("ui-resource-search"); input.value = "Thumbnail"; input.dispatchEvent(new Event("input", { bubbles: true }));
        return [...document.querySelectorAll("#ui-resource-rows tr")].filter(row => !row.hidden).map(row => row.dataset.resourceId);
      });
      await click(button("RareTabButton"));
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#ui-resource-rows tr")].filter(row => !row.hidden).map(row => row.dataset.resourceId)), beforeFilter);
      assert.ok(await page.evaluate(() => window.auditResourceRows.every(row => row.isConnected)), "Resource rows replaced");
      // Exercise actual Recipe routing with the first source-valid secret
      // fusion pet whose second material has a collection destination.
      await page.selectOption("#ui-player-mode", "none");
      const recipePet = await page.evaluate(() => {
        const r = uiPreview.rules, rows = t("Pet.csv").rows;
        return rows.find(pet => {
          const id = Number(pet.ID);
          if (!(id > r.obtain.secretFusionStart && id <= r.obtain.secretFusionStart + r.obtain.secretFusionCount) || id === r.obtain.secretFusionException) return false;
          const previous = rows.filter(p => Number(p.Rank) < Number(pet.Rank) && p[r.obtain.canFuseColumn] === "1").sort((a, b) => Number(b.Rank) - Number(a.Rank))[0];
          const prev = Number(previous?.ID);
          return prev > r.obtain.secretFusionStart && prev <= r.obtain.secretFusionStart + r.obtain.secretFusionCount && prev !== r.obtain.secretFusionException;
        });
      });
      assert.ok(recipePet, "No source-valid redirect fixture");
      await click(button(`${recipePet.Rarity[0]}${recipePet.Rarity.slice(1).toLowerCase()}TabButton`));
      // Navigate via visible buttons until the target pet appears.
      let found = false;
      for (let i = 0; i < 100; i++) {
        if (await page.locator(`[data-ui-pet-id="${recipePet.ID}"]`).count()) { found = true; break; }
        assert.ok(await page.locator(button("NextPageButton")).isVisible(), "Recipe pet missing from rarity");
        await click(button("NextPageButton"));
      }
      assert.ok(found);
      await click(`[data-ui-pet-id="${recipePet.ID}"] button`);
      const redirect = button("RedirectCollectionButton");
      const destination = await page.locator(redirect).getAttribute("data-ui-recipe-target");
      assert.ok(destination);
      await click(redirect);
      assert.equal(await page.evaluate(() => collectionPreview.selected.ID), destination);
      await click(button("CloseButton"));
      assert.equal(await page.evaluate(() => uiPreview.open), false);
      await click("#ui-open-toggle");
      assert.equal(await page.evaluate(() => uiPreview.open), true);
      // Resource clicks have no selection, navigation, or focus effect.
      await page.evaluate(() => { document.getElementById("ui-resource-search").value = ""; document.getElementById("ui-resource-search").dispatchEvent(new Event("input", { bubbles: true })); });
      const resource = "#ui-resource-rows tr";
      await position(resource);
      const before = await measure();
      await page.locator(resource).first().dispatchEvent("click");
      assert.deepEqual(await measure(), before);
      assert.equal(await page.locator(".ui-resource-selected").count(), 0);
      assert.deepEqual(errors, [], "Browser console/page errors");
      results.push({ viewport, clicks, petsClicked, scroll: "unchanged before/after every mouse click", sample: measurements[0], alpha, measurements });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ browserAudit: results.map(({ measurements, ...summary }) => summary) }, null, 2));
  return { browser: "chromium", channel: process.env.UI_AUDIT_BROWSER || "msedge", results };
}
