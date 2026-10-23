"use strict";

Object.assign(pages, { missions: "Nhiệm vụ & quà" });

if (!s.missionView) s.missionView = "daily";
if (!s.missionSubView) s.missionSubView = "onboard";
if (s.missionType === undefined) s.missionType = "all";
if (s.missionRebirth === undefined) s.missionRebirth = "all";

let missionBalanceData = null;
let missionBalanceLoading = null;

function missionsPage() {
  return head("MISSION & REWARDS", "Nhiệm vụ & quà", "Xem từng gift cùng phần thưởng, hình minh hoạ, loại và số lượng cấu hình.", pill("Gift → Reward", "mint")) +
    '<div id="mission-data"><div class="loading-state"><span class="loader"></span><span>Đang đọc quà nhiệm vụ…</span></div></div>';
}

async function loadMissionBalance() {
  if (missionBalanceData) return missionBalanceData;
  if (!missionBalanceLoading) {
    missionBalanceLoading = fetch("./data/missions.json")
      .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .then(data => (missionBalanceData = data))
      .finally(() => { missionBalanceLoading = null; });
  }
  return missionBalanceLoading;
}

async function updateMissionsPage() {
  const target = document.getElementById("mission-data");
  if (!target) return;
  try {
    await Promise.all([loadMissionBalance(), loadRewardDisplayData()]);
    if (s.page !== "missions" || !document.getElementById("mission-data")) return;
    renderMissionsContent();
  } catch (error) {
    target.innerHTML = note("Không đọc được dữ liệu quà", error.message + " · Chạy tools/sync-source-data.mjs rồi tải lại trang.", "missions.json · gift-rewards.json");
  }
}

function missionTabs() {
  const tabs = [["daily", "Quà ngày"], ["onboard-revival", "Onboard / Revival"], ["luckyspin", "Lucky Spin"]];
  return '<div class="tabbar" role="tablist" aria-label="Nhóm quà">' + tabs.map(([id, label]) =>
    '<button class="tab' + (s.missionView === id ? " active" : "") + '" type="button" data-mission-view="' + id + '" role="tab" aria-selected="' + (s.missionView === id) + '">' + label + "</button>").join("") + "</div>";
}

function missionSubTabs() {
  if (s.missionView !== "onboard-revival") return "";
  const tabs = [["onboard", "Onboard"], ["revival", "Revival mission"]];
  return '<div class="tabbar subtabbar" role="tablist" aria-label="Onboard hoặc Revival">' + tabs.map(([id, label]) =>
    '<button class="tab' + (s.missionSubView === id ? " active" : "") + '" type="button" data-mission-subview="' + id + '" role="tab" aria-selected="' + (s.missionSubView === id) + '">' + label + "</button>").join("") + "</div>";
}

function missionRows() {
  if (s.missionView === "daily") return t("DailyRewards.csv").rows || [];
  if (s.missionView === "luckyspin") return t("loginReward.csv").rows || [];
  return t(s.missionSubView === "onboard" ? "onboard.csv" : "RevivalMission.csv").rows || [];
}

function missionGiftId(row) {
  return s.missionView === "luckyspin" ? row.RewardId : row.Gift;
}

function missionRowTypes(row) {
  if (s.missionView === "onboard-revival" && s.missionSubView === "onboard") return [String(row.RewardType ?? "")];
  if (s.missionView === "onboard-revival" && s.missionSubView === "revival") return [String(row.RewardType ?? "")];
  return giftRewardTypeIds(missionGiftId(row));
}

