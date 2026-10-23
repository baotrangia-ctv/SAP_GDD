"use strict";

let rewardDisplayData = null;
let rewardDisplayLoading = null;
let rewardDisplayById = null;
const rewardTypeNames = {
  "1": "Pet",
  "2": "Tiền",
  "3": "Pet Coin",
  "4": "Pet ngẫu nhiên",
  "5": "MoneyTime",
  "6": "Pool pet bí mật",
  "7": "Dust",
  "9": "Lượt Lucky Spin",
  "10": "MutaGen",
  "16": "WeatherGen",
  "17": "Duplicate Ticket"
};
const gameSpriteImageFiles = {
  randompet: "RandomPet.png",
  randomitem: "RandomItem.png",
  moneyicon: "MoneyIcon.png",
  petcoinicon: "PetCoinIcon.png",
  dusticon: "DustIcon.png",
  spinicon: "SpinIcon.png",
  duplicateticket: "DuplicateTicket.png",
  summoncommon: "Summon-COMMON.png",
  summonrare: "Summon-RARE.png",
  summonepic: "Summon-EPIC.png",
  summonlegendary: "Summon-LEGENDARY.png",
  summonmythic: "Summon-MYTHIC.png",
  summonapex: "Summon-APEX.png",
  summonrainy: "SummonRainy.png",
  summonsnowy: "SummonSnowy.png",
  summonwindy: "SummonWindy.png"
};

async function loadRewardDisplayData() {
  if (rewardDisplayData) return rewardDisplayData;
  if (!rewardDisplayLoading) {
    rewardDisplayLoading = Promise.all([
      fetch("./data/gift-rewards.json"),
      fetch("./data/tables/rewards.json")
    ]).then(async ([giftResponse, rewardResponse]) => {
      if (!giftResponse.ok) throw new Error("gift-rewards.json · HTTP " + giftResponse.status);
      if (!rewardResponse.ok) throw new Error("rewards.json · HTTP " + rewardResponse.status);
      const [giftData, rewardTable] = await Promise.all([giftResponse.json(), rewardResponse.json()]);
      rewardDisplayData = { ...giftData, rewards: rewardTable.rows || [] };
      rewardDisplayById = new Map(rewardDisplayData.rewards.map(row => [String(row.ID), row]));
      return rewardDisplayData;
    }).finally(() => { rewardDisplayLoading = null; });
  }
  return rewardDisplayLoading;
}

function rewardTypeName(type) {
  return rewardTypeNames[String(type)] || ("Type " + String(type ?? "—"));
}

function giftLink(giftId) {
  return rewardDisplayData?.giftLinks?.find(link => String(link.giftId) === String(giftId));
}

function giftRewardRows(giftId) {
  const link = giftLink(giftId);
  return (link?.rewardIds || []).map(id => rewardDisplayById?.get(String(id)) || { ID: String(id), missing: true });
}

function giftRewardTypeIds(giftId) {
  return [...new Set(giftRewardRows(giftId).filter(row => !row.missing).map(row => String(row.TypeReward)))];
}

function rewardValueTimesQuantity(value, quantity) {
  const amount = Number(value), count = Number(quantity);
  if (!Number.isFinite(amount)) return String(value || "—");
  return (amount * (Number.isFinite(count) && count > 0 ? count : 1)).toLocaleString("en-US");
}

function rewardAmountLabel(row) {
  const [first = "", second = ""] = String(row.Value ?? "").split(";");
  const quantity = String(row.Quantity ?? "").trim();
  const type = String(row.TypeReward ?? "");
  if (type === "1") return "×" + (quantity || "1") + " pet";
  if (type === "2") return decodeMoneyRankValue(first);
  if (type === "3") return "×" + rewardValueTimesQuantity(first, quantity) + " Pet Coin";
  if (type === "4") return "×" + (quantity || "1") + " pet ngẫu nhiên";
  if (type === "5") return (first || "—") + " giờ thu nhập";
  if (type === "6") return "×" + (quantity || "1") + " lượt pool";
  if (type === "7") return "×" + rewardValueTimesQuantity(first, quantity) + " Dust";
  if (type === "9") return "×" + (first || "—") + " lượt spin";
  if (type === "10") return "×" + (second || quantity || "1") + " MutaGen";
  if (type === "16") return "×" + (quantity || "1") + " WeatherGen";
  if (type === "17") return "×" + (first || "—") + " vé";
  return "Giá trị " + (row.Value || "—");
}

