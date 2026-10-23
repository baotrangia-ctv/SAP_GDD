# Runbook — Steal A Pet Balance & Pacing GDD

Đọc file này trước khi sửa project.

## Quy tắc cứng

- Site chạy tĩnh trong `dist/`: không thêm Express, server ứng dụng, framework hay build step.
- `C:\_Code\craftland\StealAPet` là project game chỉ đọc. Chỉ đọc CSV trong `Assets/CSV/**`, file `.fcg`, `Assets/HUDs/<UI đã đăng ký>.ui` và đúng các sprite được file `.ui` đó tham chiếu. Phase hiện tại chỉ đăng ký `PetsCollection.ui`. Không chạy Studio/build, không tạo file, không dùng lệnh Git ghi ở repo game.
- Mọi script sync chỉ ghi trong project GDD; giữ guard đích output. `giftcode.csv` là dữ liệu vận hành: chỉ được chiếu các cột `ID` và `Reward` cho Gift ID đang được config hiển thị tham chiếu; không ghi hoặc render Code, Name, Limit, Start, End, Reuse hay Rebirth. Không đọc `Compensate/**` hoặc asset game ngoài sprite được `.ui` đã đăng ký tham chiếu làm nguồn sync.
- Commit message bắt buộc theo Conventional Commits 1.0.0 (`type(scope): description`); chi tiết ở `AGENTS.md`.
- Không commit/push trong repo game. Trong GDD chỉ commit local cho từng thay đổi của plan; không push, amend, rebase, reset hoặc tạo tag.
- Không bịa số. Dùng CSV/code đã kiểm chứng; thiếu nguồn thì ghi “chưa có dữ liệu”. Balance target và mô phỏng chỉ thêm khi có quyết định hoặc cơ chế nguồn đã xác nhận.
- Giao diện dùng vanilla JS, tiếng Việt, mặc định gọn; dữ liệu dẫn xuất do `tools/*.mjs` sinh vào `dist/data/`. Trình duyệt chỉ đọc JSON và hiển thị.

## Lệnh thường dùng

Chạy từ thư mục project GDD:

```powershell
node tools/sync-source-data.mjs --project-root "C:\_Code\craftland\StealAPet"
node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"
node tools/audit-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"
python -m http.server 8080 --directory dist
```

Mở `http://localhost:8080`. Sync chỉ đọc allowlist CSV và `.fcg` từ checkout game; mọi output được neo trong `dist/` của project này.

## Bản đồ project

- `plans/PLAN-features-from-pvz.md`: thứ tự và phạm vi tính năng.
- `design/00-decisions.md`: quyết định đã chốt và trạng thái nguồn.
- `design/20-dev-action-items.md`: việc kỹ thuật còn mở có bằng chứng.
- `tools/sync-source-data.mjs`: đọc config được allowlist, tạo snapshot và JSON dẫn xuất.
- `tools/sync-ui-preview.mjs`: chỉ đọc `PetsCollection.ui`, `.fcg` liên quan và sprite HUD trong allowlist; tạo dữ liệu UI Preview tách riêng, không đọc giftcode/compensation.
- `dist/index.html`, `dist/styles.css`: shell, sidebar và layout.
- `dist/app-core.js`: helper và các trang tổng quan/progression/roster/cadence.
- `dist/app-*.js`: module theo trang hoặc nhóm trang liên quan; router ở `app-router.js`.
- `dist/data/`: snapshot và các JSON tách theo bảng/trang.

## Quy trình thay đổi

1. Đọc plan, README và các module/trang liên quan.
2. Xác nhận nguồn số liệu trong CSV và `.fcg` cho phép đọc; không suy diễn cơ chế chưa kiểm chứng.
3. Sửa script sinh dữ liệu và UI tĩnh; không hard-code dữ liệu config vào JavaScript.
4. Chạy sync, serve `dist/`, kiểm tra trang, console và màn hình nhỏ.
5. Trước mỗi commit: `git status` và `git diff --stat` trong repo GDD; chỉ stage file của update đó. Không push.

Nếu bước nào cần ghi vào project game, dừng tại đó.
