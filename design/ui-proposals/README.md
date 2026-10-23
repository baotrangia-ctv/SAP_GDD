# UI Proposal — hợp đồng dữ liệu v1

Spec chính: `plans/PLAN-ui-proposal.md` §3. Chỉ Collection được đăng ký.
Đề xuất là dữ liệu do GDD sở hữu. `collection/collection-pipeline-example.json`
là **ví dụ để kiểm pipeline**, trạng thái draft, chưa phải thiết kế được duyệt.

## Schema và identity

Schema: `proposal.schema.json`; validator semantic: `tools/sync-ui-proposals.mjs`;
tập field chính xác: `tools/ui-proposal-fields.mjs`.

```json
{
  "id": "collection-example",
  "screen": "collection",
  "title": "Tên đề xuất",
  "author": "Người đề xuất",
  "status": "draft",
  "summary": "Mục tiêu đã được người đề xuất quyết định.",
  "ops": [
    { "op": "set", "path": "PetsCollection/Container/Title/Label",
      "id": "JRxpWV4m", "field": "text.fontSize", "value": 36,
      "reason": "Giải thích quyết định thiết kế." }
  ],
  "newAssets": []
}
```

id dùng chữ thường/số/gạch nối, trùng tên file và duy nhất toàn registry;
screen trùng thư mục; status là draft/review/approved. File dẫn xuất không
được va tên (kể cả registry hoặc `<id>-diff`). Mỗi op có reason không rỗng.
Field sai component/kiểu, ID trùng, cycle, path thiếu, sprite chưa đăng ký/
thiếu hoặc asset vượt ranh giới làm cả batch lỗi trước lần ghi đầu tiên.
Không đọc giá trị `$schema` như một đường dẫn nguồn.

Path giữ nguyên tên thật, gồm root PetsCollection. Recipe nguồn có hai nhánh
cùng path `PetsCollection/Container/Recipe/Pet`; phải thêm id để chọn entity;
add/move dùng parentId nếu parent trùng path. Không tự sửa tên/ID nguồn hoặc
tái dùng ID đã remove trong cùng patch.

| Op | Field riêng | Ý nghĩa |
|---|---|---|
| set | path, id?, field, value | Đổi một leaf field trong whitelist |
| replaceSprite | path, id?, sprite | Thay image/button spriteKey bằng key có file |
| add | parent, parentId?, index?, entity | Thêm entity chuẩn hóa; id/name/type bắt buộc; children lồng nhau |
| remove | path, id? | Bỏ subtree; không bỏ root |
| move | path, id?, parent, parentId?, index? | Chuyển/reorder, giữ ID và cập nhật path hậu duệ |

index tính sau detach khi move, mặc định cuối. Entity mới nhận UIEmptyEntity,
UIImageEntity, UIButtonEntity, UITextEntity, UILayoutEntityV2; không tự thêm
ecaScripts/EResKey. Mặc định active=true, alpha=100; field visual/transform
khác do JSON người đề xuất khai. Không tự thiết kế kích thước hoặc binding.

## Tập 74 leaf field của set/add

Ký hiệu x/y và danh sách phân cách bằng dấu / mở rộng thành các leaf độc lập.
Không set cả object, identity, propsData hoặc ecaProps. Sprite hiện hữu đổi
bằng replaceSprite; entity mới khai image.spriteKey/button.spriteKey.

| Nhóm | Field trong nhóm |
|---|---|
| Entity | active, alpha |
| transform | anchorMin.x/y, anchorMax.x/y, pivot.x/y, anchoredPosition.x/y, sizeDelta.x/y, rotate |
| image | color, fillType, fillDir, fillAmount, centerInvisible, invertFill, reverse.x/y |
| button | normal, pressed, disabled, fillType, fillDir, fillAmount, centerInvisible, invertFill, reverse.x/y, disableCollider |
| text | value, key, fontSize, color, shadowColor, outlineColor, backgroundColor, lineSpacing, shadowOffset.x/y, outlineOffset, outlineAlpha, shadowAlpha, shadow, outline, background, fontStyle.bold/italic/underline, alignment.h/v |
| layout | enable, ignoreInactive, corner, constraint, direction, fixedRowCount, fixedColumnCount, sortType, size.x/y, space.x/y, offset.left/right/up/down, tableOffset.left/right/up/down, tableSpace |

Alpha dùng thang .ui 0–100; outlineAlpha/shadowAlpha/fillAmount 0–1;
fontSize là số nguyên dương. Màu hex #RGB/#RRGGBB/#RRGGBBAA;
alignment.h=left/center/right, .v=top/middle/bottom. Số phải hữu hạn.
FillType=0/1/2/3/5; fillDir=0–4; layout.corner=0–3, constraint=0–2,
direction=0–1, sortType=0–2 theo nhánh renderer đã hỗ trợ, chưa khẳng định
đây là toàn bộ enum engine. Font/overflow/gradient/animation/priority chưa
được mở cho patch; validator từ chối thay vì bỏ qua.