function decodeMoneyRankValue(raw) {
  if (String(raw ?? "").trim() === "") return "Tiền · chưa có giá trị";
  const rankValue = Number(raw);
  if (!Number.isFinite(rankValue) || rankValue < 0) return "Tiền · " + (raw || "chưa có giá trị");
  const rank = Math.floor(rankValue / 10000);
  const amount = (rankValue % 10000) / 10;
  const suffixes = ["", "", "k", "m", "B", "T", "Q", "Qi", "Sx", "Sp", "Oc", "No", "De", "Ud", "Dd", "Td", "Qad", "Qid", "Sxd", "Spd", "Ocd", "Nod", "Vg", "Uvg", "Dvg", "Tvg", "Qavg", "Qivg", "Sxvg", "Spvg", "Ocvg", "Novg"];
  const suffix = suffixes[rank];
  if (suffix === undefined) return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " · rank " + rank;
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + (suffix ? " " + suffix : "");
}

function gameSpriteIconHtml(spriteName, label) {
  const key = String(spriteName || "").trim();
  const normalized = key.toLowerCase();
  const imageFile = gameSpriteImageFiles[normalized];
  if (imageFile) return '<img class="game-sprite-icon game-sprite-icon-image" src="./assets/game-sprites/' + esc(imageFile) + '" alt="' + esc(label || key || "Item") + '" loading="lazy">';
  const rarityKey = key.match(/^Summon(.+)$/i)?.[1]?.toUpperCase() || "";
  const rarityColor = colors[rarityKey] || "#83daba";
  let art = "";
  if (normalized === "randompet") {
    art = '<circle cx="48" cy="48" r="36" fill="#24364c"/><path d="M25 43 31 23l15 12 15-12 7 20c8 5 11 13 8 22-3 10-14 16-28 16S23 75 20 65c-3-9-1-17 5-22Z" fill="#8fe0c2"/><circle cx="38" cy="54" r="3.5" fill="#183041"/><circle cx="58" cy="54" r="3.5" fill="#183041"/><path d="M42 66q6 5 12 0M70 25l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" fill="#f2d783"/>';
  } else if (normalized === "randomitem") {
    art = '<path d="M18 36 48 21l30 15v37L48 88 18 73z" fill="#25384e" stroke="#83daba" stroke-width="4"/><path d="m18 36 30 16 30-16M48 52v36M39 22h18v16H39z" fill="#f0c967" stroke="#ffe19a" stroke-width="3"/><path d="M48 59c-7 0-8 10-1 12v6h6v-6c7-3 5-12-5-12Z" fill="#f7f2d5"/>';
  } else if (normalized === "moneyicon") {
    art = '<circle cx="48" cy="48" r="34" fill="#c28b2d"/><circle cx="48" cy="48" r="27" fill="#f0ca65" stroke="#ffe7a0" stroke-width="3"/><path d="M56 34c-3-4-16-5-18 3-3 10 20 6 19 17-1 9-14 11-22 5m12-32v42" fill="none" stroke="#78521b" stroke-width="5" stroke-linecap="round"/>';
  } else if (normalized === "petcoinicon") {
    art = '<circle cx="48" cy="48" r="34" fill="#1c7777"/><circle cx="48" cy="48" r="27" fill="#65d5c3" stroke="#a3f3df" stroke-width="3"/><ellipse cx="48" cy="59" rx="13" ry="10" fill="#165b63"/><ellipse cx="32" cy="42" rx="6" ry="8" transform="rotate(-22 32 42)" fill="#165b63"/><ellipse cx="45" cy="34" rx="6" ry="8" transform="rotate(-7 45 34)" fill="#165b63"/><ellipse cx="59" cy="35" rx="6" ry="8" transform="rotate(14 59 35)" fill="#165b63"/><ellipse cx="68" cy="45" rx="6" ry="8" transform="rotate(28 68 45)" fill="#165b63"/>';
  } else if (normalized === "dusticon") {
    art = '<path d="m48 12 9 23 24-7-12 22 16 17-25-2-12 22-8-24-25 1 16-18-12-22 24 8z" fill="#7ed9d5" stroke="#b4f5ec" stroke-width="4"/><circle cx="48" cy="51" r="8" fill="#e8ffff"/>';
  } else if (normalized === "spinicon") {
    art = '<circle cx="48" cy="49" r="34" fill="#2f3155" stroke="#a799ff" stroke-width="4"/><path d="M48 16v33l28-17M48 49l30 1M48 49l20 26M48 49l-7 33M48 49 20 68M48 49 14 42M48 49 25 21" fill="none" stroke="#d8d2ff" stroke-width="4"/><circle cx="48" cy="49" r="8" fill="#ffe089"/><path d="m48 5 7 14H41z" fill="#ffe089"/>';
  } else if (normalized === "duplicateticket") {
    art = '<path d="M21 28h54v13a8 8 0 0 0 0 14v13H21V55a8 8 0 0 0 0-14z" fill="#f0cb70" stroke="#fff0b5" stroke-width="4"/><path d="M48 31v7m0 7v7m0 7v7" stroke="#a7792d" stroke-width="3" stroke-linecap="round"/><path d="m42 44 7 8 8-12" fill="none" stroke="#79551e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
  } else if (normalized === "risespeed") {
    art = '<path d="M20 70h22l-5 10 34-30-18-1 7-20-38 29h18z" fill="#8ce2c5" stroke="#c8ffec" stroke-width="3" stroke-linejoin="round"/><path d="M16 31h22M11 43h18M19 55h12" stroke="#7ba7c5" stroke-width="4" stroke-linecap="round"/>';
  } else if (normalized === "doublecost") {
    art = '<circle cx="38" cy="51" r="24" fill="#e8bd57" stroke="#ffdf91" stroke-width="4"/><circle cx="61" cy="44" r="24" fill="#e4aa3c" stroke="#ffdf91" stroke-width="4"/><text x="61" y="53" text-anchor="middle" font-size="25" font-weight="800" fill="#744c1a">×2</text>';
  } else if (normalized === "superweapon") {
    art = '<path d="m57 14 24 24-8 8-24-24zM54 36l-8 8-8 28-10 10 6-19 28-9 8-8" fill="#b7d7f0" stroke="#e7f5ff" stroke-width="4" stroke-linejoin="round"/><path d="m22 22 8 2 2 8 3-8 8-2-8-3-3-8-2 8z" fill="#ffe089"/>';
  } else if (normalized === "chest") {
    art = '<path d="M15 39h66v42H15z" fill="#a56d3c" stroke="#e7bd78" stroke-width="4"/><path d="M18 39c0-15 12-25 30-25s30 10 30 25" fill="#c28b4e" stroke="#efcf8c" stroke-width="4"/><path d="M42 46h12v17H42z" fill="#f4d26f"/><path d="M48 63v10" stroke="#784b22" stroke-width="4"/>';
  } else if (normalized === "digspot") {
    art = '<path d="M18 76 35 24l13 16 15-27 16 63z" fill="#7fc9dc" stroke="#d4f8ff" stroke-width="4" stroke-linejoin="round"/><path d="m35 24 5 34 8-18m15-27-3 43 19 22" fill="none" stroke="#e7ffff" stroke-width="3"/>';
  } else if (normalized.includes("weather") || /^(rainy|snowy|windy)/i.test(key)) {
    if (normalized.includes("snow")) art = '<path d="M28 56a20 20 0 1 1 40 0 17 17 0 0 1-2 34H31a18 18 0 0 1-3-34Z" fill="#9bd8ef"/><path d="M35 72v4m0 0-5-3m5 3 5-3m13-1v4m0 0-5-3m5 3 5-3m11-1v4m0 0-5-3m5 3 5-3" stroke="#f4fbff" stroke-width="3" stroke-linecap="round"/>';
    else if (normalized.includes("wind")) art = '<path d="M16 37h43c12 0 12-17 1-17-5 0-8 3-9 7M13 50h61c11 0 12 16 1 17-5 0-8-3-9-7M22 64h29" fill="none" stroke="#93dfd2" stroke-width="6" stroke-linecap="round"/>';
    else art = '<path d="M24 59a23 23 0 1 1 46 0 18 18 0 0 1-3 35H31a19 19 0 0 1-7-35Z" fill="#8ccbe7"/><path d="m35 71-5 12m20-12-5 12m20-12-5 12" stroke="#d6f5ff" stroke-width="5" stroke-linecap="round"/>';
  } else if (rarityKey) {
    art = '<circle cx="48" cy="48" r="35" fill="#202d42" stroke="' + rarityColor + '" stroke-width="4"/><path d="M26 48 32 28l16 11 16-11 7 20c6 5 9 11 6 18-3 9-14 14-29 14S25 75 22 66c-2-7 0-13 4-18Z" fill="' + rarityColor + '"/><path d="m75 21 3-8 3 8 8 3-8 3-3 8-3-8-8-3z" fill="#fff1bd"/>';
  } else {
    const initials = esc((key.replace(/[^a-z0-9]/gi, "").slice(0, 2) || "?"));
    art = '<rect x="17" y="17" width="62" height="62" rx="18" fill="#22364a" stroke="#81d8b8" stroke-width="4"/><text x="48" y="58" text-anchor="middle" font-size="26" font-weight="800" fill="#d5f4e6">' + initials + '</text>';
  }
  return '<svg class="game-sprite-icon" viewBox="0 0 96 96" role="img" aria-label="' + esc(label || key || "Item") + '" focusable="false">' + art + '</svg>';
}

