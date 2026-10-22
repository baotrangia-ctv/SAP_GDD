# Knowledge pack — Steal A Pet GDD

Ghi chú nhanh để tiếp tục công việc mà không phải đọc lại toàn bộ lịch sử.

## Nguồn và cách đọc

- `plans/PLAN-features-from-pvz.md`: phạm vi và thứ tự làm.
- `00-decisions.md`: quyết định đã chốt.
- `20-dev-action-items.md`: việc kỹ thuật đang chờ xác minh.
- `README.md` ở thư mục gốc: chức năng site hiện tại và giới hạn dữ liệu.
- CSV là nguồn giá trị cấu hình; `.fcg` là nguồn logic được phép đọc để xác nhận cách dùng các giá trị đó.

## Nguyên tắc balance của project

- Không đổi cấu hình thành thời gian chơi nếu chưa có mô hình income được xác nhận.
- Không quy đổi reward ID hoặc type sang tiền/pet khi chưa có bảng/code chứng minh mapping.
- Phân biệt giá trị cấu hình, phép tính dẫn xuất và mục tiêu do designer đặt.
- Mọi dữ liệu dẫn xuất được tạo offline bằng `tools/*.mjs`; trang tĩnh chỉ đọc JSON.
- Dữ liệu operational như giftcode và compensation không thuộc snapshot.

## Quy trình ngắn

Đọc `CLAUDE.md` → kiểm tra CSV/`.fcg` liên quan → sửa generator/UI → sync → serve `dist/` và rà desktop/mobile/console → commit local theo từng update. Không push.
