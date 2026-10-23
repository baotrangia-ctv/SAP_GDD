# Plan: tab "UI Preview" — hiển thị UI game trên web (phase 1: Collection)

Mục tiêu: dựng lại UI thật của game (đọc từ file `.ui` của Studio) trên web, **1-1 về cây entity, anchor/size/vị trí, sprite, text**, và tương tác được như trong game. Phase này chỉ làm **PetsCollection**; kiến trúc phải cho phép thêm UI khác (Shop, Mail, Mission…) chỉ bằng thêm một mục registry + một module.

## 1. Kết quả khảo sát (đã kiểm chứng trong project game)

Project game thật nằm ở `C:\_Code\craftland\StealAPet` (CLAUDE.md đang ghi `D:\Craftland\StealAPet` → luôn truyền `--project-root`).

| Thành phần | File nguồn | Ghi chú |
|---|---|---|
| Layout/visual của UI | `Assets/HUDs/PetsCollection.ui` | JSON (~380 KB, 106 entity), **dòng cuối là comment `//"{FE:...}`** → cắt từ `\n//` trước khi `JSON.parse`. |
| Hành vi UI | `Assets/Scripts/HUDs/HudCollection.fcg` | Init widget qua `EResKeyPetsCollection.*`, rarity tab, phân trang, chi tiết pet, tab Info/Mutations/Weathers, Recipe, UnlockObtain. |
| Dữ liệu sở hữu | `Assets/Scripts/Manager/CollectionManager.fcg` | `IsOwnPet`, `GetPCMutationIdsByPetId`, `GetPCWeatherIdsByPetId`. |
| Dữ liệu tĩnh | `Assets/CSV/Pet.csv` (+ mutation/weather CSV đã có trong snapshot) | Danh sách pet theo rarity, tên, value. |
| Sprite | `Assets/Sprites/**` (khai báo trong `.ui` bằng `filePath`) | 7 sprite khác nhau trong `.ui`; **một số là `lib://fftextures/...` (thư viện engine, không có file)** → cần placeholder + ghi nhận thiếu. |
| Tài liệu logic | `Docs/BusinessLogic/94-ui-hud-framework.md`, `10-pets-core.md`, `16-pet-progression.md` | Collection là panel Tier 2, panel exclusivity qua `PlayerHudController`. |

Cây entity gốc của PetsCollection (để đối chiếu 1-1): `DarkBG`, `Container` → `PreventCloseButton`, `Title`(`Label`,`CloseButton`), `BG`(`DecorLeft`,`Main`,`DecorRight`), `RarityTabsLayout` (All/Common/Rare/Epic/Legendary/Mythic/Apex/Limited), `PetsLayout`, `PageBtns`(Prev/Page/Next), `PetDetails`, `DetailsTabsLayout`(Info/Mutations/Weathers), `Info`, `MutationsWeathers`(`MWLayout`), `UnlockObtain`, `Recipe`, `PetsCount`/`MutationsCount`/`WeathersCount`, `LoadingLabel`. Loại entity: Root, Button, Image, Text, LayoutV2, Empty.

## 2. Xung đột với quy tắc cứng — cần chốt trước khi code

`CLAUDE.md` hiện chỉ cho đọc **CSV trong `Assets/CSV/**` và `.fcg`** từ project game. Tính năng này cần thêm **hai nguồn đọc-only**:
1. `Assets/HUDs/*.ui` (cụ thể phase này: `PetsCollection.ui`),
2. file sprite `.png` mà `.ui` tham chiếu (copy vào `dist/assets/ui-sprites/`; đã có tiền lệ copy sprite weather).

**Đề xuất quyết định D-xx** (người dùng yêu cầu tính năng này nên coi là đồng ý, nhưng phải ghi lại): mở rộng allowlist **chỉ** cho `Assets/HUDs/<danh sách UI đã đăng ký>.ui` và sprite được `.ui` đó tham chiếu; vẫn **chỉ đọc**, vẫn không ghi/tạo file/chạy lệnh Git ghi ở repo game, output vẫn neo trong `dist/`. Cập nhật `CLAUDE.md` (dòng quy tắc `D:\Craftland\StealAPet` → đường dẫn đúng + allowlist mới) và `design/00-decisions.md` **trước** khi sửa code sync.

## 3. Kiến trúc

Giữ site tĩnh, vanilla JS, không build step. Trình duyệt chỉ đọc JSON + sprite.

```
tools/sync-source-data.mjs   (hoặc tools/sync-ui-preview.mjs, gọi từ sync chính)
  ├─ parse Assets/HUDs/PetsCollection.ui  → dist/data/ui/collection.json   (cây đã chuẩn hoá)
  ├─ trích rule từ HudCollection.fcg/CollectionManager.fcg → dist/data/ui/collection-rules.json
  └─ copy sprite tham chiếu → dist/assets/ui-sprites/collection/  (+ manifest, ghi missing)

dist/data/ui/registry.json   danh sách UI: id, tên, nhóm, file data, status (ready | planned)
dist/app-ui-renderer.js      renderer generic: entity tree → DOM
dist/app-uipreview.js        trang "UI Preview": sub-tab theo loại UI, khung thiết bị, toolbar
dist/app-ui-collection.js    binding + hành vi riêng của Collection
```

### 3.1 JSON chuẩn hoá (mỗi entity)
`path` (đường dẫn tên, giữ trùng tên entity gốc, kể cả `Pet (1)`), `id` (`_entityId`), `name`, `type`, `active`, `transform` (anchorMin/Max, pivot, anchoredPosition, sizeDelta, rotate), `alpha`, `image`/`button` (sprite key, màu normal/highlight/pressed/disabled, fillType, slicedBorder, flip…), `text` (nội dung, font size, màu, align, outline/shadow — đúng các trường có trong `.ui`), `layout` (hướng, spacing, padding, cell size, alignment — đúng các trường của `UILayoutEntityV2`), `ecaProps` map tới `EResKeyPetsCollection`. Chỉ giữ trường renderer dùng; trường lạ → ghi vào `unsupported` để audit, không bỏ qua im lặng.