function gameItemVisual(spriteName, label) {
  const key = String(spriteName || "").trim();
  const normalized = key.toLowerCase();
  const pet = t("Pet.csv").rows.find(row => String(row.Name).toLowerCase() === normalized);
  if (pet) return petImageHtml(pet, "reward-art-pet");
  const mutation = t("mutation.csv").rows.find(row => String(row.Name).toLowerCase() === normalized);
  if (mutation) return systemIcon(s.data.visualAssets?.mutationIcons, mutation.ID, "✧");
  const effect = t("weatherEffects.csv").rows.find(row => String(row.Icon || row.Name).toLowerCase() === normalized || String(row.Name).toLowerCase() === normalized);
  if (effect) return systemIcon(s.data.visualAssets?.weatherEffectIcons, effect.ID, "☁");
  return gameSpriteIconHtml(key, label);
}

function rewardVisual(row) {
  const [first = "", second = ""] = String(row.Value ?? "").split(";");
  const type = String(row.TypeReward ?? "");
  if (type === "1") {
    const pet = t("Pet.csv").rows.find(item => String(item.ID) === first);
    return pet ? petImageHtml(pet, "reward-art-pet") : '<span class="reward-art-mark">🐾</span>';
  }
  if (type === "4") return gameSpriteIconHtml("Summon" + first, "Summon " + (first || "pet"));
  if (type === "6") {
    const moodeng = t("Pet.csv").rows.find(item => item.Name === "MOODENG");
    return moodeng ? petImageHtml(moodeng, "reward-art-pet reward-art-moodeng") : gameSpriteIconHtml("Moodeng", "Random secret pool");
  }
  if (type === "10") {
    const mutagen = t("Mutagen.csv").rows.find(item => String(item.ID) === first);
    const mutation = mutagen && t("mutation.csv").rows.find(item => String(item.ID) === String(mutagen.Mutation));
    return '<span class="reward-art-icon">' + systemIcon(s.data.visualAssets?.mutationIcons, mutation?.ID, "✧") + '</span>';
  }
  if (type === "16") {
    const weatherGen = t("WeatherGen.csv").rows.find(item => String(item.ID) === first);
    const effect = weatherGen && t("weatherEffects.csv").rows.find(item => String(item.ID) === String(weatherGen.WeatherEffect));
    return '<span class="reward-art-icon">' + systemIcon(s.data.visualAssets?.weatherEffectIcons, effect?.ID, "☁") + '</span>';
  }
  const sprites = { "2": "MoneyIcon", "3": "PetCoinIcon", "5": "MoneyIcon", "7": "DustIcon", "9": "SpinIcon", "17": "DuplicateTicket" };
  return gameSpriteIconHtml(sprites[type] || "Reward", rewardTypeName(type));
}

