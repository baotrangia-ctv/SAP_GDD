# UI Proposal · {{title}}

## 1. Bối cảnh và quy tắc
Project game: {{gameRoot}}
Project GDD: {{gddRoot}}
File đích: {{uiFile}}
Đề xuất nguồn: {{proposalFile}} · trạng thái {{status}}

Đây là prompt để dùng trong một phiên Codex riêng tại repo game. Chỉ sửa .ui,
sprite được liệt kê và code HUD liên quan thật sự cần cho đề xuất. Không đổi
gameplay/config, không đọc dữ liệu vận hành hoặc mở rộng phạm vi nguồn.
Dùng MCP Craftland xác nhận widget/field trước khi sửa. Giữ _entityId và
EResKey* đang được code tham chiếu; không tự sinh lại ID của entity hiện hữu.
Patch dùng schema chuẩn hóa GDD; phải đối chiếu serialization .ui trước khi áp.

## 2. Mục tiêu
{{summary}}

## 3. Thao tác theo entity ({{operationCount}})
{{operations}}

## 4. Sprite mới hoặc đổi
{{sprites}}

## 5. Binding .fcg và phần cần dev
{{bindings}}

{{devWork}}

## 6. Nghiệm thu
- So cây .ui trước/sau theo path và _entityId; đủ mọi thao tác, không có entity
  mồ côi, ID trùng hoặc mất binding EResKey*.
- Đối chiếu sprite PNG và border 9-grid khai báo; không đoán border/import ID.
- Kiểm trong Craftland Editor ở phiên game: tương tác, inactive, layout, các
  trạng thái runtime; GDD không chạy Editor/build.
- Báo cáo before/after từng field, file đã sửa và chỗ chưa xác minh. Preview
  web chỉ so sánh tương đối; scaler, font và thuật toán render chưa có parity
  runtime được xác nhận (design/20-dev-action-items.md DA-002–015).
