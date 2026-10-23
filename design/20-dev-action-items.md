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

## DA-009 · Alpha/raycast Collection (2026-10-23)

Đã hỏi MCP Craftland (`mcp__ffugcdocs`) và đọc:
- `ScriptManual/Types/UIWidgetButton`: Alpha (-41002), TopAlpha/BottomAlpha
  (-41017/-41018), DisableCollider (-41019) là thuộc tính riêng.
- `ScriptManual/Types/UIWidgetImage`: Alpha (-39002), TopAlpha/BottomAlpha;
  không liệt kê RaycastTarget hoặc collider cho Image.
- `ScriptManual/Types/UIWidgetLabel`: Alpha, ShadowAlpha, OutlineAlpha riêng.
- `ScriptManual/Types/UIWidget`: Priority, Depth, ChildIndex và RectTransform;
  không mô tả thuật toán sắp xếp/raycast.
- [HowToCreateUI](https://awp.garenanow.com/wiki/57528c29-7806-59c9-b3cb-90bfd8962246)
  xác nhận FF dùng NGUI. Tài liệu AddUGCCustomUIWidget/Attribute chỉ nêu các
  controller runtime, không có triển khai alpha/raycast.

Nguồn được phép đọc: `Assets/HUDs/PetsCollection.ui` có đúng bốn entity
alpha khác 100; cả ba button đều `disableCollider=false`, priority=0.
Mọi entity trong file có priority=0; mọi gradientTop/Bottom.a hiện bằng 1.
`HudCollection.fcg:918-925` chỉ chọn pet khi parent button nằm trong
_PetWidgets: button trên PetDetails không chọn pet. `:927-933` chỉ mở pet
nguyên liệu thứ hai. `UIUtils.fcg:36-50` ẩn button redirect khi không hợp lệ,
đồng thời bật italic/underline của tên khi hợp lệ.

**Chưa xác minh runtime:** ngưỡng alpha có ảnh hưởng collider không; alpha
của widget có nhân xuống con hay chỉ graphic; shader nhân màu/gradient/text/
outline/shadow như thế nào; Image có chặn click và cách priority/depth cùng
thứ tự cây chọn đối tượng trên cùng. Không có runtime/controller source
trong allowlist; không mở rộng đọc source engine hoặc chạy Studio.

Web dùng chính sách tạm ghi trong JSON `renderingPolicy`: giữ phép composite/cascade CSS
alpha/100 vốn có của preview, chưa đổi sang alpha riêng vì thiếu chứng cứ; hit target button
không phụ thuộc alpha và tắt khi disableCollider=true. Non-button xuyên
click; thứ tự cây quyết định lớp trên, không thêm z-index theo tên. Đây là
mô hình web, **chưa phải quy tắc engine đã xác nhận**. RarityName có alpha
gốc 100, web cộng dồn thành 90 dưới RarityBG=90; cần ảnh/runtime để chốt cascade.
Gradient alpha hiện đều 1 nên không thêm phép blend chưa có bằng chứng;
RGB gradient, tint, text outline/shadow vẫn thuộc giới hạn DA-003/006.
Bảng ghi alpha gốc và alpha cộng dồn web; không báo alpha hiệu dụng game
khi chưa biết cascade. Cần kiểm runtime bốn entity và vùng chồng lấn trước
khi đóng DA-009 hoặc tuyên bố khớp game.

## DA-010 · UI image tint/gradient output (2026-10-23)

MCP Craftland `脚本手册/UGC_Wiki_Entities` xác nhận `UIWidgetImage.Color`
là `Color`; `Gradient` là `int`; `GradientTop` và `GradientBottom` là hai
màu ở đầu/trên và cuối/dưới. Tài liệu không liệt kê ý nghĩa số của các mode
`Gradient`. Trong `PetsCollection.ui`, 9 image dùng `gradient=1`, một image
dùng `gradient=2`; mọi màu đầu/cuối có alpha 1.

Preview dùng phép nhân từng kênh RGB giữa pixel sprite, `Color` và nội suy
dọc từ `gradientTop` đến `gradientBottom` khi `gradient > 0`; alpha sprite
được giữ nguyên. Đây là mô hình preview theo cấu trúc trường `.ui`, chưa được
đối chiếu pixel với runtime. Cần xác minh các mode gradient 1/2, phép nhân
Color và kết quả trên sprite 9-grid bằng Editor hoặc ảnh runtime trước khi
tuyên bố parity.

## DA-011 · UILayoutEntityV2 grid semantics (2026-10-23)

MCP Craftland `脚本手册/UGC_Wiki_Entities` ghi nhận các trường của
`UIWidgetLayout` đời cũ: `CellSize`, `CellSpace`, `Constraint`,
`ConstraintCount`, offset dọc/ngang, `SortType` và `IgnoreInactive`. Tài liệu
nói `IgnoreInactive` sắp child active trước rồi đến inactive; `LayoutSortType`
có các giá trị 0 theo hierarchy, 1 priority cao xuống thấp, 2 priority thấp
lên cao. `FillDirectionType` định nghĩa ngang=0, dọc=1. Tài liệu không mô tả
`UILayoutEntityV2.corner`, `tableOffset`, `tableSpace` hoặc ý nghĩa fixed row /
fixed column của V2.

Bốn layout hiện có trong `.ui` dùng `constraint=0`, `corner=0`, table
offset/space bằng 0 và `sortType=0`; cell size/spacing khớp size icon M/W,
khoảng dọc và giới hạn năm cột trong FCG. Engine web ánh xạ corner thành bốn
góc bắt đầu, dùng table offset như padding cộng thêm, table space như khoảng
cách cell cộng thêm, và hiểu constraint 1/2 lần lượt là fixed row/column. Đây
Đây là giả định preview cho V2. Cần đối chiếu vị trí trong Editor/runtime trước
khi dùng cấu hình V2 khác 0 hoặc tuyên bố vị trí khớp game.

## DA-012 · Text, fill, rotation và viewport (2026-10-23)

MCP `脚本手册/UGC_Wiki_Entities` ghi các trường `UITextEntity` như `Font`,
`FontSize`, `LineSpacing`, `Overflow`, `ShadowColor/Offset/Alpha`,
`OutlineColor/Offset/Alpha`, cùng gradient/background; tài liệu chủ yếu mô tả
tên và kiểu, không nêu font `Default`, đơn vị/ý nghĩa line spacing, giá trị
Overflow, baseline/wrap, hay thuật toán vẽ text. `脚本手册/UGC_Wiki_Enum`
xác nhận `FillType` (0 Simple, 1 Sliced, 2 Tiled, 3 Filled, 5 Fit) và
`FillDirectionType` (0 Horizontal, 1 Vertical, 2/3/4 Radial90/180/360),
nhưng không giải thích điểm bắt đầu, chiều, cung fill, `InvertFill`, Fit, hoặc
`FlipType`. Trong `.ui` 33 text node đều `font=Default`, `lineSpacing=0`,
`overflow=0`; cả 68 image/button đều `flip=0`; ba progress image dùng
`Radial360`, `fillAmount` 0.3/0.5 và `invertFill=true`; có bốn `reverse.x`.
MCP Editor manual nói root/anchors thích ứng với tỉ lệ thiết bị nhưng không
cho reference resolution, match-width/height, hoặc safe area. Mọi rotation và
priority trong `.ui` đều bằng 0.

Preview dùng font stack offline của trang; `lineSpacing=0` dùng line-height
browser `normal`, giá trị dương map thành CSS unitless line-height; text bị
clip trong RectTransform; background/gradient/shadow/outline và các kiểu fill
được dựng bằng CSS. Rotation dùng pivot làm transform-origin, sign giữ theo
quy ước web cũ. Đây là mô hình hiển thị; line spacing, overflow=0, text
gradient, alpha/outline/shadow raster, radial fill geometry, Fit, numeric flip,
rotation sign, priority/depth và safe-area behavior vẫn chưa xác minh. Preset
16:9/18:9/20:9/4:3 chỉ đổi khung viewport và crop canvas; không khẳng định
đây là cách game scale HUD.
