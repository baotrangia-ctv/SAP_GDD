"use strict";

function prepareLockBaseScreen(screen) {
  const container = screen.tree.children.find(node => node.name === "Container");
  const title = container.children.find(node => node.name === "Title");
  const label = title.children.find(node => node.name === "Content");
  const results = container.children.find(node => node.name === "Results");
  results.transform.anchoredPosition.y = -258;
  const materials = container.children.find(node => node.name === "Materials");
  const material = materials.children[0].children[0];
  material.transform.anchoredPosition = { x: 0, y: 12 };
  const arrow = materials.children.find(node => node.name === "PlusIcon");
  arrow.transform.sizeDelta = { x: 106, y: 58 };
  arrow.transform.anchoredPosition.y = -93;
  const dust = container.children.find(node => node.name === "Dust");
  // The track has 6 units of inset at either end. Match the button group's outer edges.
  dust.transform.sizeDelta = { x: 84, y: 402 };
  dust.transform.anchoredPosition.y = 20;
  for (const control of dust.children) {
    if (control.name === "BG" || control.name === "DustPercent") continue;
    control.transform.anchoredPosition.x += 17;
  }
  const dustNote = dust.children.find(node => node.name === "Label");
  dustNote.transform.anchoredPosition = { x: 48, y: -228 };
  dustNote.text.fontSize = 24;
  dustNote.text.fontStyle.italic = false;
  const button = container.children.find(node => node.name === "FusionButton");
  button.transform.anchoredPosition.x = results.transform.anchoredPosition.x;
  button.transform.anchoredPosition.y = 52;
  button.transform.sizeDelta = { x: 310, y: 86 };
  button.button.spriteKey = dust.children.find(node => node.name === "MaxDustButton").button.spriteKey;
  const buttonText = button.children.find(node => node.name === "Text");
  buttonText.transform.sizeDelta.x = 190;
  buttonText.text.fontStyle.bold = true;
  buttonText.text.shadowColor = "#9A531A";
  const cost = button.children.find(node => node.name === "DustInfo");
  cost.transform.anchoredPosition = { x: 212, y: 0 };
  const timerLines = [
    ["LockRemainingLabel", 52, 26, "Time Remaining", "#275187"],
    ["LockRemaining", 0, 62, "00:00", "#12488A"],
    ["LockAdded", -50, 26, "", "#087052"]
  ];
  for (const [name, y, fontSize, value, color] of timerLines) {
    const node = structuredClone(label);
    Object.assign(node, { id: name, name, path: results.path + "/" + name });
    Object.assign(node.transform, {
      anchorMin: { x: .5, y: .5 }, anchorMax: { x: .5, y: .5 }, pivot: { x: .5, y: .5 },
      anchoredPosition: { x: 0, y }, sizeDelta: { x: 560, y: fontSize + 8 }
    });
    Object.assign(node.text, {
      key: "", value, fontSize, color, shadow: false,
      alignment: { h: "center", v: "middle" }
    });
    results.children.push(node);
  }
  const count = structuredClone(label);
  Object.assign(count, { id: "LockTokenCount", name: "LockTokenCount", path: material.path + "/LockTokenCount" });
  Object.assign(count.transform, {
    anchorMin: { x: .5, y: .5 }, anchorMax: { x: .5, y: .5 }, pivot: { x: .5, y: .5 },
    anchoredPosition: { x: 0, y: -46 }, sizeDelta: { x: 120, y: 36 }
  });
  Object.assign(count.text, {
    key: "", value: "", fontSize: 30, color: "#12488A", shadow: false,
    alignment: { h: "center", v: "middle" }
  });
  material.children.push(count);
  const thumbnail = material.children.find(node => node.name === "Thumbnail");
  thumbnail.transform.sizeDelta = { x: 82, y: 82 };
  thumbnail.transform.anchoredPosition.y = 17;
  screen.entityCount += timerLines.length + 1;
}