function rewardDescription(row) {
  const [first = "", second = "", third = "", fourth = ""] = String(row.Value ?? "").split(";");
  const type = String(row.TypeReward ?? "");
  if (type === "1") {
    const pet = t("Pet.csv").rows.find(item => String(item.ID) === first);
    const mutation = second && t("mutation.csv").rows.find(item => String(item.ID) === second);
    const parts = [pet ? pet.Name : ("Pet #" + (first || "?")), pet?.Rarity, mutation && mutation.Name !== "NORMAL" ? mutation.Name : ""].filter(Boolean);
    if (third) parts.push("Weather " + third);
    if (fourth) parts.push("Level " + fourth);
    return parts.join(" · ");
  }
  if (type === "4") {
    const mutation = second && t("mutation.csv").rows.find(item => String(item.ID) === second);
    const mutationDetail = mutation && mutation.Name !== "NORMAL" ? "Mutation " + mutation.Name : row.direct && second ? "Mutation #" + second : second ? "Tham số cấu hình " + second : "";
    return [first || "Rarity chưa có", mutationDetail].filter(Boolean).join(" · ");
  }
  if (type === "5") return "Mức quy đổi phụ thuộc thu nhập hiện tại của base.";
  if (type === "6") return "Reward value: " + (row.Value || "chưa có dữ liệu");
  if (type === "10") {
    const mutagen = t("Mutagen.csv").rows.find(item => String(item.ID) === first);
    const mutation = mutagen && t("mutation.csv").rows.find(item => String(item.ID) === String(mutagen.Mutation));
    return [mutation?.Name || ("MutaGen #" + (first || "?")), mutagen?.Rarity].filter(Boolean).join(" · ");
  }
  if (type === "16") {
    const weatherGen = t("WeatherGen.csv").rows.find(item => String(item.ID) === first);
    const effect = weatherGen && t("weatherEffects.csv").rows.find(item => String(item.ID) === String(weatherGen.WeatherEffect));
    return [effect?.Name || ("WeatherGen #" + (first || "?")), weatherGen?.Rarity].filter(Boolean).join(" · ");
  }
  if (type === "2") return "Money Rank Value " + (first || "—");
  return "Giá trị cấu hình " + (row.Value || "—");
}

