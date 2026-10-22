# Runbook — Steal A Pet Balance & Pacing GDD

Đọc file này trước khi sửa project.

## Quy tắc cứng

- Site chạy tĩnh trong `dist/`: không thêm Express, server ứng dụng, framework hay build step.
- `D:\Craftland\StealAPet` là project game chỉ đọc. Chỉ đọc CSV trong `Assets/CSV/**` và file `.fcg` để xác minh logic. Không chạy Studio/build, không tạo file, không dùng lệnh Git ghi ở repo game.
- Mọi script sync chỉ ghi trong project GDD; giữ guard đích output. Không đọc `giftcode.csv`, `Compensate/**` hoặc asset game làm nguồn sync.
- Không commit/push trong repo game. Trong GDD chỉ commit local cho từng thay đổi của plan; không push, amend, rebase, reset hoặc tạo tag.
- Không bịa số. Dùng CSV/code đã kiểm chứng; thiếu nguồn thì ghi “chưa có dữ liệu”. Balance target và mô phỏng chỉ thêm khi có quyết định hoặc cơ chế nguồn đã xác nhận.
- Giao diện dùng vanilla JS, tiếng Việt, mặc định gọn; dữ liệu dẫn xuất do `tools/*.mjs` sinh vào `dist/data/`. Trình duyệt chỉ đọc JSON và hiển thị.

## Lệnh thường dùng

Chạy từ thư mục project GDD:

```powershell
node tools/sync-source-data.mjs --project-root "D:\Craftland\StealAPet"
python -m http.server 8080 --directory dist
```

Mở `http://localhost:8080`. Sync chỉ đọc allowlist CSV và `.fcg` từ checkout game; mọi output được neo trong `dist/` của project này.

## Bản đồ project

- `plans/PLAN-features-from-pvz.md`: thứ tự và phạm vi tính năng.
- `design/00-decisions.md`: quyết định đã chốt và trạng thái nguồn.
- `design/20-dev-action-items.md`: việc kỹ thuật còn mở có bằng chứng.
- `tools/sync-source-data.mjs`: đọc config được allowlist, tạo snapshot và JSON dẫn xuất.
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