function initLockBasePreview(screen, rules, rendered) {
  const t = uiSourceTools(screen, rules, rendered);
  const source = "Lock Base · web preview";
  const secondsPerToken = 30;
  const tokenIcon = "./prototypes/lock-base/assets/base-lock/lock.png";
  let inventory = 24;
  let selected = 0;
  let expires = 0;
  const setText = (el, value) => t.text(el, value, source);
  const hide = el => t.visible(el, false, source);
  const icon = el => uiRenderer.setImage(el, tokenIcon, t.node(el)?.image);
  const format = seconds => [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, "0")).join(":");

  const title = t.find("Title");
  setText(t.child(title, "Content"), "BASE LOCK");
  hide(t.child(title, "CloseButton"));
  hide(t.find("DarkBG"));
  hide(t.find("ExchangeButton"));
  hide(t.find("Chances"));
  hide(t.key("MutationPercentsLayout"));
  for (const name of ["Materials", "Results"]) {
    t.find(name).querySelector(":scope > .ui-visual")?.remove();
  }
  const material = t.key("PetMaterial1");
  hide(t.key("PetMaterial2"));
  for (const el of material.children) {
    if (el.classList.contains("ui-entity") && !["Thumbnail", "LockTokenCount"].includes(el.dataset.uiName)) hide(el);
  }
  const slotIcon = t.child(material, "Thumbnail");
  const slotCount = t.child(material, "LockTokenCount");
  icon(slotIcon);
  hide(t.key("PetResultsLayout"));

  const wallet = t.find("Wallet");
  icon(t.child(wallet, "Icon"));
  const dust = t.find("Dust");
  const amount = t.key("DustAmount");
  icon(t.child(amount, "Icon"));
  const fill = t.key("DustPercent");
  for (const el of [t.child(dust, "BG"), fill]) fusionMissingVisual(t, el, t.node(el).image.color);
  setText(t.child(dust, "Label"), `1 Lock Token = ${secondsPerToken}s`);
  setText(t.child(t.find("MaxDustButton"), "Text"), "Max");
  setText(t.child(t.find("MinDustButton"), "Text"), "Reset");

  const confirm = t.find("FusionButton");
  setText(t.child(confirm, "Text"), "Use Tokens");
  confirm.setAttribute("aria-label", "Use Tokens");
  t.find("IncDustButton").setAttribute("aria-label", "Add one Lock Token");
  t.find("DecDustButton").setAttribute("aria-label", "Remove one Lock Token");
  t.find("MaxDustButton").setAttribute("aria-label", "Select all Lock Tokens");
  t.find("MinDustButton").setAttribute("aria-label", "Reset Lock Token selection");
  hide(t.child(confirm, "MoneyInfo"));
  const cost = t.child(confirm, "DustInfo");
  icon(t.child(cost, "DustIcon"));
  const remainingLabel = t.find("LockRemaining");

  function updateTimer() {
    const remainingSeconds = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
    const loaded = Math.ceil(remainingSeconds / secondsPerToken);
    const count = loaded || selected;
    setText(remainingLabel, format(remainingSeconds));
    t.visible(slotIcon, count > 0, source);
    t.visible(slotCount, count > 0, source);
    setText(slotCount, count ? `×${count}` : "");
  }

  function updateBurn() {
    const remaining = expires - Date.now();
    const duration = secondsPerToken * 1000;
    const burning = remaining > 0;
    material.classList.toggle("lock-token-burning", burning);
    if (burning) {
      const fuel = (remaining % duration || duration) / duration;
      material.style.setProperty("--lock-token-burn-inset", `${(1 - fuel) * 100}%`);
    }
  }

  function render() {
    setText(t.key("DustBalance"), inventory);
    setText(amount, selected + " / " + inventory);
    setText(t.key("CostDustAmount"), selected);
    setText(t.find("LockAdded"), selected ? "+" + format(selected * secondsPerToken) : "");
    uiRenderer.setFillAmount(fill, inventory ? selected / inventory : 0, t.node(fill).image);
    confirm.disabled = selected === 0;
    t.find("IncDustButton").disabled = selected === inventory;
    t.find("MaxDustButton").disabled = selected === inventory;
    t.find("DecDustButton").disabled = selected === 0;
    t.find("MinDustButton").disabled = selected === 0;
    updateTimer();
  }

  rendered.canvas.addEventListener("click", event => {
    const name = event.target.closest("button")?.dataset.uiName;
    if (name === "IncDustButton") selected = Math.min(inventory, selected + 1);
    else if (name === "DecDustButton") selected = Math.max(0, selected - 1);
    else if (name === "MaxDustButton") selected = inventory;
    else if (name === "MinDustButton") selected = 0;
    else if (name === "FusionButton" && selected > 0) {
      expires = Math.max(Date.now(), expires) + selected * secondsPerToken * 1000;
      inventory -= selected;
      selected = 0;
    } else return;
    render();
    updateBurn();
  });
  render();
  const timer = setInterval(updateTimer, 1000);
  const burnTimer = setInterval(updateBurn, 100);
  return { dispose() { clearInterval(timer); clearInterval(burnTimer); } };
}