function rewardCardHtml(row) {
  if (row.missing) return '<article class="reward-item-card reward-item-missing"><div class="reward-art"><span class="reward-art-mark">?</span></div><div class="reward-item-copy"><strong>Reward #' + esc(row.ID) + '</strong><span class="reward-item-detail">Không tìm thấy trong reward.csv.</span></div></article>';
  const type = String(row.TypeReward ?? "");
  const qty = String(row.Quantity ?? "").trim() || "chưa có";
  const detail = rewardDescription(row);
  const rarityName = type === "4" ? String(row.Value ?? "").split(";")[0] : "";
  const rewardReference = row.direct ? "Reward trực tiếp" : "Reward #" + esc(row.ID);
  return '<article class="reward-item-card"><div class="reward-art">' + rewardVisual(row) + '</div><div class="reward-item-copy"><div class="reward-item-top"><span class="reward-type-tag">' + esc(rewardTypeName(type)) + '</span>' + (rarityName && colors[rarityName] ? rarity(rarityName) : "") + '</div><strong class="reward-item-amount">' + esc(rewardAmountLabel(row)) + '</strong><span class="reward-item-detail">' + esc(detail) + '</span><small>' + rewardReference + ' · Type ' + esc(type) + ' · Quantity ' + esc(qty) + '</small></div></article>';
}

function giftRewardsHtml(giftId) {
  const link = giftLink(giftId);
  if (!link || !link.resolved) return '<div class="gift-reward-block"><div class="gift-id-chip">Gift #' + esc(giftId) + '</div><span class="gift-map-arrow">→</span><div class="gift-unresolved">Chưa có mapping Gift → Reward trong snapshot.</div></div>';
  const rewards = giftRewardRows(giftId);
  return '<div class="gift-reward-block"><div class="gift-id-chip"><small>GIFT</small><strong>#' + esc(giftId) + '</strong></div><span class="gift-map-arrow" aria-hidden="true">→</span><div class="gift-reward-list">' + (rewards.map(rewardCardHtml).join("") || '<div class="gift-unresolved">Gift này chưa khai báo Reward ID.</div>') + '</div></div>';
}

function directRewardHtml(type, value, quantity) {
  return rewardCardHtml({ ID: "config", TypeReward: String(type ?? ""), Value: String(value ?? ""), Quantity: String(quantity ?? "1"), direct: true });
}
