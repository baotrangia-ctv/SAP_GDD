"use strict";

Object.assign(pages, { mutagen: "Mutagen", weatherdrop: "Weather Drop", luckybox: "Lucky Box" });

if (s.mutagenTarget === undefined) s.mutagenTarget = "COMMON";
if (s.mutagenSecret === undefined) s.mutagenSecret = false;
if (!s.mutagenLevel) s.mutagenLevel = 1;
if (s.weatherTarget === undefined) s.weatherTarget = "COMMON";
if (s.weatherSecret === undefined) s.weatherSecret = false;
if (!s.luckyBoxId) s.luckyBoxId = "60001";
if (!s.luckyBoxSearch) s.luckyBoxSearch = "";
if (!s.luckyBoxRarity) s.luckyBoxRarity = "all";

const systemRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "APEX", "LIMITED"];
const systemTierRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "APEX", "LIMITED"];
const systemPetRow = id => t("Pet.csv").rows.find(row => row.ID === String(id));
const systemEffectRow = id => t("weatherEffects.csv").rows.find(row => row.ID === String(id));
const systemMutationRow = id => t("mutation.csv").rows.find(row => row.ID === String(id));
const systemPct = value => {
  const percent = Number(value) * 100;
  const digits = percent === 0 ? 0 : percent >= 1 ? 2 : percent >= 0.1 ? 3 : percent >= 0.01 ? 4 : 6;
  return percent.toLocaleString("vi-VN", { maximumFractionDigits: digits }) + "%";
};
const systemNum = value => Number(value || 0).toLocaleString("en-US");
const systemOptions = (values, selected) => values.map(value => '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? " selected" : "") + '>' + esc(pretty(value)) + "</option>").join("");
const systemColor = rarityName => colors[rarityName] || "#82e0ba";
const systemIcon = (icons, id, fallback) => icons?.[String(id)]
  ? '<img class="system-icon" src="' + esc(icons[String(id)]) + '" alt="" aria-hidden="true" loading="lazy">'
  : '<span class="system-icon-fallback" aria-hidden="true">' + fallback + '</span>';

function systemChance(basePercent, rules, petRarity, isSecret) {
  const factors = rules?.rarityMultiplier || {};
  const raw = Number(basePercent) / 100 * (Number(factors[petRarity]) || 1) * (isSecret ? Number(rules?.secretMultiplier) || 1 : 1);
  return Math.min(Number(rules?.max) || 0.75, Math.max(Number(rules?.min) || 0.02, raw));
}

function systemControls(label, id, options, selected) {
  return '<label class="system-control"><span>' + esc(label) + '</span><select id="' + esc(id) + '">' + systemOptions(options, selected) + "</select></label>";
}
