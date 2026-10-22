# Plan: bổ sung tính năng cho StealAPetBalanceGDD (tham khảo PvZ balance-web)

Nguồn tham khảo: `D:\Craftland\_Users\plant_vs_zombie_gdd` (`tools/balance-web`, `knowledge-pack`, `design/`, `CLAUDE.md`).
Nguyên tắc: **chỉ lấy tính năng tương đương**, không sao chép kiến trúc/nội dung PvZ (không có plant, zombie, boss, break, upgrade, merge, recycle… ở Steal A Pet).

## 1. Hiện trạng so sánh

| | PvZ balance-web (mẫu) | StealAPetBalanceGDD (hiện tại) |
|---|---|---|
| Kiến trúc | Node/Express, `*-model.js`, `scripts/`, ~28 trang | Static `dist/` (4 file JS + `config-snapshot.json`), sync bằng `tools/sync-source-data.mjs` |
| Trang | Pacing, Level overview, Curves, Simulator, Shop, Missions, Onboarding, Packs, Items, Roadmap, System map, UI/UX, Config, Sync, Docs | Overview, Progression, Economy/roster, Cadence, Pet spawn lab, Config explorer, Recent changes, Mutagen, Weather Drop, Lucky Box |
| Dữ liệu | Mirror CSV↔JSON, **proposal vs dev baseline**, sửa được, export zip CSV | Chỉ đọc snapshot CSV của game, không có đề xuất |
| Mô phỏng | Monte Carlo player → phút chơi theo level | Không có ("Minutes-to-goal are not simulated") |
| Quy trình | Decision log (D-số), dev action items, balance targets + audit, check-sync, CLAUDE.md runbook | README ngắn, chưa có tài liệu quyết định |
| UX web | Nav nhóm + dropdown, badge version, chế độ Gọn/Đầy đủ | Sidebar 2 nhóm, chưa có chế độ gọn |

## 2. Tính năng sẽ bổ sung (đã lọc theo độ phù hợp)

Ưu tiên: **P1** = nên làm đầu, giá trị cao / rủi ro thấp · **P2** = tiếp theo · **P3** = tuỳ chọn.

| # / trạng thái | Tính năng (tương đương ở mẫu) | Áp dụng cho Steal A Pet | Dữ liệu dùng | Ưu |
|---|---|---|---|---|
| F1 · ☐ | **Tài liệu GDD + Decision log + Dev action items** (`docs.html`, `design/00-decisions`, `20-dev-action-items`) | Thư mục `design/` markdown (decision D-số, việc cho dev còn mở); trang "Docs" render md. Seed quyết định từ README + findings hiện có | `design/*.md` | P1 |
| F2 · ☐ | **Sync / Staleness page + dev-diff** (`sync.html`, `check-sync`, `dev-diff.js`) | Trang "Đồng bộ": commit nguồn, ngày snapshot, CSV nào đổi so với lần sync trước, cảnh báo snapshot cũ. Mở rộng `sync-source-data.mjs` để lưu baseline theo commit và sinh diff | `recentCommits`, baseline | P1 |
| F3 · ✅ | **Shop Schedule** (`shop-schedule.html`) | Trang Shop: `shopItems`, `RotationShopWaves/Items` (2060 dòng, chưa có trang nào), giá, stock, tỉ lệ xuất hiện theo wave/rebirth | `shopItems.csv`, `RotationShop*.csv`, `shopEventItems.csv` | P1 |
| F4 · ✅ | **Missions & Rewards** (`mission-balance`, `onboarding`, `collection-rewards`) | Trang Nhiệm vụ: `DailyMissions`, `RevivalMission`, `DailyRewards`, `milestone`, `reward` — ngưỡng, quà raw và mốc theo dữ liệu xác nhận; `reward.csv` tách/lazy-load | các CSV + `.fcg` runtime xác nhận | P1 |
| F5 · ☐ | **Packs / Pools contents** (`packs.html`, `pack-popup`) | Trang Pools: `GuaranteePool`, `PoolRandomItem`, `poolRewardSecret`, pool Dig/Fishing/Collector/FuseContract — tỉ lệ từng món (mở rộng khung Lucky Box hiện có thành bảng chung) | pool CSV | P1 |
| F6 · ☐ | **Nhóm "Events"** (mẫu: Zombie & Boss / Items — trang nội dung theo hệ thống) | Mỗi event 1 view read-only như Mutagen/Weather: Dig, Fishing, Meteorite, Mole, Ball, Collector, FuseContract, RarityContract, DustHunt | `Event/*`, `DustHunt*` | P2 |
| F7 · ☐ | **Nav nhóm + chế độ Gọn/Đầy đủ + version badge** (`nav.js`) | Gom sidebar thành nhóm: Tổng quan · Balance · Nội dung · Events · Dữ liệu; toggle "Gọn" ẩn đoạn giải thích dài (mặc định gọn); badge version + giờ snapshot | UI | P2 |
| F8 · ☐ | **Balance targets + audit** (`balance-targets.json`, `audit-targets.js`) | `data/balance-targets.json` (vd: số phút tới RB mục tiêu, tỉ lệ pet hiếm/giờ, giá trị shop ÷ income) + trang chấm xanh/vàng/đỏ. Mục tiêu do designer chốt, **không tự bịa số** | targets + simulator | P2 |
| F9 · ☐ | **Config Tables: Proposal vs Dev + sửa + Export zip** (`config.html`, `export-csv.js`, `/api/export-config`) | Nâng Config explorer: bật "Đề xuất / Dev hiện tại", sửa ô, highlight diff, nút xuất CSV đề xuất cho dev. Cần chốt kiến trúc (xem §3) | mirror JSON | P2 |
| F10 · ☐ | **Progression Pacing + Level Overview + Simulator** (`progression-pacing`, `level-overview`, `simulation`) | Mô phỏng người chơi đi qua Rebirth 1→27: thu nhập/phút theo pet + mutation + weather, giá Rebirth → phút tới mốc, bảng "RB → phút / tiền / unlock". Là tính năng lớn nhất và cần mô hình hoá theo cơ chế trộm/base của Steal A Pet, **không** copy `simulation-core.js` | `rebirth.csv`, `Pet.csv`, spawn lab | P3 (làm sau khi F1–F5 xong, cần xác nhận nguồn thu nhập thật từ code game) |
| F11 · ☐ | **Content Roadmap** (`content-roadmap.html`) | Lộ trình update pet/event theo tuần, từ `Plans/` của game + decision log | `design/`, `Docs/Plans` | P3 |
| F12 · ☐ | **System Map** (`system-map.html`, Mermaid) | Core loop Steal A Pet: parade → nhặt pet → base income → trộm/phòng thủ → rebirth; liên kết sang các trang | tĩnh | P3 |
| F13 · ✅ | **Runbook `CLAUDE.md` + knowledge-pack nhẹ** | `CLAUDE.md` ghi quy tắc cứng, lệnh sync, bản đồ file (giảm token cho các phiên sau) | — | P2 |

