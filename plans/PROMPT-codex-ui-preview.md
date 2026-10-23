# Prompt cho Codex — Tab "UI Preview" (phase 1: Collection)

Dán toàn bộ nội dung trong khung dưới vào Codex, chạy từ `C:\_Code\craftland\_Users\SAP_GDD`.

````text
Bạn đang làm việc trong project GDD tĩnh tại C:\_Code\craftland\_Users\SAP_GDD.
Trước hết đọc theo thứ tự: CLAUDE.md, AGENTS.md, README.md, design/00-decisions.md, plans/PLAN-ui-preview.md (đây là plan chi tiết, làm đúng theo nó), plans/PLAN-features-from-pvz.md (chỉ phần liên quan), dist/app-router.js, dist/index.html, tools/sync-source-data.mjs, rồi các module dist/app-*.js mẫu (app-shop.js, app-system-common.js).

## Mục tiêu
Thêm tab sidebar "UI Preview" hiển thị lại UI Collection của game (Assets/HUDs/PetsCollection.ui) trên web, mapping 1-1 cấu trúc entity, anchor/size/vị trí, sprite, text, và tương tác được như trong game. Trong tab có thanh sub-tab theo loại UI (registry-driven); phase này chỉ "Collection" ready, các UI khác hiện disabled "Sắp có".

