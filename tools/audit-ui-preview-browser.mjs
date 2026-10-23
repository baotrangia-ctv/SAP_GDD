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
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin }).catch(() => {});
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
      const textRendering = await page.evaluate(() => {
        const spans = [...document.querySelectorAll("#ui-preview-stage .ui-text")];
        const entities = [...document.querySelectorAll("#ui-preview-stage .ui-entity")];
        return {
          count: spans.length,
          spans: spans.map(span => ({ font: span.dataset.uiFont, lineSpacing: Number(span.dataset.uiLineSpacing), overflow: span.dataset.uiOverflow,
            backgroundEnabled: span.dataset.uiBackgroundEnabled === "true", gradient: Number(span.dataset.uiGradient), overflowStyle: getComputedStyle(span).overflow,
            lineHeight: getComputedStyle(span).lineHeight, fontFamily: getComputedStyle(span).fontFamily })),
          transformOrigins: entities.map(el => {
            const transform = JSON.parse(el.dataset.uiTransform || "{}");
            const pivot = transform.pivot || { x: .5, y: .5 };
            return { expected: `${pivot.x * 100}% ${(1 - pivot.y) * 100}%`, actual: el.style.transformOrigin };
          }),
          aspectOptions: [...document.querySelectorAll("#ui-preview-aspect option")].map(option => option.value),
          selectedAspect: document.getElementById("ui-preview-aspect").value,
          stageAspect: document.getElementById("ui-preview-stage").style.aspectRatio,
          radialFill: document.querySelector('[data-ui-path="PetsCollection/Container/PetsCount/Progress"]')?.style.maskImage || ""
        };
      });
      assert.ok(textRendering.count >= 33);
      assert.ok(textRendering.spans.every(span => span.font && Number.isFinite(span.lineSpacing)), "Source text style metadata missing on rendered or cloned text");
      assert.ok(textRendering.spans.every(span => span.overflowStyle === "hidden"), "UIText must clip to its RectTransform in the web preview");
      assert.ok(textRendering.spans.every(span => !/Arial/i.test(span.fontFamily)), "UIText still uses Arial instead of the browser system font stack");
      assert.ok(textRendering.transformOrigins.every(item => item.expected === item.actual), "Transform origin does not follow the source pivot");
      assert.deepEqual(textRendering.aspectOptions, ["16:9", "18:9", "20:9", "4:3"]);
      assert.equal(textRendering.selectedAspect, "18:9");
      assert.match(textRendering.radialFill, /conic-gradient/);
      await page.selectOption("#ui-preview-aspect", "4:3");
      const alternateAspect = await page.evaluate(() => {
        const stage = document.getElementById("ui-preview-stage");
        return { selected: document.getElementById("ui-preview-aspect").value, width: stage.clientWidth, height: stage.clientHeight,
          canvas: stage.firstElementChild.getBoundingClientRect().toJSON() };
      });
      assert.equal(alternateAspect.selected, "4:3");
      assert.ok(Math.abs(alternateAspect.width / alternateAspect.height - 4 / 3) < .03, "4:3 viewport preset did not resize its frame");
      await page.selectOption("#ui-preview-aspect", "18:9");
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
      await click(button("MutationsTabButton"));
      const layoutPositions = await page.evaluate(tree => {
        const sourceNodes = new Map();
        function index(node) { sourceNodes.set(node.path, node); node.children.forEach(index); }
        index(tree);
        const paths = {
          rarity: "PetsCollection/Container/RarityTabsLayout",
          pets: "PetsCollection/Container/PetsLayout",
          details: "PetsCollection/Container/DetailsTabsLayout",
          mw: "PetsCollection/Container/MutationsWeathers/MWLayout"
        };
        const result = {};
        for (const [key, path] of Object.entries(paths)) {
          const source = sourceNodes.get(path);
          const root = document.querySelector(`[data-ui-path="${path}"]`);
          const children = [...root.children].filter(child => child.classList.contains("ui-entity"));
          result[key] = {
            size: { width: Number.parseFloat(root.style.width), height: Number.parseFloat(root.style.height) },
            cell: source.layout.size,
            gap: source.layout.space,
            positions: children.map(child => ({ x: Number.parseFloat(child.style.left), y: Number.parseFloat(child.style.top), visible: getComputedStyle(child).display !== "none" }))
          };
        }
        return result;
      }, screen.tree);
      const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: expected ${expected}, received ${actual}`);
      assert.equal(layoutPositions.rarity.positions.length, 8);
      layoutPositions.rarity.positions.forEach((point, index) => { near(point.x, 0, `rarity ${index} x`); near(point.y, index * 57, `rarity ${index} y`); });
      const petColumns = Math.floor((416 + 4) / (layoutPositions.pets.cell.x + 4));
      assert.equal(petColumns, 4, "PetsLayout column count from .ui geometry");
      layoutPositions.pets.positions.slice(0, 16).forEach((point, index) => {
        near(point.x, index % petColumns * 104, `pet ${index} x`);
        near(point.y, Math.floor(index / petColumns) * 108 + 5, `pet ${index} y`);
      });
      layoutPositions.details.positions.forEach((point, index) => { near(point.x, index * 114, `details ${index} x`); near(point.y, 0, `details ${index} y`); });
      assert.equal(layoutPositions.mw.positions.filter(point => point.visible).length, layoutPositions.mw.positions.length, "Mutation icons should be visible in this state");
      layoutPositions.mw.positions.slice(0, 6).forEach((point, index) => {
        near(point.x, index % 5 * 56, `M/W icon ${index} x`);
        near(point.y, Math.floor(index / 5) * 54, `M/W icon ${index} y`);
      });
      const inspectorBefore = { ...await measure(), state: await page.evaluate(() => ({ rarity: collectionPreview.rarity, page: collectionPreview.page, selected: collectionPreview.selected.ID })) };
      await page.evaluate(() => { window.auditInspectorContextPrevented = false; document.addEventListener("contextmenu", event => { if (event.target.closest(".ui-canvas")) window.auditInspectorContextPrevented = event.defaultPrevented; }); });
      const clonePoint = await page.evaluate(() => {
        const clone = document.querySelector('[data-ui-clone-template-path="PetsCollection/Container/PetsLayout/Pet (1)"][data-ui-clone-index="1"]');
        const rect = clone.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await page.mouse.click(clonePoint.x, clonePoint.y, { button: "right" });
      await page.waitForSelector(".ui-inspector-dialog");
      const inspectorOpen = await page.evaluate(async () => {
        const dialog = document.querySelector(".ui-inspector-dialog"), rect = dialog.getBoundingClientRect();
        const first = document.querySelector(".ui-inspector-layer-choice");
        const cloneText = dialog.innerText;
        return { layers: document.querySelectorAll(".ui-inspector-layer-choice").length, cloneIdentity: cloneText.includes("PetsCollection/Container/PetsLayout/Pet (1)"),
          requiredFields: ["_entityId", "Transform", "propsData đầy đủ", "ecaProps", "HudCollection.fcg"].every(value => cloneText.includes(value)),
          rightClickPrevented: window.auditInspectorContextPrevented, rect: rect.toJSON(), width: window.innerWidth, height: window.innerHeight,
          firstPath: first?.textContent || "", selectedOutline: document.querySelector(".ui-inspector-selected")?.dataset.uiClonePath || document.querySelector(".ui-inspector-selected")?.dataset.uiPath || "" };
      });
      assert.ok(inspectorOpen.layers > 1, "Inspector should list overlapping widgets");
      assert.ok(inspectorOpen.cloneIdentity, "Inspector omitted clone template path/index");
      assert.ok(inspectorOpen.requiredFields, "Inspector omitted required identity/property/source fields");
      assert.ok(inspectorOpen.rightClickPrevented, "Canvas context menu was not prevented");
      assert.ok(inspectorOpen.rect.left >= 0 && inspectorOpen.rect.top >= 0 && inspectorOpen.rect.right <= inspectorOpen.width && inspectorOpen.rect.bottom <= inspectorOpen.height, "Inspector dialog escaped viewport");
      const selectedBeforeRow = inspectorOpen.selectedOutline;
      if (inspectorOpen.layers > 1) await page.locator(".ui-inspector-layer-choice").nth(1).dispatchEvent("click");
      const rowSelectionChanged = await page.evaluate(previous => {
        const current = document.querySelector(".ui-inspector-selected"); return (current?.dataset.uiClonePath || current?.dataset.uiPath || "") !== previous;
      }, selectedBeforeRow);
      assert.ok(rowSelectionChanged, "Selecting an overlap row did not inspect that widget");
      await page.locator(".ui-inspector-copy").dispatchEvent("click");
      await page.waitForFunction(() => document.querySelector(".ui-inspector-copy-status")?.textContent.includes("sao chép") || document.querySelector(".ui-inspector-copy-status")?.textContent.includes("Không sao chép"));
      const copyStatus = await page.locator(".ui-inspector-copy-status").innerText();
      assert.match(copyStatus, /đã sao chép/i, `Inspector JSON copy failed: ${copyStatus}`);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".ui-inspector-dialog").count(), 0, "Escape did not close Inspector");
      const outsideContextDefaultPrevented = await page.evaluate(() => {
        const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
        document.getElementById("ui-resource-panel").dispatchEvent(event); return event.defaultPrevented;
      });
      assert.equal(outsideContextDefaultPrevented, false, "Outside context menu should keep its default behavior");
      const inspectorUnchanged = { ...await measure(), state: await page.evaluate(() => ({ rarity: collectionPreview.rarity, page: collectionPreview.page, selected: collectionPreview.selected.ID })) };
      assert.deepEqual(inspectorUnchanged, inspectorBefore, "Right-click Inspector changed UI state, hash, or scroll");
      await page.locator("#ui-show-inactive").check();
      const hiddenHit = await page.evaluate(() => {
        const canvas = document.querySelector(".ui-canvas"), hidden = document.querySelector('[data-ui-path="PetsCollection/Container/LoadingLabel"]');
        const rect = hidden.getBoundingClientRect(), point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        return { display: getComputedStyle(hidden).display, path: hidden.dataset.uiPath, hit: uiWidgetInspector.hitTest(canvas, point.x, point.y).includes(hidden) };
      });
      assert.equal(hiddenHit.display, "block");
      assert.ok(hiddenHit.hit, "Show inactive did not include an inactive widget in geometric hit-testing");
      await page.locator("#ui-show-inactive").uncheck();
      const alphaZeroHit = await page.evaluate(() => {
        const canvas = document.querySelector(".ui-canvas"), button = document.querySelector('[data-ui-path="PetsCollection/Container/PetsLayout/Pet (1)/ShowDetailsPetButton"]');
        const rect = button.getBoundingClientRect(), point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        return { alpha: button.dataset.uiAlpha, hit: uiWidgetInspector.hitTest(canvas, point.x, point.y).includes(button) };
      });
      assert.equal(alphaZeroHit.alpha, "0");
      assert.ok(alphaZeroHit.hit, "Alpha-zero widget was omitted from geometric hit-testing");
      const clonePointAfter = await page.evaluate(() => {
        const clone = document.querySelector('[data-ui-clone-template-path="PetsCollection/Container/PetsLayout/Pet (1)"][data-ui-clone-index="1"]');
        const rect = clone.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await page.mouse.click(clonePointAfter.x, clonePointAfter.y, { button: "right" });
      await page.waitForSelector(".ui-inspector-dialog");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator(".ui-inspector-dialog").count(), 0, "Outside click did not close Inspector");
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
      results.push({ viewport, clicks, petsClicked, scroll: "unchanged before/after every mouse click", sample: measurements[0], alpha,
        inspector: { layers: inspectorOpen.layers, cloneIdentity: inspectorOpen.cloneIdentity, requiredFields: inspectorOpen.requiredFields,
          rightClickPrevented: inspectorOpen.rightClickPrevented, dialogWithinViewport: true, rowSelectionChanged, copyStatus,
          inactiveHit: hiddenHit.hit, alphaZeroHit: alphaZeroHit.hit, outsideContextDefaultPreserved: true, closeByEscapeAndOutsideClick: true },
        textRendering: { count: textRendering.count, clipApplied: textRendering.spans.every(span => span.overflowStyle === "hidden"),
          sourcePropertiesPresent: textRendering.spans.every(span => span.font && Number.isFinite(span.lineSpacing)),
          systemFontFamilies: [...new Set(textRendering.spans.map(span => span.fontFamily))],
          pivotOriginsMatch: textRendering.transformOrigins.every(item => item.expected === item.actual),
          aspectOptions: textRendering.aspectOptions, selectedAspect: textRendering.selectedAspect, stageAspect: textRendering.stageAspect, alternateAspect, radialFill: textRendering.radialFill },
        layoutPositions: Object.fromEntries(Object.entries(layoutPositions).map(([name, layout]) => [name, {
          size: layout.size, cell: layout.cell, gap: layout.gap, count: layout.positions.length,
          visibleCount: layout.positions.filter(point => point.visible).length, positions: layout.positions.slice(0, 16)
        }])) });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ browserAudit: results.map(({ measurements, ...summary }) => summary) }, null, 2));
  return { browser: "chromium", channel: process.env.UI_AUDIT_BROWSER || "msedge", results };
}
