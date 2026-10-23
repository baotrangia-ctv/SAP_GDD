"use strict";

(() => {
  let overlay = null;
  let selectedElement = null;
  let hitRows = [];
  let canvasRoot = null;

  function sourceIndex() {
    const byPath = new Map();
    const root = s.page === 'uiproposal' && typeof uiProposal !== 'undefined' && canvasRoot?.dataset.proposalLayer === 'current' ? uiProposal.base?.tree : uiPreview.screen?.tree;
    if (!root) return byPath;
    (function walk(node) { byPath.set(node.path, node); node.children.forEach(walk); })(root);
    return byPath;
  }
  function sourceNode(element) {
    if (s.page === 'uiproposal' && typeof uiProposal !== 'undefined') {
      const root = canvasRoot?.dataset.proposalLayer === 'current' ? uiProposal.base?.tree : uiProposal.proposed?.tree;
      const id = element.dataset.uiId || element.dataset.uiSourceEntityId;
      let found = null;
      if (root) (function walk(node) { if (node.id === id) found = node; node.children.forEach(walk); })(root);
      if (found) return found;
    }
    const path = element.dataset.uiPath || element.dataset.uiClonePath;
    return sourceIndex().get(path) || null;
  }
  function runtimeValues(element) {
    try { return JSON.parse(element.dataset.uiRuntimeValues || "{}"); } catch { return {}; }
  }
  function sourceFilePath(value) {
    if (!value || typeof value !== "object") return "";
    if (typeof value.filePath === "string") return value.filePath;
    for (const child of Object.values(value)) {
      const found = sourceFilePath(child);
      if (found) return found;
    }
    return "";
  }
  function visibleForInspector(element) {
    return !element.classList.contains("ui-inactive") && getComputedStyle(element).display !== "none" && !element.closest(".ui-closed");
  }
  function renderedInPreview(element) {
    return getComputedStyle(element).display !== "none" && !element.closest(".ui-closed");
  }
  function paintCompare(a, b) {
    const za = Number.parseInt(getComputedStyle(a).zIndex, 10) || 0;
    const zb = Number.parseInt(getComputedStyle(b).zIndex, 10) || 0;
    if (za !== zb) return zb - za;
    const relation = a.compareDocumentPosition(b);
    return relation & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : relation & Node.DOCUMENT_POSITION_PRECEDING ? -1 : 0;
  }
  function hitTest(canvas, x, y) {
    const showInactive = canvas.classList.contains("ui-show-inactive");
    return [...canvas.querySelectorAll(".ui-entity")].filter(element => {
      if (!showInactive && !visibleForInspector(element)) return false;
      if (element.closest(".ui-closed")) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }).sort(paintCompare);
  }
  function parentLayout(element) {
    let layoutChild = element;
    for (let parent = element.parentElement; parent; layoutChild = parent, parent = parent.parentElement) {
      if (parent.dataset.uiType === "UILayoutEntityV2") {
        const siblings = [...parent.children].filter(child => child.classList.contains("ui-entity"));
        return { element: parent, index: siblings.indexOf(layoutChild) + 1, count: siblings.length };
      }
    }
    return null;
  }
  function runtimeSnapshot(element, node) {
    const values = runtimeValues(element);
    const span = element.querySelector(":scope > .ui-text");
    const sourceImage = node?.image || node?.button || {};
    const spriteKey = element.dataset.uiRuntimeSpriteKey || element.dataset.uiSpriteKey || sourceImage.spriteKey || "";
    const sprite = uiPreview.manifest?.sprites?.find(item => item.key === spriteKey);
    const visual = element.querySelector(":scope > .ui-visual > .ui-sprite");
    const rawSize = element.dataset.uiRuntimeSize ? JSON.parse(element.dataset.uiRuntimeSize) : null;
    if (rawSize && !values.Size) values.Size = { value: rawSize, source: element.dataset.uiRuntimeSizeSource || "dist/app-ui-renderer.js" };
    if (!values.IsVisible) values.IsVisible = { value: visibleForInspector(element), source: "DOM visibility in preview" };
    if (!values.Alpha) values.Alpha = { value: element.dataset.uiAlpha, source: "PetsCollection.ui" };
    if (spriteKey && !values.SpriteName && element.dataset.uiRuntimeSpriteKey) values.SpriteName = { value: spriteKey, source: "dist/app-ui-collection.js (preview simulation)" };
    if (element.dataset.uiRuntimeColor && !values.Color) values.Color = { value: element.dataset.uiRuntimeColor, source: "dist/app-ui-collection.js (preview simulation)" };
    if (element.dataset.uiRuntimeContent != null && !values.Content) values.Content = { value: element.dataset.uiRuntimeContent, source: "dist/app-ui-collection.js (preview simulation)" };
    const currentRect = element.getBoundingClientRect();
    const canvasRect = canvasRoot.getBoundingClientRect();
    const scale = canvasRoot.offsetWidth ? canvasRect.width / canvasRoot.offsetWidth : 1;
    const localRect = { left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height };
    const frameRect = {
      left: Number(((currentRect.left - canvasRect.left) / scale).toFixed(2)),
      top: Number(((currentRect.top - canvasRect.top) / scale).toFixed(2)),
      width: Number((currentRect.width / scale).toFixed(2)),
      height: Number((currentRect.height / scale).toFixed(2)),
      note: `getBoundingClientRect AABB in the ${uiPreview.width}×${uiPreview.height} reference canvas; includes CSS scale/rotation`
    };
    const layout = parentLayout(element);
    const parentNodePath = node?.path?.split("/").slice(0, -1).join("/") || "";
    const parentNode = sourceIndex().get(parentNodePath);
    const rawFile = sourceFilePath(node?.propsData?.image || node?.propsData?.button || {});
    const entry = sprite || uiPreview.manifest?.sprites?.find(item => item.key === sourceImage.spriteKey);
    const fillNames = { 0: "Simple", 1: "Sliced / 9-grid", 2: "Tiled", 3: "Filled", 5: "Fit" };
    const properties = node?.propsData || {};
    const runtimeAssignments = uiPreview.rules?.runtimeAssignments || [];
    const usedProperties = new Set(Object.keys(values));
    const sourceAssignments = runtimeAssignments.filter(item => usedProperties.has(item.property));
    let effectiveOpacity = 1;
    for (let current = element; current?.classList.contains("ui-entity"); current = current.parentElement) effectiveOpacity *= Number(getComputedStyle(current).opacity);
    return {
      identity: {
        name: node?.name || element.dataset.uiName,
        path: node?.path || element.dataset.uiPath || element.dataset.uiClonePath,
        entityId: node?.id || element.dataset.uiSourceEntityId || element.dataset.uiId || "",
        widgetType: node?.type || element.dataset.uiType,
        clone: element.dataset.uiCloneTemplatePath ? { templatePath: element.dataset.uiCloneTemplatePath, index: Number(element.dataset.uiCloneIndex), key: element.dataset.uiEntityKey } : null,
        activeInUi: node?.active ?? element.dataset.uiBaseActive === "true",
        runtimeVisible: visibleForInspector(element),
        currentlyRenderedInPreview: renderedInPreview(element)
      },
      transform: {
        anchorMin: node?.transform?.anchorMin, anchorMax: node?.transform?.anchorMax, pivot: node?.transform?.pivot,
        anchoredPosition: node?.transform?.anchoredPosition, sizeDelta: node?.transform?.sizeDelta, rotate: node?.transform?.rotate,
        rectInReferencePx: frameRect, rectInParent: localRect,
        parent: parentNode ? { name: parentNode.name, path: parentNode.path } : null
      },
      rendering: {
        alpha: node?.alpha ?? Number(element.dataset.uiAlpha), webEffectiveOpacity: Number(effectiveOpacity.toFixed(4)),
        priority: node?.priority ?? Number(element.dataset.uiPriority || 0),
        webDomPaintOrder: [...canvasRoot.querySelectorAll(".ui-entity")].indexOf(element),
        webCssZIndex: getComputedStyle(element).zIndex,
        parentLayout: layout ? { name: layout.element.dataset.uiName, path: layout.element.dataset.uiPath || layout.element.dataset.uiClonePath, index: layout.index, childCount: layout.count } : null
      },
      properties: {
        propsData: properties,
        ecaProps: node?.ecaProps || {},
        rendererUnsupportedFields: (uiPreview.manifest?.unsupported || []).find(item => item.id === node?.id || item.path === node?.path)?.fields || []
      },
      runtime: {
        values,
        renderedText: span?.textContent ?? null,
        sprite: spriteKey ? {
          name: spriteKey.split("/").at(-1), key: spriteKey, file: rawFile || entry?.origins?.[0] || "",
          currentUrl: element.dataset.uiRuntimeUrl || entry?.output || "",
          size: { width: visual?.naturalWidth || entry?.width || null, height: visual?.naturalHeight || entry?.height || null },
          nineGridBorder: entry?.border || properties.image?.slicedBorder || properties.image?.tiledBorder || null,
          imageMode: fillNames[sourceImage.fillType] || `Unknown (${sourceImage.fillType ?? "unset"})`
        } : null,
        hudCollectionAssignmentsForTheseProperties: sourceAssignments
      }
    };
  }
  function jsonText(value) {
    try { return JSON.stringify(value, null, 2); } catch (error) { return `Không thể tạo JSON: ${error.message}`; }
  }
  function addDefinitionList(parent, rows) {
    const list = document.createElement("dl");
    for (const [label, value] of rows) {
      const term = document.createElement("dt"); term.textContent = label;
      const description = document.createElement("dd"); description.textContent = value == null || value === "" ? "—" : (typeof value === "string" ? value : jsonText(value));
      list.append(term, description);
    }
    parent.append(list);
  }
  function addJsonDetails(parent, title, value) {
    const details = document.createElement("details");
    const summary = document.createElement("summary"); summary.textContent = title;
    const pre = document.createElement("pre"); pre.textContent = jsonText(value);
    details.append(summary, pre); parent.append(details);
  }
  function clearSelectedOutline() { selectedElement?.classList.remove("ui-inspector-selected"); selectedElement = null; }
  function closeInspector() {
    clearSelectedOutline();
    overlay?.remove();
    overlay = null;
    hitRows = [];
    canvasRoot = null;
  }
  function renderSelection(element) {
    clearSelectedOutline();
    selectedElement = element;
    element.classList.add("ui-inspector-selected");
    const node = sourceNode(element);
    const payload = runtimeSnapshot(element, node);
    const content = overlay.querySelector(".ui-inspector-content");
    content.replaceChildren();

    const layers = document.createElement("section");
    const layerHeading = document.createElement("h3"); layerHeading.textContent = `Điểm chồng lấn · ${hitRows.length} widget · trên cùng trước`;
    layers.append(layerHeading);
    const choices = document.createElement("div"); choices.className = "ui-inspector-layers";
    hitRows.forEach((hit, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "ui-inspector-layer-choice";
      const hitNode = sourceNode(hit);
      button.textContent = `${index + 1}. ${hitNode?.name || hit.dataset.uiName} · ${hitNode?.type || hit.dataset.uiType}${visibleForInspector(hit) ? " · hiện" : " · inactive"}`;
      button.classList.toggle("selected", hit === element);
      button.addEventListener("click", event => { event.stopPropagation(); renderSelection(hit); });
      choices.append(button);
    });
    layers.append(choices); content.append(layers);

    const identity = document.createElement("section");
    const identityHeading = document.createElement("h3"); identityHeading.textContent = "Định danh"; identity.append(identityHeading);
    addDefinitionList(identity, [
      ["Tên / path", `${payload.identity.name} · ${payload.identity.path}`],
      ["_entityId", payload.identity.entityId], ["Widget type", payload.identity.widgetType],
      ["Clone", payload.identity.clone || "Không phải clone"],
      ["Active .ui / runtime visible / đang vẽ trong preview", `${payload.identity.activeInUi} / ${payload.identity.runtimeVisible} / ${payload.identity.currentlyRenderedInPreview}`]
    ]);
    content.append(identity);

    if (s.page === 'uiproposal' && typeof uiProposal !== 'undefined') {
      const section = document.createElement('section'); section.className = 'ui-inspector-proposal';
      const heading = document.createElement('h3'); heading.textContent = 'Thay đổi của đề xuất'; section.append(heading);
      const id = node?.id || element.dataset.uiSourceEntityId;
      const changes = uiProposal.diff.operations.filter(op => op.id === id || op.affectedIds.includes(id));
      payload.proposalChanges = changes;
      if (changes.length) addDefinitionList(section, changes.map(op => [`${op.index}. ${op.op} · ${op.field}`, `${jsonText(op.before)} → ${jsonText(op.after)}\nReason: ${op.reason}`]));
      else { const note = document.createElement('p'); note.textContent = 'Giữ nguyên; không có thao tác áp lên entity này.'; section.append(note); }
      const rawNote = document.createElement('p'); rawNote.textContent = 'propsData bên dưới giữ nguồn gốc trước patch; field chuẩn hóa và diff ở trên mô tả đề xuất.'; section.append(rawNote);
      content.append(section);
    }

    const transform = document.createElement("section");
    const transformHeading = document.createElement("h3"); transformHeading.textContent = "Transform"; transform.append(transformHeading);
    addDefinitionList(transform, [
      ["Anchor min / max", { min: payload.transform.anchorMin, max: payload.transform.anchorMax }],
      ["Pivot / anchoredPosition", { pivot: payload.transform.pivot, anchoredPosition: payload.transform.anchoredPosition }],
      ["SizeDelta / rotate", { sizeDelta: payload.transform.sizeDelta, rotate: payload.transform.rotate }],
      ["RectTransform (px, khung tham chiếu)", payload.transform.rectInReferencePx],
      ["Rect (trong parent)", payload.transform.rectInParent], ["Parent", payload.transform.parent || "—"]
    ]);
    content.append(transform);

    const rendering = document.createElement("section");
    const renderingHeading = document.createElement("h3"); renderingHeading.textContent = "Alpha, priority và layout"; rendering.append(renderingHeading);
    addDefinitionList(rendering, [
      ["Alpha .ui / opacity web hiệu dụng", `${payload.rendering.alpha} / ${payload.rendering.webEffectiveOpacity}`],
      ["Priority / z-order web", `${payload.rendering.priority} / DOM paint index ${payload.rendering.webDomPaintOrder}, CSS z-index ${payload.rendering.webCssZIndex}`],
      ["Layout cha / index", payload.rendering.parentLayout || "Không nằm trong layout"]
    ]);
    const stackingNote = document.createElement("p"); stackingNote.className = "ui-inspector-note"; stackingNote.textContent = "Z-order trên đây là thứ tự vẽ của web preview; cách Craftland xử lý priority/depth chưa được xác minh."; rendering.append(stackingNote);
    content.append(rendering);

    const runtime = document.createElement("section");
    const runtimeHeading = document.createElement("h3"); runtimeHeading.textContent = "Giá trị runtime trong preview"; runtime.append(runtimeHeading);
    addDefinitionList(runtime, [
      ["Content hiện tại", payload.runtime.renderedText], ["Runtime values và nguồn", payload.runtime.values],
      ["Sprite / file / kích thước / border / mode", payload.runtime.sprite]
    ]);
    const sourceHeading = document.createElement("h4"); sourceHeading.textContent = "Các assignment HudCollection.fcg cùng property"; runtime.append(sourceHeading);
    if (payload.runtime.hudCollectionAssignmentsForTheseProperties.length) {
      const assignments = document.createElement("div"); assignments.className = "ui-inspector-assignments";
      for (const item of payload.runtime.hudCollectionAssignmentsForTheseProperties.slice(0, 18)) {
        const row = document.createElement("p"); row.textContent = `${item.property} · ${item.target} = ${item.expression} · ${item.source}`; assignments.append(row);
      }
      runtime.append(assignments);
      if (payload.runtime.hudCollectionAssignmentsForTheseProperties.length > 18) {
        const note = document.createElement("p"); note.className = "ui-inspector-note"; note.textContent = `Hiển thị 18 / ${payload.runtime.hudCollectionAssignmentsForTheseProperties.length}; target là alias từ FCG, không khẳng định alias này trỏ đúng entity đang chọn.`; runtime.append(note);
      }
    } else {
      const note = document.createElement("p"); note.className = "ui-inspector-note"; note.textContent = "Không có assignment FCG cùng property để đối chiếu."; runtime.append(note);
    }
    content.append(runtime);

    const raw = document.createElement("section");
    const rawHeading = document.createElement("h3"); rawHeading.textContent = "Thuộc tính gốc từ .ui"; raw.append(rawHeading);
    addJsonDetails(raw, `propsData đầy đủ (${Object.keys(payload.properties.propsData).length} trường cấp cao nhất)`, payload.properties.propsData);
    addJsonDetails(raw, "ecaProps", payload.properties.ecaProps);
    addJsonDetails(raw, `Trường renderer chưa hỗ trợ (${payload.properties.rendererUnsupportedFields.length})`, payload.properties.rendererUnsupportedFields);
    content.append(raw);

    const copy = overlay.querySelector(".ui-inspector-copy-status");
    copy.textContent = "";
    overlay.querySelector(".ui-inspector-copy").onclick = async event => {
      event.stopPropagation();
      const json = jsonText(payload);
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(json);
        else {
          const textarea = document.createElement("textarea"); textarea.value = json; textarea.style.position = "fixed"; textarea.style.opacity = "0";
          document.body.append(textarea);
          try { textarea.select(); if (!document.execCommand("copy")) throw new Error("Clipboard API недоступен"); }
          finally { textarea.remove(); }
        }
        copy.textContent = "JSON đã sao chép";
      } catch (error) { copy.textContent = `Không sao chép được: ${error.message}`; }
    };
  }
  function openInspector(canvas, x, y) {
    closeInspector();
    canvasRoot = canvas;
    hitRows = hitTest(canvas, x, y);
    overlay = document.createElement("div"); overlay.className = "ui-inspector-overlay";
    const dialog = document.createElement("div"); dialog.className = "ui-inspector-dialog"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", "Widget Inspector");
    const header = document.createElement("header");
    const title = document.createElement("div"); title.className = "ui-inspector-title"; title.textContent = "Widget Inspector";
    const close = document.createElement("button"); close.type = "button"; close.className = "ui-inspector-close"; close.textContent = "Đóng"; close.addEventListener("click", closeInspector);
    header.append(title, close);
    const content = document.createElement("div"); content.className = "ui-inspector-content";
    const footer = document.createElement("footer");
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "ui-inspector-copy"; copy.textContent = "Sao chép JSON";
    copy.disabled = hitRows.length === 0;
    const status = document.createElement("span"); status.className = "ui-inspector-copy-status";
    footer.append(copy, status);
    dialog.append(header, content, footer); overlay.append(dialog); document.body.append(overlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeInspector(); else event.stopPropagation(); });
    if (hitRows.length) renderSelection(hitRows[0]);
    else {
      const message = document.createElement("p"); message.className = "ui-inspector-note"; message.textContent = "ตรงจุดนี้ไม่มี widget อยู่ใน hit box ของ preview"; content.append(message);
    }
    const width = dialog.getBoundingClientRect().width, height = dialog.getBoundingClientRect().height;
    dialog.style.left = `${Math.max(12, Math.min(x - width / 2, window.innerWidth - width - 12))}px`;
    dialog.style.top = `${Math.max(12, Math.min(y - 24, window.innerHeight - height - 12))}px`;
  }

  document.addEventListener("contextmenu", event => {
    const canvas = event.target.closest?.(".ui-canvas");
    if (!canvas) return;
    event.preventDefault();
    openInspector(canvas, event.clientX, event.clientY);
  });
  document.addEventListener('click', event => {
    if (s.page !== 'uiproposal' || !document.getElementById('ui-proposal-inspect')?.checked) return;
    const canvas = event.target.closest?.('.ui-canvas');
    if (!canvas) return;
    event.preventDefault(); event.stopImmediatePropagation();
    openInspector(canvas, event.clientX, event.clientY);
  }, true);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && overlay) { event.preventDefault(); closeInspector(); } });
  window.uiWidgetInspector = { openInspector, closeInspector, hitTest, runtimeSnapshot };
})();
