# UI Proposal · Collection · ví dụ để kiểm pipeline

## 1. Bối cảnh và quy tắc
Project game: C:\_Code\craftland\StealAPet
Project GDD: C:\_Code\craftland\_Users\SAP_GDD
File đích: Assets/HUDs/PetsCollection.ui
Đề xuất nguồn: design/ui-proposals/collection/collection-pipeline-example.json · trạng thái draft

Đây là prompt để dùng trong một phiên Codex riêng tại repo game. Chỉ sửa .ui,
sprite được liệt kê và code HUD liên quan thật sự cần cho đề xuất. Không đổi
gameplay/config, không đọc dữ liệu vận hành hoặc mở rộng phạm vi nguồn.
Dùng MCP Craftland xác nhận widget/field trước khi sửa. Giữ _entityId và
EResKey* đang được code tham chiếu; không tự sinh lại ID của entity hiện hữu.
Patch dùng schema chuẩn hóa GDD; phải đối chiếu serialization .ui trước khi áp.

## 2. Mục tiêu
Ví dụ để kiểm pipeline: dịch label tiêu đề 4 đơn vị và thay sprite trang trí bằng sprite đã có. Chưa phải thiết kế đã duyệt; không đổi balance.

## 3. Thao tác theo entity (2)
| # | Path / sau move | _entityId | Op / field | Cũ → mới | Reason |
|---|---|---|---|---|---|
| 1 | PetsCollection/Container/Title/Label | JRxpWV4m | set · transform.anchoredPosition.x | 40 → 44 | Ví dụ để kiểm pipeline: kiểm so sánh vị trí label trước/sau. |
| 2 | PetsCollection/Container/BG/DecorLeft | gr8BcPhJ | replaceSprite · image.spriteKey | Assets/_Test/NewUI/Assets/Img_decorate01.png → Assets/Sprites/Shapes/ShadowTriangleRounded.png | Ví dụ để kiểm pipeline: kiểm manifest bằng một sprite đã có file, chưa phải art được duyệt. |

## 4. Sprite mới hoặc đổi
- Assets/Sprites/Shapes/ShadowTriangleRounded.png · game; bản GDD ./assets/ui-sprites/collection/Shapes__ShadowTriangleRounded.png · PNG 256×256 · 9-grid {"left":0,"right":0,"top":0,"bottom":0}

## 5. Binding .fcg và phần cần dev
- Assets/Scripts/HUDs/HudCollection.fcg:132 · JRxpWV4m · PetsCollection/Container/Title/Label · child-name-candidate · Trùng tên: cần dev xác nhận identity/alias, chưa khẳng định binding chính xác
- Assets/Scripts/HUDs/HudCollection.fcg:662 · JRxpWV4m · PetsCollection/Container/Title/Label · child-name-candidate · Trùng tên: cần dev xác nhận identity/alias, chưa khẳng định binding chính xác
- Assets/Scripts/HUDs/HudCollection.fcg:663 · JRxpWV4m · PetsCollection/Container/Title/Label · child-name-candidate · Trùng tên: cần dev xác nhận identity/alias, chưa khẳng định binding chính xác
- Assets/Scripts/HUDs/HudCollection.fcg:664 · JRxpWV4m · PetsCollection/Container/Title/Label · child-name-candidate · Trùng tên: cần dev xác nhận identity/alias, chưa khẳng định binding chính xác

Cần dev: xác nhận alias, các assignment runtime và thứ tự GetChildByIndex/GetChildren trước mọi add/remove/move; widget thêm mới cần dev viết code binding/ecaScripts nếu có hành vi. Không tự suy hoặc tự tạo binding mới.
Tập quét: Assets/Scripts/HUDs/HudCollection.fcg, Assets/Scripts/Manager/CollectionManager.fcg, Assets/Scripts/Configs/PetConfigs.fcg, Assets/Scripts/ClientConfigs/PetConfigs_Client.fcg. Không phải phân tích luồng dữ liệu toàn bộ code.

## 6. Nghiệm thu
- So cây .ui trước/sau theo path và _entityId; đủ mọi thao tác, không có entity
  mồ côi, ID trùng hoặc mất binding EResKey*.
- Đối chiếu sprite PNG và border 9-grid khai báo; không đoán border/import ID.
- Kiểm trong Craftland Editor ở phiên game: tương tác, inactive, layout, các
  trạng thái runtime; GDD không chạy Editor/build.
- Báo cáo before/after từng field, file đã sửa và chỗ chưa xác minh. Preview
  web chỉ so sánh tương đối; scaler, font và thuật toán render chưa có parity
  runtime được xác nhận (design/20-dev-action-items.md DA-002–015).
