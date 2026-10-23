# Prompt cho Codex — UI Preview: sửa lệch render so với game, bỏ hover, thêm Widget Inspector (chuột phải)

Dán khối dưới vào Codex (MCP craftland bật), chạy từ `C:\_Code\craftland\_Users\SAP_GDD`.

````text
Project GDD tĩnh: C:\_Code\craftland\_Users\SAP_GDD. Đọc trước: CLAUDE.md, AGENTS.md, plans/PLAN-ui-preview.md, design/00-decisions.md, design/20-dev-action-items.md, tools/sync-ui-preview.mjs, tools/audit-ui-preview.mjs, dist/app-ui-renderer.js, dist/app-ui-collection.js, dist/app-uipreview.js, các rule .ui-* trong dist/styles.css, dist/data/ui/*.json.
Nguồn game (chỉ đọc): C:\_Code\craftland\StealAPet — Assets/HUDs/PetsCollection.ui, Assets/Scripts/HUDs/HudCollection.fcg, Assets/Scripts/ClientConfigs/PetConfigs_Client.fcg, và các file được CLAUDE.md cho phép. Dùng MCP craftland để xác nhận cách Craftland Editor/runtime render từng loại widget (UIImageEntity, UIButtonEntity, UITextEntity, UILayoutEntityV2, UIEmptyEntity): font, cỡ chữ, line spacing, overflow, alignment, shadow/outline, gradient, tint Color, 9-grid, fill, flip, layout grid (corner/direction/constraint/sortType/ignoreInactive/tableOffset/tableSpace), RectTransform, priority/z-order, alpha, và UI scaler (độ phân giải tham chiếu, match width/height, safe area trên mobile). Cái gì không xác minh được thì ghi design/20-dev-action-items.md, không đoán.

UI này dùng trên MOBILE → không có hover.

## A. Kết quả review code hiện tại (đã đối chiếu; hãy xác minh lại từng điểm rồi sửa)

### A1. Màu / rarity / tint — sai nguồn và sai cách tô
- Web dùng `colors` của trang GDD (app-core.js dòng 3: COMMON #84e1a4, RARE #6bcdf2…) để tô Rarity card, RarityBG. Game dùng `PetConfigs.GetRarityColor(rarity)` = `RARITY_COLOR[rarity]` trong PetConfigs_Client.fcg (~dòng 430). Phải lấy bảng RARITY_COLOR từ .fcg qua sync (collection-rules.json), không dùng palette của site.
- HudCollection.fcg đặt: `rarity.Color`/`thumbnail.Color = DEFAULT_COLOR (#111111)` cho pet chưa sở hữu (~dòng 376-390, 418-424); `_RarityBG.Color = GetRarityColor(rarity)` (~430); `rarityName.OutlineColor = GetRarityColor(rarity)` (~434, web chưa làm); icon mutation/weather `Color = OWNED #FFFFFF / NOT_OWNED #444444` (~736-753); `UpdateAnyRarityPetWidget` đặt rarity.Color (~848); tab label `Color = ACTIVE #FFFFFF / DEFAULT #1F64C4`. Web đang thay bằng `filter: brightness(...)`, ẩn sprite rarity (`display:none`) rồi tô backgroundColor lên layer → tô màu tràn ra cả vùng trong suốt của sprite (mất bo góc/hình dạng), khác cơ chế tint nhân màu (sprite RGB × Color, giữ nguyên alpha sprite) của engine. 
- Yêu cầu: viết MỘT hàm tint dùng chung cho mọi image/button/icon (vd CSS mask-image bằng chính sprite + background-color + mix, hoặc canvas/SVG feColorMatrix) mô phỏng đúng phép nhân màu giữ alpha; thay mọi chỗ dùng brightness()/backgroundColor+multiply. Màu tint hiện tại phải đọc từ state/rule, không rải trong JS. Tương tự cho `Color` trong props image/button (.ui) và `gradient` của image (có image gradient=1 ×9, =2 ×1 trong .ui; gradientTop/Bottom đang bị bỏ qua).
- Rà toàn bộ HudCollection.fcg: liệt kê MỌI nơi gán `.Color`, `.OutlineColor`, `.SpriteName`, `.SpriteResource`, `.Content`, `.IsVisible`, `.Size`, `.Position`, `.Alpha`… và đối chiếu với web; thiếu chỗ nào thì thêm (vd `_MWLayout.Size = (X, newHeight)` ~dòng 762-771 web chưa resize MWLayout theo số dòng icon).

### A2. Layout (UILayoutEntityV2) — đang xấp xỉ, nhiều chỗ lệch
- Có 2 bản logic bố trí trùng nhau: `layoutPosition()` trong app-ui-renderer.js và `resizeGridItem()` + công thức MWGrid hard-code (`rules.mwGrid`) trong app-ui-collection.js. Cả hai bỏ qua `corner`, `constraint` (fixedRowCount/fixedColumnCount), `sortType`, `ignoreInactive`, `tableOffset/tableSpace`, `offset.down`; coi `direction===1` là "1 cột" bằng heuristic; index tính cả child inactive; ghi đè left/top/width/height bằng cell size và bỏ qua anchor/pivot của child.
- Cả 4 layout trong .ui đều là grid: RarityTabsLayout (direction 1, size 190×50, space 0×7), PetsLayout (direction 0, size 100×100, space 4×8), DetailsTabsLayout (direction 0, 108×60, space 6×0), MWLayout (direction 0, 50×50, space 6×4).
- Yêu cầu: xác minh semantic từng field bằng MCP craftland, rồi viết MỘT layout engine trong renderer (đọc props từ JSON, không hard-code theo tên entity), gọi lại mỗi khi visibility/số child đổi (clone thẻ pet, icon M/W, tab ẩn/hiện) và khi layout bị đổi Size runtime. Xóa các công thức trùng lặp trong app-ui-collection.js; số cột/hàng, thứ tự (sortType/corner), alignment phải đến từ layout engine. Đối chiếu số cột/hàng thực tế với `MW_LAYOUT_MAX_ICONS_PER_ROW`, `MW_ICON_SIZE`, `MW_LAYOUT_VERTICAL_SPACING` và page size trong .fcg.

### A3. Text (UITextEntity) — thiếu nhiều thuộc tính
- Đang áp: fontSize, color, bold/italic/underline, alignment h/v, shadow (blur 1px cố định, bỏ shadowAlpha), outline bằng `-webkit-text-stroke` (stroke căn giữa nên ăn vào chữ, khác outline của engine, bỏ outlineAlpha), line-height cố định 1.15, font-family Arial.
- Bỏ qua: `font` ("Default"), `lineSpacing`, `overflow`, `background`/`backgroundColor`/`backgroundRGBA`, `gradient`/`gradientTop`/`gradientBottom`, `shadowAlpha`, `outlineAlpha`; text luôn `white-space:pre-wrap` không clip theo overflow/RectTransform; chưa có auto-size/shrink nếu engine có.
- Yêu cầu: xác nhận bằng MCP cách engine tính line height/baseline, wrap, clip/overflow (giá trị 0/1/2…), font mặc định (chọn web font gần nhất, nhúng được/offline nếu cho phép; ghi sai lệch đã biết), outline (vẽ đủ 8 hướng hoặc `paint-order:stroke fill`), shadow offset+alpha, gradient chữ. Áp dụng thuộc tính theo ĐÚNG giá trị trong .ui, và các chỗ runtime đổi (Content, Color, OutlineColor, nội dung có rich-text/LocString) theo fcg. Kiểm tra từng text node: không tràn khỏi RectTransform trừ khi game cho phép.

### A4. RectTransform / z-order / scale
- `rect()` tính anchor/pivot/sizeDelta/anchoredPosition đúng công thức, NHƯNG: `transform.rotate` xoay quanh tâm CSS mặc định thay vì pivot (cần transform-origin = pivot) và dấu góc cần xác nhận; `priority` chỉ lưu vào dataset, không ảnh hưởng thứ tự vẽ/raycast (cần xác nhận engine dùng priority hay thứ tự child, sau đó cài z-index/DOM order tương ứng); `fillType` (1 sliced, 2 tiled, 3 filled), `flip`, `reverse`, `fillDir/invertFill` mới hỗ trợ một phần (fill chỉ dir 0).
- Khung preview 1500×750 chỉ SUY từ sizeDelta của root, "độ phân giải engine chưa xác minh". Dùng MCP craftland để xác nhận UI scaler thật (reference resolution, match mode, safe area/notch) và cách HUD này neo vào màn hình mobile; cho phép chọn preset thiết bị (vd tỉ lệ 16:9, 18:9, 20:9, 4:3) để xem layout co giãn như game khi tỉ lệ đổi, thay vì scale cứng một khung. Nếu chưa xác minh được, ghi rõ trên UI + dev-action-items.
- Sửa các chỗ clone template (cloneNode) để node clone vẫn có data attribute nhận diện (path template + index) phục vụ Inspector.

### A5. Hover — phải bỏ hoàn toàn (mobile)
Xóa: `pointerenter`/`pointerleave` tint highlight trong renderer; `el.title = ...` (tooltip khi hover: đường dẫn entity, "Sprite thiếu", `el.title = row.Name` của icon M/W); `.ui-debug .ui-entity:hover::after`; `cursor:pointer` và mọi `:hover` của UI preview + bảng resource (`.ui-resource-panel tr:hover`, nút toolbar/tab sub-tab nếu chỉ là hiệu ứng hover). Highlight trạng thái "highlight" của button không dùng (mobile không có); chỉ giữ normal / pressed (khi chạm giữ) / disabled. Pressed phải về normal khi pointerup/pointercancel/pointerleave (hiện pointerup đặt về màu highlight → màu kẹt sau khi tap). Dùng `@media (hover:hover)` không phải lời giải; xóa hẳn. Giữ `touch-action` hợp lý để bấm không zoom/scroll nhầm.

## B. Tính năng mới: Widget Inspector (bấm chuột phải)
- Chuột phải (`contextmenu`) trên vùng canvas UI → `preventDefault()` chỉ trong canvas, hiện popup thông tin widget; (tuỳ chọn) nhấn giữ ~500ms trên màn cảm ứng cũng mở. Ngoài canvas giữ context menu mặc định.
- Do mọi entity không phải button có `pointer-events:none`, KHÔNG dựa vào event.target: hit-test hình học (so toạ độ con trỏ với getBoundingClientRect đã tính cả scale/rotation, hoặc `document.elementsFromPoint` + bật tạm hit-testing) để lấy TẤT CẢ entity chứa điểm bấm, kể cả entity inactive nếu đang bật "hiện inactive" và entity alpha 0. Popup có danh sách các entity chồng nhau tại điểm đó (trên → dưới theo thứ tự vẽ), mặc định chọn entity trên cùng nhìn thấy được; chọn dòng khác để xem entity đó.
- Nội dung popup (lấy từ JSON sinh ra, không bịa): 
  1. Định danh: tên, path đầy đủ, `_entityId`, widget type (UIImageEntity/…), loại clone (nếu là thẻ nhân bản từ template: template path + index), active (.ui) và đang hiển thị (runtime).
  2. Transform: anchorMin, anchorMax, pivot, anchoredPosition, sizeDelta, rotate; rect tính ra theo px (left/top/width/height trong khung tham chiếu và theo parent), tên parent.
  3. alpha, priority, z-order thực tế, layout cha chứa nó (nếu có) và index trong layout.
  4. Toàn bộ thuộc tính của widget trong .ui (props image/button/text/layout, mọi field, kể cả field renderer chưa hỗ trợ — vì vậy sync phải giữ NGUYÊN `propsData` đầy đủ của từng entity, không chỉ whitelist; field renderer chưa dùng đánh dấu "chưa hỗ trợ"), kèm `ecaProps`/key `EResKeyPetsCollection` nếu có.
  5. Giá trị runtime đang áp so với giá trị gốc trong .ui (sprite hiện tại, Color/tint, Content/LocString key + chuỗi, IsVisible, Size…), có nhãn nguồn (.ui hay HudCollection.fcg:dòng) khi đã xác định.
  6. Với sprite: tên, file, kích thước px, border 9-grid, chế độ image (simple/sliced/tiled/filled).
- Hành vi: popup đặt trong viewport, KHÔNG scroll trang, KHÔNG đổi hash, không chiếm click của UI; đóng bằng Esc / bấm ngoài / nút đóng; nút "Sao chép JSON" (clipboard, bọc try/catch). Chuột phải không kích hoạt hành vi click của button game. Có thể đánh dấu viền entity được chọn trên canvas (outline, không hover). Bảng "Resource đang dùng" vẫn chỉ hiển thị.
- Thêm module riêng dist/app-ui-inspector.js, nạp trong index.html; text tiếng Việt; popup dùng được trên màn nhỏ.

## C. Quy tắc cứng
CLAUDE.md: site tĩnh trong dist/, vanilla JS, không build step; trình duyệt chỉ đọc JSON sinh từ tools/*.mjs; project game chỉ đọc; không mở rộng allowlist ngoài CLAUDE.md (bảng RARITY_COLOR nằm trong .fcg được phép đọc). Không hard-code dữ liệu config vào JS. Không bịa — điều chưa xác minh ghi vào design/20-dev-action-items.md. Commit local Conventional Commits (AGENTS.md), mỗi bước một commit, không push/amend/reset.

## D. Việc cần làm (mỗi bước một commit)
D1 fix(ui): bỏ hoàn toàn hover (title, :hover, pointerenter/leave, highlight tint), pressed→normal đúng; test grep không còn sót.
D2 feat(sync): giữ nguyên propsData đầy đủ + RARITY_COLOR và mọi rule màu/size/visibility runtime từ fcg vào JSON; cập nhật audit.
D3 fix(ui): hàm tint dùng chung (giữ alpha sprite), rarity màu theo game, outline rarity name, pet unowned #111111, icon M/W #444444, image gradient; bỏ brightness()/backgroundColor lên layer.
D4 refactor(ui): một layout engine duy nhất (grid đủ field), gọi lại khi đổi visibility/size, resize MWLayout theo fcg; xóa công thức trùng.
D5 fix(ui): text đầy đủ thuộc tính (font, lineSpacing, overflow, outline/shadow chuẩn, gradient, background) + rotate quanh pivot + priority/z-order + fill/flip còn thiếu; UI scaler/preset tỉ lệ màn hình theo xác nhận MCP.
D6 feat(ui): Widget Inspector (chuột phải / nhấn giữ).
D7 test(ui): mở rộng tools/audit-ui-preview.mjs (không hover, màu rarity khớp RARITY_COLOR, layout vị trí khớp engine, đủ propsData, inspector có đủ field), chạy `node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"` + audit, serve `python -m http.server 8080 --directory dist`, kiểm thủ công mọi rarity tab, pet owned/unowned, 3 details tab, Recipe, page cuối, màn nhỏ, console sạch; cập nhật README/design.

## Báo cáo cuối
Liệt kê: commit đã tạo; từng điểm trong A1–A5 đã xác nhận đúng/sai và đã sửa thế nào; quy tắc engine xác nhận được (nguồn MCP/.ui/.fcg) và phần chưa xác minh; bảng so sánh vị trí/size/màu của ít nhất 10 widget quan trọng giữa web và game; xác nhận không còn hover; mô tả Inspector. Không tuyên bố "khớp game" nếu chưa kiểm.
````
