# Việc kỹ thuật còn mở

Chỉ ghi các việc cần xác minh có bằng chứng từ snapshot/code. Không ghi đề xuất balance chưa được duyệt.

| ID | Việc | Bằng chứng | Trạng thái |
|---|---|---|---|
| DA-001 | Đối chiếu ghi chú rate-test trong `HudDebug.fcg` với modifier thực tế trong `PetParadeManager.fcg` trên build đang phát hành. | Snapshot hiện tại phát hiện ghi chú nói road spawn không áp dụng daily modifier, trong khi nhánh tính trọng số có gọi `DailyPoolConfigs.GetDailyModifier(petId)`. | Mở · cần xác nhận build |
| DA-002 | Cấp/đối chiếu 7 sprite HUD thiếu. | `dist/data/ui/collection-sprites.json` ghi 2 `lib://fftextures`, 4 `Assets/_Test/**`, 1 `Assets/Sprites/UIComponents/Backgrounds/BG.png` không có trong checkout. `ShadowTriangleRounded.png` đã tìm thấy ở `Assets/Sprites/Shapes/` và sửa mapping. | Mở · cần asset gốc |
| DA-003 | Xác nhận độ phân giải tham chiếu và primitive render của Studio bằng ảnh game. | `.ui` cho root `sizeDelta=1500×750` nhưng không khai báo engine canvas; renderer web dùng font stack, tint/multiply, 9-slice và outline xấp xỉ. | Mở · cần ảnh chụp game |
| DA-004 | Đối chiếu đường đi Obtain/Recipe và routing đóng với build game. | `HudCollection.fcg` gọi `PetConfigs.GetPetObtainSource` (có tham số pool Fishing/Dig); preview chưa có đầy đủ phép tra pool trong bước này. `CloseCollection` đã rõ, nhưng handler `DarkBG`/`PreventCloseButton` nằm ngoài hai `.fcg` chính. | Mở · cần xác minh runtime |
| DA-005 | Xem 76 trường HUD chưa được renderer xử lý trước khi tuyên bố tương đương hình ảnh. | Audit thấy 57 entity có trường chưa hỗ trợ, chủ yếu button callback và `m_ApplyingPreviewAnimation`; có `ecaScripts` trên 1 entity. | Mở · cần đối chiếu visual/runtime |
| DA-006 | Xác nhận engine ưu tiên border meta hay border trong `.ui`, xử lý entity nhỏ hơn tổng border, tiled và gradient/tint. | MCP `FillType` xác nhận enum nhưng không mô tả thuật toán cắt hoặc thứ tự ưu tiên. `.ui` dùng `fillType=1`, `slicedBorder=0`, trong khi `NormalTabBG.png.meta` có border 20 px; CSS `border-image` là phép dựng lại có kiểm chứng dữ liệu, chưa xác nhận pixel-parity. | Mở · cần thông số Editor/ảnh game |
| DA-007 | Bổ sung 8 key pet Halloween trong localization nguồn hoặc xác nhận fallback game. | `collection-i18n.json` thiếu `BULL_PUMPKIN`, `CHICK_PUMPKIN`, `GIRAFFE_PUMPKIN`, `GORILLA_PUMPKIN`, `JELLYFISH_PUMPKIN`, `PENGUIN_PUMPKIN`, `SQUID_PUMPKIN`, `WILDBOAR_PUMPKIN`; các key này đến từ tên Pet.csv, không có trong `key.csv`. | Mở · cần localization nguồn |
| DA-008 | Đối chiếu sprite pet/mutation/weather và nguồn Obtain Fishing/Dig/Event theo runtime. | `HudCollection.fcg` gán `Res.Sprite[...]` từ config và `GetPetObtainSource` nhận pool Fishing/Dig; preview đang dùng icon snapshot GDD và chỉ map chính xác các icon Obtain có tên `EResSprite` trong `PetConfigs.fcg`. Không tìm thấy file/bảng generated `EResSprite`/`Res.Sprite` trong checkout cho mọi key. | Mở · cần bảng resource hoặc ảnh game |

Các mục UI Preview trên là giới hạn đã quan sát từ nguồn được phép đọc, chưa phải đề xuất đổi game.