**Nguồn xác minh 2026-10-23:** MCP Craftland `ScriptManual/Types/UIWidget`
(IsVisible, AnchorMin/Max, AnchorPosition, SizeDelta, Pivot, Angle),
`UIWidgetLabel` (Content, LocKey, FontSize, Color, alignment, styles,
LineSpacing, shadow/outline), `UIWidgetImage` và `UIWidgetButton` (sprite,
Color, Alpha, Fill, FillDirection/Amount, InvertFill, CenterInvisible,
DisableCollider), `FillType`, `FillDirectionType`. Tên serialization/scale
alpha/reverse/background/layout đối chiếu PetsCollection.ui, script sync
và renderer hiện hữu. MCP chưa xác nhận serialization/thuật toán LayoutV2;
đây là tập web đã hỗ trợ, chưa xác minh engine — DA-015. DA-002–014 giữ nguyên.

## Asset và output

PNG mới ở collection/assets/; khai key duy nhất proposal/<name> và border
{left,right,top,bottom} hữu hạn, không âm, không vượt kích thước PNG.
Border do người đề xuất khai, không suy đoán. Chỉ đọc asset ở đây hoặc
manifest UI đã sync; không đọc sprite game theo đường dẫn nhập trong patch.
Guard kiểm đường dẫn thật và symlink; output chỉ dưới dist của GDD.

`node tools/sync-ui-proposals.mjs` sinh `<id>.json`, `<id>-diff.json`,
`<id>-resources.json`, `<id>-prompt.md`, registry.json trong
dist/data/ui/proposals/; copy PNG vào dist/assets/ui-proposals/<screen>/<id>/.
Chạy lại cho byte output giống nhau. Chỉ file trong registry được UI tải;
file cũ ngoài registry không tự xóa. Không có tham số CLI mở screen/output
allowlist. Không đọc giftcode/Compensate trong pipeline Proposal.

Cây sau patch chỉ có entity còn sống, state added/changed/unchanged.
Subtree bị xóa nằm riêng trong removedEntities, state=removed, được xem
trên cây Hiện tại/Chồng lớp và bảng resource. diff.operations giữ mọi op
có reason, kể cả no-op; diff.changes chỉ giữ op có ảnh hưởng còn tồn tại
trong cây cuối. Patch rỗng hoặc set rồi hoàn tác có changes=[] và cây
visual giống gốc (bỏ annotation). propsData trong Inspector giữ dữ liệu
nguồn; field chuẩn hóa và “Thay đổi của đề xuất” mô tả sau patch.

## Prompt và binding

Prompt sinh từ tools/templates/ui-proposal-prompt.md, không viết tay.
Ví dụ fixture rút gọn:

```text
File đích: Assets/HUDs/PetsCollection.ui
1. .../Title/Label · JRxpWV4m · set transform.anchoredPosition.x
   40 → 44 · reason: ví dụ để kiểm pipeline
2. .../BG/DecorLeft · gr8BcPhJ · replaceSprite
   ...Img_decorate01.png → ...Shapes/ShadowTriangleRounded.png
PNG 256×256 · border 0/0/0/0
Binding candidate: Assets/Scripts/HUDs/HudCollection.fcg:132
Cần dev xác nhận identity/alias; không tự tạo binding.
```

Quét đúng bốn .fcg đã dùng bởi Collection sync: HudCollection,
CollectionManager, PetConfigs, PetConfigs_Client. Trùng ID là chứng cứ
trực tiếp; trùng tên/key là candidate, chưa khẳng định alias trỏ đúng
entity. Op cấu trúc xét cả cha/hậu duệ. Không có candidate không chứng minh
không có binding; GetChildByIndex/GetChildren/runtime alias cần dev kiểm.
Widget mới cần dev viết binding/hành vi. Nếu patch bỏ template thiết yếu,
cây vẫn render nhưng panel báo tương tác cần dev; các patch còn template
tiếp tục dùng mô phỏng Collection hiện có.

## Nghiệm thu

Audit tĩnh 153 case: đủ năm op, invalid batch không ghi, PNG mới/border/copy,
path/ID trùng, patch rỗng/hoàn tác, prompt, resource và idempotence.
Browser audit cần Playwright trong môi trường QA và Edge:

```powershell
node tools/audit-ui-proposals.mjs --browser-url http://localhost:8080
```

Report: dist/data/ui/proposals-audit.json; ảnh proposals-browser-1440.png và
proposals-browser-390.png cùng thư mục. Đã kiểm 1440×1100 và 390×844: ba
chế độ, opacity, Inspector right-click/chạm, clipboard thành công/bị từ chối,
lọc/tìm, deep-link, localStorage bị chặn, không tràn ngang/lỗi console.
Fixture cấu trúc chỉ intercept mạng trong audit, không thêm đề xuất vào GDD:
108 entity sau patch khớp DOM, lọc thêm/xóa và binding Collection còn lại
hoạt động. UI Preview hồi quy 107/107, 173 pet, 214 click/viewport, console
sạch. Đây là QA web so nguồn, chưa đối chiếu runtime Craftland.
