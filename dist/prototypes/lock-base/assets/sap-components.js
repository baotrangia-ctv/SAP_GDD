(() => {
  "use strict";
  const dist = new URL("../../", document.baseURI);
  async function read(path) {
    const response = await fetch(new URL("data/ui/" + path + ".json", dist));
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  async function applyComponents() {
    const [frame, title, info, item, claim, collection, activities] = await Promise.all([
      ...["popup-frame", "title-bar", "info-row", "item-cell", "activities-claim-button"]
        .map(id => read("components/" + id)),
      read("collection-sprites"),
      read("activities-sprites")
    ]);
    const skins = [
      ["frame", frame.tree.image.spriteKey, collection],
      ["title", title.tree.image.spriteKey, collection],
      ["info", info.tree.image.spriteKey, collection],
      ["item", item.tree.image.spriteKey, collection],
      ["primary", claim.states[0].overrides.find(field => field.field === "button.spriteKey").value, activities],
      ["secondary", claim.states[1].overrides.find(field => field.field === "button.spriteKey").value, activities]
    ];
    const style = document.getElementById("tab-base-lock").style;
    const titleLabel = title.tree.children.find(node => node.text).text;
    const infoLabel = info.tree.children.find(node => node.text).text;
    const claimLabel = claim.tree.children.find(node => node.text).text;
    style.setProperty("--sap-title-color", titleLabel.color);
    style.setProperty("--sap-title-align", titleLabel.alignment.h);
    style.setProperty("--sap-title-shadow", titleLabel.shadowColor);
    style.setProperty("--sap-info-color", infoLabel.color);
    style.setProperty("--sap-claim-color", claimLabel.color);
    style.setProperty("--sap-claim-shadow", claimLabel.shadowColor);
    const inactiveTint = claim.states[1].overrides.find(field => field.field === "button.normal").value;
    style.setProperty("--sap-claim-inactive-brightness", parseInt(inactiveTint.slice(1, 3), 16) / 255);
    for (const [name, key, manifest] of skins) {
      const sprite = manifest.sprites.find(entry => entry.key === key && !entry.missing);
      if (!sprite?.output || !sprite.border) throw new Error("Missing sprite: " + key);
      const { top, right, bottom, left } = sprite.border;
      style.setProperty("--sap-" + name + "-image", 'url("' + new URL(sprite.output, dist).href + '")');
      style.setProperty("--sap-" + name + "-slice", [top, right, bottom, left].join(" "));
    }
  }

  applyComponents().catch(error => console.error("Lock Base components", error));
})();