### 3.2 Renderer
- Canvas có độ phân giải tham chiếu (đọc từ `.ui`/engine, **không đoán**; nếu không xác định được thì dùng 1 giá trị cấu hình hiển thị và ghi “chưa có dữ liệu”), scale vừa khung, hỗ trợ xoay ngang/dọc nếu game có.
- Dịch anchor/pivot/sizeDelta/anchoredPosition → CSS tuyệt đối đúng công thức Unity-like RectTransform (stretch khi anchorMin≠anchorMax).
- Image: sliced 9-slice (`slicedBorder`) bằng `border-image`; Button: trạng thái normal/hover/pressed/disabled; Text: font stack gần nhất, số lớn dùng định dạng của `BigNumberHandler` nếu cần.
- Layout entity: flex/grid theo thuộc tính thật; item template (vd `Pet (1)`) được nhân bản bởi binding, không hard-code số lượng.
- Mỗi DOM node gắn `data-ui-path`, `data-ui-type` để so khớp 1-1 và để test.
- Chế độ debug: bật viền entity, hiện tên/path khi hover, toggle hiện entity `inactive`.

### 3.3 Tab & điều hướng
- Mục sidebar mới **"UI Preview"** (nhóm riêng "UI GAME"), `data-page="uipreview"`; thêm vào `pages`/router (`app-router.js`).
- Trong trang: thanh sub-tab theo `registry.json` — phase này `Collection` = ready, các UI khác (Shop, Mail, Mission, Leaderboard…) hiện dạng disabled “Sắp có”, **không** tự thêm UI chưa làm.
- Deep-link `#uipreview/collection`; nhớ sub-tab cuối (try/catch localStorage).

### 3.4 Hành vi Collection (đọc `.fcg`, không suy diễn)
Phải xác minh từ `HudCollection.fcg` rồi mới code: danh sách rarity tab và mapping tab→RarityEnum (kể cả `All`, `Limited`), số pet/trang và công thức trang, trạng thái pet chưa sở hữu (silhouette/khoá?), nội dung panel `PetDetails`/`Info`/`Obtain`, tab Mutations/Weathers (item sở hữu/chưa), `UnlockObtain`, `Recipe` (khi nào hiện), 3 bộ đếm + progress bar, `LoadingLabel`, đóng bằng `CloseButton`/`DarkBG` và `PreventCloseButton`.
Dữ liệu người chơi **không có** trên web → dùng **state mô phỏng** (panel “Người chơi giả lập”: sở hữu tất cả / không có gì / ngẫu nhiên có seed / tự chọn pet+mutation+weather). Ghi rõ nhãn “mô phỏng” trên UI; không bịa số liệu sở hữu thật.

## 4. Lộ trình (mỗi bước = 1 commit local, Conventional Commits, không push)

| Bước | Nội dung | Commit gợi ý |
|---|---|---|
| 0 | Cập nhật `CLAUDE.md` (đường dẫn game + allowlist `.ui`/sprite UI), thêm quyết định vào `design/00-decisions.md`, thêm plan này | `docs(ui): allow read-only HUD ui files for UI preview` |
| 1 | Parser `.ui` + guard đường dẫn + `collection.json` + manifest sprite + registry; báo cáo `unsupported`/`missing` | `feat(sync): export collection hud layout and sprites` |
| 2 | `collection-rules.json` từ `.fcg` (rarity tab, page size, state rule) | `feat(sync): derive collection hud rules from fcg` |
| 3 | Renderer generic + trang UI Preview + sub-tab + nav; render tĩnh Collection đúng bố cục | `feat(ui): add ui preview tab with collection layout` |
| 4 | Hành vi: rarity tab, phân trang, chọn pet, tab Info/Mutations/Weathers, Recipe/UnlockObtain, đếm, close, panel giả lập | `feat(ui): make collection preview interactive` |
| 5 | QA so khớp 1-1 (script audit số entity/path), responsive, console sạch, README/design cập nhật | `docs(ui): document ui preview and collection parity` |

## 5. Nghiệm thu

- Script audit: số node DOM có `data-ui-path` = số entity trong `.ui` (kể cả inactive); không path nào lệch tên.
- Chụp ảnh đối chiếu với màn hình game (người dùng cung cấp) cho: mở Collection, mỗi rarity tab, chọn pet, 3 tab chi tiết, trang cuối.
- Mọi tương tác lấy rule từ `.fcg`; chỗ chưa xác minh được ghi vào `design/20-dev-action-items.md`.
- Console không lỗi; kiểm tra màn nhỏ; sync chạy lại cho kết quả giống nhau (idempotent); `git diff` không chạm repo game.

## 6. Rủi ro / việc mở

- Sprite `lib://fftextures/...` không có file → placeholder + liệt kê; cần dev/designer cấp file nếu muốn 1-1 tuyệt đối.
- Font & shader/outline text của engine không có trên web → xấp xỉ, ghi sai lệch đã biết.
- `.ui` có prefab variant/`ecaScripts` → chỉ render phần visual; ghi lại thứ bỏ qua.
- `.ui` nặng 380 KB: tách `dist/data/ui/<id>.json`, lazy-load khi mở sub-tab.
- Mỗi UI mới sau này nên có `rules.json` riêng; renderer không chứa logic của UI cụ thể.