function missionTypeOptions(rows) {
  return [...new Set(rows.flatMap(missionRowTypes).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
}

function missionFilterbar(rows) {
  const types = missionTypeOptions(rows);
  const typeSelect = '<label class="mission-filter"><span>Loại quà</span><select id="mission-type" class="field-select"><option value="all">Tất cả loại</option>' + types.map(type =>
    '<option value="' + esc(type) + '"' + (s.missionType === type ? " selected" : "") + '>' + esc(rewardTypeName(type)) + "</option>").join("") + "</select></label>";
  let extraFilters = "";
  if (s.missionView === "daily") {
    const rebirths = [...new Set(rows.map(row => row.RebirthLevel).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
    extraFilters = '<label class="mission-filter"><span>Rebirth tối thiểu</span><select id="mission-rebirth" class="field-select"><option value="all">Tất cả</option>' + rebirths.map(value =>
      '<option value="' + esc(value) + '"' + (s.missionRebirth === value ? " selected" : "") + '>RB ≥ ' + esc(value) + "</option>").join("") + "</select></label>";
  }
  return '<div class="filterbar mission-filterbar">' + typeSelect + extraFilters + '<span id="mission-count" class="small-count"></span></div>';
}

function filterMissionRows(rows) {
  return rows.filter(row => {
    if (s.missionType !== "all" && !missionRowTypes(row).includes(s.missionType)) return false;
    if (s.missionView === "daily" && s.missionRebirth !== "all" && row.RebirthLevel !== s.missionRebirth) return false;
    return true;
  });
}

function dailyRewardCard(row) {
  return '<article class="reward-grant-card"><div class="reward-grant-meta"><span class="reward-gate-label">Ngày ' + esc(row.Day) + '</span>' + pill(row.UserType || "—", "mint") + '<span class="reward-rb-label">Từ RB ' + esc(row.RebirthLevel || "—") + '</span></div>' + giftRewardsHtml(row.Gift) + '</article>';
}

function onboardRewardCard(row) {
  const title = pretty(String(row.Description || "Bước " + row.ID).replace(/^MISSION_/, ""));
  const targetValue = [row.TargetValue, row.TargetCondition].filter(Boolean).join(" · ");
  return '<article class="reward-grant-card"><div class="reward-grant-meta"><span class="reward-gate-label">Bước ' + esc(row.ID) + '</span><span class="reward-rb-label">Yêu cầu RB ' + esc(row.RequireRebirth || "—") + '</span></div><div class="mission-goal"><strong>' + esc(title) + '</strong><small>' + esc([row.Action, targetValue].filter(Boolean).join(" · ") || "Onboard") + '</small></div>' + directRewardHtml(row.RewardType, row.RewardValue, "1") + '</article>';
}

function formatMissionDuration(raw) {
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return String(raw || "—");
  if (seconds < 60) return seconds + " giây";
  const minutes = Math.floor(seconds / 60), remainder = seconds % 60;
  if (minutes < 60) return remainder ? minutes + " phút " + remainder + " giây" : minutes + " phút";
  const hours = Math.floor(minutes / 60), remainingMinutes = minutes % 60;
  return remainingMinutes ? hours + " giờ " + remainingMinutes + " phút" : hours + " giờ";
}

function revivalRewardCard(row) {
  return '<article class="reward-grant-card"><div class="reward-grant-meta"><span class="reward-gate-label">Mốc ' + esc(row.Step) + '</span><span class="reward-rb-label">RB ' + esc(row.RebirthLevel || "—") + '</span><span class="reward-rb-label">Online ' + esc(formatMissionDuration(row.TargetValue)) + '</span></div>' + directRewardHtml(row.RewardType, row.RewardValue, "1") + '</article>';
}

function spinRewardCard(row, totalWeight) {
  const chance = totalWeight > 0 ? Number(row.Weight) / totalWeight : 0;
  const percent = chance * 100;
  const percentLabel = percent >= 1 ? percent.toFixed(1) : percent.toFixed(2);
  const startAngle = Number(row.MinAngle), endAngle = Number(row.MaxAngle);
  return '<article class="spin-reward-card"><div class="spin-chance"><strong>' + percentLabel + '%</strong><span>Weight ' + esc(row.Weight) + '</span><div class="spin-chance-track"><i style="width:' + Math.min(100, percent) + '%"></i></div></div><div class="spin-reward-content">' + giftRewardsHtml(missionGiftId(row)) + '<small class="spin-angle">Vùng dừng của vòng quay: ' + (Number.isFinite(startAngle) && Number.isFinite(endAngle) ? esc(startAngle) + '°–' + esc(endAngle) + '°' : "chưa có góc") + '</small></div></article>';
}

function missionContent(rows) {
  if (s.missionView === "daily") return rows.map(dailyRewardCard).join("");
  if (s.missionView === "luckyspin") {
    const total = rows.reduce((sum, row) => sum + (Number(row.Weight) || 0), 0);
    return rows.map(row => spinRewardCard(row, total)).join("");
  }
  return s.missionSubView === "onboard" ? rows.map(onboardRewardCard).join("") : rows.map(revivalRewardCard).join("");
}

function missionSourceNote() {
  if (s.missionView === "daily") return note("Quà ngày", "Gift ID được nối tới các Reward ID trong runtime catalog. Dùng filter theo loại quà và Rebirth tối thiểu; user type vẫn hiển thị trên từng quà.", "DailyRewards.csv · MailConfigs.fcg · reward.csv", "info");
  if (s.missionView === "luckyspin") return note("Tỉ lệ Lucky Spin theo Weight", "Runtime chọn Reward ID bằng WeightedRandom theo Weight. Góc MinAngle–MaxAngle chỉ quyết định điểm dừng khi chạy animation.", "loginReward.csv · DailyRewardConfigs.fcg · DailyRewardManager.fcg · WeightedRandom.fcg", missionBalanceData.sourceFacts.luckySpinChoosesByWeight ? "info" : "review");
  if (s.missionSubView === "onboard") return note("Onboard reward", "RewardType/RewardValue là phần thưởng trực tiếp của từng bước; tên pet, mutation và item được nối từ catalog config.", "onboard.csv · OnboardConfigs.fcg · RewardManager.fcg", "info");
  return note("Revival mission reward", "TargetValue được runtime đưa vào time formatter; trang hiển thị thời lượng dễ đọc và reward theo type/value.", "RevivalMission.csv · RevivalMissionConfigs.fcg · RewardManager.fcg", missionBalanceData.sourceFacts.revivalTargetPassedToTimeFormatter ? "info" : "review");
}

function renderMissionsContent() {
  const target = document.getElementById("mission-data");
  if (!target || !missionBalanceData) return;
  if (s.missionView === "onboard-revival" && !["onboard", "revival"].includes(s.missionSubView)) s.missionSubView = "onboard";
  const rows = missionRows();
  const filtered = filterMissionRows(rows);
  const dailyCount = t("DailyRewards.csv").rowCount || 0;
  const onboardCount = t("onboard.csv").rowCount || 0;
  const revivalCount = t("RevivalMission.csv").rowCount || 0;
  const spinCount = t("loginReward.csv").rowCount || 0;
  target.innerHTML = '<section class="kpi-grid">' +
    kpi("QUÀ NGÀY", dailyCount, "lọc type · Rebirth tối thiểu") +
    kpi("ONBOARD", onboardCount, "bước có quà") +
    kpi("REVIVAL", revivalCount, "mốc nhiệm vụ") +
    kpi("LUCKY SPIN", spinCount, "reward có Weight") +
    '</section>' + missionTabs() + missionSubTabs() + missionFilterbar(rows) +
    '<div id="mission-reward-list" class="mission-reward-list">' + (missionContent(filtered) || '<div class="empty">Không có quà khớp bộ lọc.</div>') + '</div>' +
    '<div class="table-foot"><span id="mission-count-copy">' + filtered.length + ' / ' + rows.length + ' dòng</span><span>Catalog snapshot · không phải proposal</span></div>' + missionSourceNote();
  updateMissionRows();
}

function updateMissionRows() {
  const list = document.getElementById("mission-reward-list");
  if (!list) return;
  const rows = missionRows();
  const filtered = filterMissionRows(rows);
  list.innerHTML = missionContent(filtered) || '<div class="empty">Không có quà khớp bộ lọc.</div>';
  const count = document.getElementById("mission-count");
  if (count) count.textContent = filtered.length + " / " + rows.length + " quà";
  const countCopy = document.getElementById("mission-count-copy");
  if (countCopy) countCopy.textContent = filtered.length + " / " + rows.length + " dòng";
}

document.addEventListener("click", event => {
  const tab = event.target.closest("[data-mission-view]");
  if (tab) {
    s.missionView = tab.dataset.missionView;
    s.missionSubView = "onboard";
    s.missionType = "all";
    s.missionRebirth = "all";
    renderMissionsContent();
    return;
  }
  const subtab = event.target.closest("[data-mission-subview]");
  if (subtab) {
    s.missionSubView = subtab.dataset.missionSubview;
    s.missionType = "all";
    renderMissionsContent();
  }
});

document.addEventListener("change", event => {
  if (event.target.id === "mission-type") { s.missionType = event.target.value; updateMissionRows(); }
  if (event.target.id === "mission-rebirth") { s.missionRebirth = event.target.value; updateMissionRows(); }
});
