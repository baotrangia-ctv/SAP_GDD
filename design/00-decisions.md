# Quyết định thiết kế

Ngày ghi nhận: 2026-10-22. Các mục dưới đây ghi lại quyết định đã có trong README và plan; đây không phải đề xuất số balance mới.

## D-001 — Giữ site tĩnh

- **Trạng thái:** ✅ Đã chốt trong plan.
- **Quyết định:** Không dùng Express hoặc server ứng dụng. Script `tools/*.mjs` sinh dữ liệu vào `dist/data/`; site đọc JSON tĩnh.
- **Lý do:** Giữ cách chạy và phân phối hiện tại, không thêm runtime dependency.
- **Phạm vi:** F9 chỉ xem diff và tải dữ liệu; mô phỏng F10 chạy offline nếu sau này được duyệt.
- **Nguồn:** `plans/PLAN-features-from-pvz.md` §3; `README.md`.

## D-002 — Snapshot loại dữ liệu vận hành, chỉ chiếu khóa quà cần thiết

- **Trạng thái:** ✅ Quy tắc nguồn hiện hành.
- **Quyết định:** CSV/code trong checkout game là nguồn của snapshot; không tuyên bố đã đồng bộ Google Sheets. Không mirror `Assets/CSV/giftcode.csv` hoặc `Assets/CSV/Compensate/**`. Để hiển thị quà theo yêu cầu, sync chỉ xuất `ID` → `Reward` cho Gift ID được config hiện hành tham chiếu; không lưu hoặc hiển thị Code, Name, Limit, Start, End, Reuse hay Rebirth.
- **Lý do:** Giữ phần dữ liệu vận hành riêng khỏi site GDD, đồng thời cho phép xem nội dung reward của gift đang được config dùng.
- **Nguồn:** `README.md`; `plans/PLAN-features-from-pvz.md` §5.

## D-003 — Không đổi tiến trình thành phút chơi khi chưa có income model

- **Trạng thái:** ✅ Giới hạn hiện tại đã được ghi nhận.
- **Quyết định:** Có thể hiển thị gate và giá trị cấu hình; không đưa ra phút tới mục tiêu hoặc kết luận retention nếu chưa xác nhận logic income và có dữ liệu phù hợp.
- **Lý do:** CSV Rebirth và spawn chưa đủ mô tả thu nhập trong base, hành vi trộm/phòng thủ hoặc thời gian chơi thực tế.
- **Nguồn:** `README.md` phần Data boundaries; `plans/PLAN-features-from-pvz.md` F10 và §5.