**Bỏ qua có chủ đích:** UI/UX mockup từ `.ui` và HUD simulator (PvZ-specific, tốn công), Break/Upgrade/Skills/Recycle/Zombie/Plant-power, script deploy RUN Platform (xem lại sau nếu cần), các script `apply-D*.js` (gắn với quyết định riêng của PvZ).

## 3. Quyết định kiến trúc

**✅ ĐÃ CHỐT: giữ site tĩnh** (không Express). Hệ quả: F9 chỉ làm bản xem diff proposal/dev + tải CSV (không lưu trực tiếp trên web); F10 chạy offline bằng script `tools/*.mjs`, web chỉ hiển thị kết quả.

- Ghi chú ban đầu: giữ static site, thêm `tools/*.mjs` sinh JSON dẫn xuất vào `dist/data/` (không cần Express). Phù hợp F1–F8, F11–F13; deploy đơn giản như hiện nay.
- Chỉ thêm Node server nếu cần **sửa config trực tiếp trên web + chạy simulator on-demand** (F9 full, F10 chạy live). Phương án trung gian: simulator chạy offline bằng script, web chỉ hiển thị kết quả.

## 4. Lộ trình triển khai

**Phase 0 — Nền (0.5 ngày):** `CLAUDE.md` runbook (F13), thư mục `design/` + `00-decisions.md` + `20-dev-action-items.md`, chuẩn hoá layout JS (tách module theo trang thay vì app-extra/app-systems).
**Phase 1 — Trang dữ liệu còn thiếu (F3, F4, F5):** mở rộng `sync-source-data.mjs` để mirror thêm CSV shop/mission/pool vào snapshot (allowlist, vẫn loại giftcode/Compensate); thêm 3 trang theo mẫu hiện có (head/pill/bar/chart helpers).
**Phase 2 — Quy trình (F1, F2):** trang Docs (render md → JSON lúc sync), trang Đồng bộ + baseline theo commit + diff CSV.
**Phase 3 — Events + UX (F6, F7):** các view event, nav nhóm, chế độ Gọn, badge version.
**Phase 4 — Mục tiêu & chỉnh sửa (F8, F9):** balance-targets + trang audit; Config explorer proposal/dev + export (sau khi chốt §3).
**Phase 5 — Mô phỏng (F10, F11, F12):** thiết kế mô hình thu nhập (đọc `PetParadeManager`, income logic trong game repo), prototype script, trang Pacing; roadmap và system map.

Mỗi phase: chạy sync → kiểm tra trang bằng trình duyệt trong app → commit local (không push).

## 5. Rủi ro / lưu ý

- Không bịa số: mục tiêu balance (F8) và mô phỏng (F10) phải dựa trên code/CSV thật hoặc số designer cung cấp; nếu thiếu thì ghi rõ "chưa có dữ liệu" như README hiện tại.
- Dữ liệu vận hành (giftcode, Compensate) tiếp tục bị loại khỏi snapshot.
- `RotationShopItems.csv` (2060 dòng) và `reward.csv` lớn → cần phân trang/lọc, tránh phình `config-snapshot.json` (cân nhắc tách file theo bảng, lazy-load).
- Link Google Sheets nguồn vẫn chưa đọc được — không dùng làm nguồn.
