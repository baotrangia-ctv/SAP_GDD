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

function rewardVisual(row) {
  const [first = "", second = ""] = String(row.Value ?? "").split(";");
  const type = String(row.TypeReward ?? "");
  if (type === "1") {
    const pet = t("Pet.csv").rows.find(item => String(item.ID) === first);
    return pet ? petImageHtml(pet, "reward-art-pet") : '<span class="reward-art-mark">🐾</span>';
  }
  if (type === "4") return '<span class="reward-art-mark reward-art-random">✦</span>';
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
  const marks = { "2": "＄", "3": "◉", "5": "◷", "6": "🎁", "7": "✧", "9": "🎟", "17": "◇" };
  return '<span class="reward-art-mark">' + (marks[type] || "◈") + '</span>';
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
