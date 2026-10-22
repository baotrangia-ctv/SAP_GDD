Object.assign(pages, { missions: "Nhiệm vụ & quà" });

if (!s.missionView) s.missionView = "daily";
if (s.missionSearch === undefined) s.missionSearch = "";
if (!s.missionOffset) s.missionOffset = 0;

let missionBalanceData = null;
let missionBalanceLoading = null;
let missionRewardTable = null;
let missionRewardLoading = null;
let missionRewardError = "";
const MISSION_PAGE_SIZE = 50;

function missionsPage() {
  return head("MISSION & REWARD REVIEW", "Nhiệm vụ & phần thưởng", "Đọc ngưỡng, điều kiện và reward ID từ CSV; giữ nguyên giá trị khi chưa có bảng quy đổi được xác nhận.", pill("CSV + code đã mirror", "mint")) +
    '<div id="mission-data"><div class="loading-state"><span class="loader"></span><span>Đang đọc dữ liệu nhiệm vụ…</span></div></div>';
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

async function loadMissionRewardTable() {
  if (missionRewardTable) return missionRewardTable;
  if (!missionBalanceData?.rewardTable?.file) throw new Error("Chưa có mirror cho reward.csv.");
  if (!missionRewardLoading) {
    missionRewardLoading = fetch("./data/" + missionBalanceData.rewardTable.file)
      .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .then(data => (missionRewardTable = data))
      .finally(() => { missionRewardLoading = null; });
  }
  return missionRewardLoading;
}

async function updateMissionsPage() {
  const target = document.getElementById("mission-data");
  if (!target) return;
  try {
    await loadMissionBalance();
    if (s.page !== "missions" || !document.getElementById("mission-data")) return;
    renderMissionsContent();
  } catch (error) {
    target.innerHTML = note("Không đọc được dữ liệu nhiệm vụ", error.message + " · Chạy tools/sync-source-data.mjs rồi tải lại trang.", "missions.json");
  }
}

function missionTabs() {
  const tabs = [["daily", "Nhiệm vụ ngày"], ["login", "Quà ngày"], ["revival", "Revival"], ["milestone", "Milestone"], ["rewards", "reward.csv"]];
  return '<div class="tabbar" role="tablist" aria-label="Nhóm nhiệm vụ và phần thưởng">' + tabs.map(([id, label]) =>
    '<button class="tab' + (s.missionView === id ? " active" : "") + '" type="button" data-mission-view="' + id + '" role="tab" aria-selected="' + (s.missionView === id) + '">' + label + "</button>").join("") + "</div>";
}

function missionColumns() {
  if (s.missionView === "daily") return [
    { key: "ID", label: "ID" }, { key: "Day", label: "Day" }, { key: "Type", label: "Type" },
    { key: "Description", label: "Description · raw" }, { key: "Action", label: "Action" },
    { key: "TargetValue", label: "Target · raw" }, { key: "TargetCondition", label: "Condition" },
    { key: "Rewards", label: "Reward type → value", value: row => missionRewardDisplay(row) }, { key: "Priority", label: "Priority" }
  ];
  if (s.missionView === "login") return [
    { key: "ID", label: "ID" }, { key: "Day", label: "Day" }, { key: "UserType", label: "UserType" },
    { key: "RebirthLevel", label: "RebirthLevel" }, { key: "Gift", label: "Gift ID · raw" }
  ];
  if (s.missionView === "revival") return [
    { key: "ID", label: "ID" }, { key: "Step", label: "Step" }, { key: "RebirthLevel", label: "RebirthLevel" },
    { key: "TargetValue", label: "TargetValue · raw" }, { key: "RewardType", label: "RewardType · raw" },
    { key: "RewardValue", label: "RewardValue · raw" }
  ];
  if (s.missionView === "milestone") {
    if (missionBalanceData?.sourceFacts?.milestoneGiftLookupUsesMatchingIndex && missionBalanceData.milestoneEntries?.length) {
      return [
        { key: "configId", label: "Config ID" }, { key: "type", label: "Type · raw" },
        { key: "milestone", label: "Milestone · raw" }, { key: "giftId", label: "Gift ID · raw" }
      ];
    }
    return ["ID", "Type", "Milestone", "Gift"].map(key => ({ key, label: key + " · raw" }));
  }
  const headers = missionRewardTable?.headers || missionBalanceData?.rewardTable?.headers || [];
  return headers.map(key => ({ key, label: key + " · raw" }));
}

function missionRewardDisplay(row) {
  if (missionBalanceData?.sourceFacts?.dailyMissionRewardsPairByIndex) {
    const entry = missionBalanceData.dailyMissionRewardsById?.[String(row.ID)];
    if (entry?.pairs?.length) return entry.pairs.map(pair => "type " + pair.type + " → " + (pair.hasValue ? pair.value : "chưa có value")).join(" · ");
  }
  return [row.RewardType, row.RewardValue].filter(value => value !== undefined && value !== "").join(" / ") || "—";
}

function missionRows() {
  if (s.missionView === "daily") return t("DailyMissions.csv").rows || [];
  if (s.missionView === "login") return t("DailyRewards.csv").rows || [];
  if (s.missionView === "revival") return t("RevivalMission.csv").rows || [];
  if (s.missionView === "milestone") {
    if (missionBalanceData?.sourceFacts?.milestoneGiftLookupUsesMatchingIndex && missionBalanceData.milestoneEntries?.length) return missionBalanceData.milestoneEntries;
    return t("milestone.csv").rows || [];
  }
  return missionRewardTable?.rows || [];
}

function renderMissionsContent() {
  const target = document.getElementById("mission-data");
  if (!target || !missionBalanceData) return;
  const rewardMeta = missionBalanceData.rewardTable;
  target.innerHTML = '<section class="kpi-grid">' +
    kpi("DAILY MISSION ROWS", t("DailyMissions.csv").rowCount, "DailyMissions.csv") +
    kpi("DAILY REWARD ROWS", t("DailyRewards.csv").rowCount, "DailyRewards.csv") +
    kpi("REVIVAL ROWS", t("RevivalMission.csv").rowCount, "RevivalMission.csv") +
    kpi("MILESTONE CONFIGS", t("milestone.csv").rowCount, "milestone.csv") +
    kpi("REWARD ROWS", rewardMeta?.rowCount ?? "—", "reward.csv · tải khi mở tab") +
    '</section>' + missionTabs() +
    '<div class="filterbar"><div class="search-wrap"><input id="mission-search" type="search" value="' + esc(s.missionSearch) + '" placeholder="Tìm ID, type, target, gift…" aria-label="Tìm trong nhiệm vụ và phần thưởng"></div><span id="mission-count" class="small-count"></span></div>' +
    '<div class="table-wrap data-table-view"><table><thead><tr>' + missionColumns().map(column => "<th>" + esc(column.label) + "</th>").join("") + '</tr></thead><tbody id="mission-rows"></tbody></table></div>' +
    '<div class="table-foot"><span id="mission-page"></span><span><button class="panel-link" data-mission-action="prev">← Trước</button> <button class="panel-link" data-mission-action="next">Tiếp →</button></span></div>' +
    note("Giữ nguyên giá trị cấu hình", "RewardType/RewardValue và Gift ID hiển thị theo CSV. Source xác nhận cặp reward của DailyMissions và milestone theo cùng index; chưa có bảng quy đổi Gift ID → tên/value được xác nhận cho các bảng này. RevivalMission.TargetValue được đưa vào time formatter trong code; trang giữ số raw.", "ActivitiesConfigs.fcg · ActivitiesManager.fcg · RevivalMissionConfigs.fcg · MilestoneConfig.fcg", "info") +
    note("reward.csv · raw table", "Bảng được tách riêng và chỉ tải khi chọn tab này. Chưa xác nhận đây là bảng diễn giải Gift ID của DailyRewards hoặc milestone.", "reward.csv · " + (rewardMeta?.rowCount ?? 0) + " rows", "info");
  updateMissionRows();
  if (s.missionView === "rewards" && !missionRewardTable && !missionRewardError) {
    loadMissionRewardTable().then(() => {
      if (s.page === "missions" && s.missionView === "rewards") updateMissionRows();
    }).catch(error => {
      missionRewardError = error.message;
      if (s.page === "missions" && s.missionView === "rewards") updateMissionRows();
    });
  }
}

function updateMissionRows() {
  const body = document.getElementById("mission-rows");
  if (!body) return;
  if (s.missionView === "rewards" && missionRewardError) {
    body.innerHTML = '<tr><td class="empty" colspan="' + Math.max(1, missionColumns().length) + '">Không tải được reward.csv: ' + esc(missionRewardError) + "</td></tr>";
    return;
  }
  if (s.missionView === "rewards" && !missionRewardTable) {
    body.innerHTML = '<tr><td class="empty" colspan="' + Math.max(1, missionColumns().length) + '">Đang tải reward.csv…</td></tr>';
    return;
  }
  const columns = missionColumns();
  const query = s.missionSearch.trim().toLowerCase();
  const rows = missionRows().filter(row => !query || columns.map(column => column.value ? column.value(row) : row[column.key]).join(" ").toLowerCase().includes(query));
  const end = Math.min(s.missionOffset + MISSION_PAGE_SIZE, rows.length);
  body.innerHTML = rows.slice(s.missionOffset, end).map(row => "<tr>" + columns.map(column => {
    const value = column.value ? column.value(row) : row[column.key];
    const shown = value === undefined || value === null || value === "" ? "—" : String(value);
    return '<td title="' + esc(shown) + '">' + esc(shown) + "</td>";
  }).join("") + "</tr>").join("") || '<tr><td class="empty" colspan="' + Math.max(1, columns.length) + '">Không có dòng khớp.</td></tr>';
  const count = document.getElementById("mission-count"); if (count) count.textContent = Math.min(rows.length, MISSION_PAGE_SIZE) + " / " + rows.length + " dòng";
  const page = document.getElementById("mission-page"); if (page) page.textContent = "Rows " + (rows.length ? s.missionOffset + 1 : 0) + "–" + end + " / " + rows.length;
  document.querySelectorAll("[data-mission-action]").forEach(button => {
    button.disabled = button.dataset.missionAction === "prev" ? s.missionOffset <= 0 : end >= rows.length;
  });
}

document.addEventListener("click", event => {
  const tab = event.target.closest("[data-mission-view]");
  if (tab) {
    s.missionView = tab.dataset.missionView;
    s.missionSearch = "";
    s.missionOffset = 0;
    renderMissionsContent();
    return;
  }
  const action = event.target.closest("[data-mission-action]");
  if (action) {
    s.missionOffset = action.dataset.missionAction === "prev" ? Math.max(0, s.missionOffset - MISSION_PAGE_SIZE) : s.missionOffset + MISSION_PAGE_SIZE;
    updateMissionRows();
  }
});
document.addEventListener("input", event => {
  if (event.target.id === "mission-search") { s.missionSearch = event.target.value; s.missionOffset = 0; updateMissionRows(); }
});