## Nguồn (chỉ đọc) — project game ở C:\_Code\craftland\StealAPet
- Assets/HUDs/PetsCollection.ui — JSON, dòng cuối là comment `//"{FE:...}`: cắt từ "\n//" cuối trước khi JSON.parse.
- Assets/Scripts/HUDs/HudCollection.fcg, Assets/Scripts/Manager/CollectionManager.fcg — nguồn hành vi.
- Assets/CSV/Pet.csv và các CSV mutation/weather đã có trong snapshot — dữ liệu tĩnh.
- Assets/Sprites/** — chỉ các sprite mà PetsCollection.ui tham chiếu (propsData.*.spriteName.filePath). Sprite dạng lib://fftextures/... không có file: dùng placeholder và ghi vào danh sách missing.
- Docs/BusinessLogic/94-ui-hud-framework.md, 10-pets-core.md, 16-pet-progression.md để hiểu ngữ cảnh.

## Quy tắc cứng (không được vi phạm)
- Site tĩnh trong dist/, vanilla JS, tiếng Việt, không Express/framework/build step. Dữ liệu dẫn xuất do tools/*.mjs sinh vào dist/data/; trình duyệt chỉ đọc JSON.
- Project game chỉ đọc: không chạy Studio/build, không tạo/ghi file, không lệnh Git ghi ở đó. Mọi output chỉ ghi trong dist/ của project GDD, giữ guard đường dẫn đích (isWithin như sync hiện tại).
- Không đọc Compensate/** và giftcode.csv. Không bịa số: thiếu nguồn thì ghi "chưa có dữ liệu". Dữ liệu sở hữu của người chơi không tồn tại trên web → chỉ dùng state MÔ PHỎNG, có nhãn "mô phỏng" rõ ràng.
- Không hard-code dữ liệu config/layout vào JS; layout lấy từ JSON sinh ra, hành vi lấy từ rule JSON sinh từ .fcg (không suy diễn cơ chế chưa kiểm chứng; chỗ chưa chắc → ghi vào design/20-dev-action-items.md).
- Commit local theo Conventional Commits 1.0.0 (xem AGENTS.md), mỗi bước một commit, trước commit chạy git status + git diff --stat và chỉ stage file của bước đó. KHÔNG push/amend/rebase/reset/tag. Kết thúc commit message bằng dòng Co-Authored-By nếu môi trường của bạn yêu cầu.

## Việc cần làm theo thứ tự
Bước 0 — Quyết định & rule: CLAUDE.md hiện chỉ cho đọc CSV + .fcg và ghi sai đường dẫn game (D:\Craftland\...). Người dùng đã yêu cầu tính năng này, nên: cập nhật CLAUDE.md (đường dẫn game C:\_Code\craftland\StealAPet; allowlist đọc-only thêm "Assets/HUDs/<UI đã đăng ký>.ui và sprite mà .ui đó tham chiếu"), thêm quyết định vào design/00-decisions.md. Chỉ mở rộng đúng phạm vi này. Commit: docs(ui): allow read-only HUD ui files for UI preview.
Bước 1 — Sync layout: thêm (hoặc mở rộng) script trong tools/ parse PetsCollection.ui → dist/data/ui/collection.json (cây chuẩn hoá theo mục 3.1 của plan: path giữ nguyên tên entity gốc, id, type, active, transform, alpha, image/button/text/layout; trường không hỗ trợ ghi vào `unsupported`), copy sprite tham chiếu vào dist/assets/ui-sprites/collection/ + manifest (có missing), dist/data/ui/registry.json (collection=ready; Shop, Mail, Mission, Leaderboard = planned). Chạy lại sync phải idempotent. Commit: feat(sync): export collection hud layout and sprites.
Bước 2 — Rule hành vi: đọc HudCollection.fcg/CollectionManager.fcg, sinh dist/data/ui/collection-rules.json (rarity tab → RarityEnum gồm All/Limited, page size & công thức trang, điều kiện hiển thị Recipe/UnlockObtain/LoadingLabel, quy tắc pet chưa sở hữu, nội dung PetDetails/Info/Mutations/Weathers, quy tắc 3 bộ đếm, hành vi đóng). Ghi nguồn file:dòng. Commit: feat(sync): derive collection hud rules from fcg.
Bước 3 — Renderer + tab: dist/app-ui-renderer.js (generic entity tree → DOM, công thức RectTransform theo anchor/pivot/sizeDelta/anchoredPosition, 9-slice, button states, text, layout V2; mỗi node có data-ui-path và data-ui-type; chế độ debug hiện viền/tên entity và toggle entity inactive), dist/app-uipreview.js (trang, sub-tab từ registry, khung scale, deep-link #uipreview/collection, nhớ sub-tab bằng localStorage có try/catch). Thêm mục nav "UI Preview" (nhóm "UI GAME") vào dist/index.html, đăng ký trong app-router.js, thêm CSS vào styles.css, nạp script mới trong index.html. Lazy-load JSON khi mở sub-tab. Render tĩnh đúng bố cục Collection. Commit: feat(ui): add ui preview tab with collection layout.
Bước 4 — Tương tác: dist/app-ui-collection.js gắn dữ liệu và hành vi theo collection-rules.json: rarity tab, phân trang, nhân bản item template (Pet (1)) theo dữ liệu Pet.csv, chọn pet → PetDetails/Info, tab Info/Mutations/Weathers, Recipe/UnlockObtain, bộ đếm + progress, CloseButton/DarkBG/PreventCloseButton, nút mở/đóng UI. Thêm panel "Người chơi giả lập" (sở hữu tất cả / không có / ngẫu nhiên có seed / tự chọn). Icon pet/mutation/weather dùng asset sẵn có của dist/assets. Commit: feat(ui): make collection preview interactive.
Bước 5 — QA & tài liệu: script audit (số DOM node có data-ui-path = số entity trong .ui; liệt kê unsupported/missing sprite), kiểm tra bằng trình duyệt qua `python -m http.server 8080 --directory dist`: console sạch, màn hình nhỏ, mọi rarity tab, trang đầu/cuối, 3 tab chi tiết. Cập nhật README.md, design/00-decisions.md, design/20-dev-action-items.md (lib:// sprite thiếu, font/outline xấp xỉ, mục chưa xác minh), đánh dấu plan. Commit: docs(ui): document ui preview and collection parity.

## Báo cáo cuối
Nêu: các commit đã tạo, kết quả audit 1-1 (số entity, số sai lệch/unsupported), sprite thiếu, các rule chưa xác minh, và những gì còn cần người dùng đối chiếu với màn hình game. Không tuyên bố "giống 1-1" nếu audit còn lệch.
````
