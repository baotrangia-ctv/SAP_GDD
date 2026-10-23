# Prompt cho Codex — UI Preview: bỏ auto-scroll khi tương tác, bảng resource chỉ hiển thị, map alpha 1-1

Dán khối dưới vào Codex (MCP craftland bật), chạy từ `C:\_Code\craftland\_Users\SAP_GDD`.

````text
Project GDD tĩnh: C:\_Code\craftland\_Users\SAP_GDD. Đọc trước: CLAUDE.md, AGENTS.md, plans/PLAN-ui-preview.md, dist/app-uipreview.js, dist/app-ui-renderer.js, dist/app-ui-collection.js, các rule .ui-* trong dist/styles.css (khoảng dòng 660-700), tools/audit-ui-preview.mjs. Project game chỉ đọc: C:\_Code\craftland\StealAPet. Dùng MCP craftland để xác nhận cách Craftland Editor/runtime xử lý alpha và raycast/nhận click của UI entity.

## Bug cần sửa
1. Khi tương tác UI trong preview (bấm tab, chọn pet, next/prev…), trang web tự cuộn xuống phần "Resource đang dùng". Nguyên nhân đã khoanh vùng (hãy xác minh lại): 
   - app-ui-collection.js gọi renderUiResourcePanel() sau mỗi lần render (khoảng dòng 196); trong app-uipreview.js renderUiResourcePanel() lại gọi `selected.scrollIntoView(...)` (khoảng dòng 85) → trang nhảy xuống bảng.
   - focusUiResource() (khoảng dòng 125-131) gọi `scrollIntoView({behavior:"smooth"})` khi click entity/hàng, và click entity trong preview bị coi là "chọn resource".
   Yêu cầu mới: phần dưới **chỉ để hiển thị** thông tin resource, KHÔNG redirect/scroll/focus tới nó. Tương tác trong UI preview tuyệt đối không được làm trang cuộn hay đổi vị trí viewport.
2. Một số widget có alpha (opacity) khác 100 trong .ui, cần map 1-1 với web để không vướng tương tác. Các entity có alpha ≠ 100 hiện có (kiểm lại bằng dist/data/ui/collection.json, đừng tin danh sách này): 
   - Container/PetsLayout/Pet (1)/ShowDetailsPetButton — UIButtonEntity, alpha 0
   - Container/PetDetails/Pet/ShowDetailsPetButton — UIButtonEntity, alpha 0
   - Container/PetDetails/Pet/RarityBG — UIImageEntity, alpha 90
   - Container/Recipe/Pet/Name/RedirectCollectionButton — UIButtonEntity, alpha 1
   Renderer hiện chỉ đặt `element.style.opacity = alpha/100`, và CSS đặt `.ui-entity:not(button){pointer-events:none}`. Cần xác nhận (MCP craftland + .ui + .fcg) và làm đúng: (a) alpha=0 hay rất thấp có còn nhận click (button vô hình phủ lên pet card là mẫu thường gặp) không; (b) alpha của entity cha có nhân xuống con không hay chỉ áp cho chính entity; (c) alpha áp lên image/tint/text/children thế nào (alpha trong props và alpha trong màu/gradient); (d) thứ tự z/raycast: entity nào nằm trên nhận click, entity non-button có chặn click của button bên dưới không (raycast target của Image). Triển khai để: button alpha 0 vẫn bấm được và đúng hành vi như game; button vô hình không che/khóa các control khác; vùng click khớp đúng RectTransform; opacity hiển thị khớp game. Không hard-code theo tên entity: dùng dữ liệu từ JSON sinh ra; nếu cần thêm trường (vd raycastTarget) thì bổ sung ở tools/sync-ui-preview.mjs.
3. Bảng "Resource đang dùng" giữ nguyên nội dung (sprite, màu, alpha, 9-grid, key localization…) nhưng chuyển sang chế độ chỉ hiển thị: 
   - Bỏ mọi scrollIntoView/focus/hash change/redirect liên quan; bỏ chọn-đồng-bộ hai chiều gây nhảy trang (có thể giữ tuỳ chọn highlight entity khi hover/click hàng nếu KHÔNG cuộn và KHÔNG chiếm click của UI preview; mặc định tắt cũng được). 
   - Click vào entity trong preview chỉ thực hiện đúng hành vi game, không đồng thời chọn/cuộn bảng.
   - Re-render sau mỗi tương tác không được làm mất vị trí cuộn của trang hoặc của vùng bảng (chỉ cập nhật phần thay đổi hoặc giữ scrollTop; ưu tiên cập nhật cột/hàng liên quan thay vì dựng lại cả bảng).
   - Thêm cột alpha (giá trị gốc trong .ui, và giá trị hiệu dụng sau khi cộng dồn nếu quy tắc cascade xác nhận có).

## Quy tắc cứng
CLAUDE.md: site tĩnh trong dist/, vanilla JS, tiếng Việt, không build step; trình duyệt chỉ đọc JSON sinh ra từ tools/*.mjs; project game chỉ đọc; không bịa — chỗ không xác minh được ghi vào design/20-dev-action-items.md. Commit local theo Conventional Commits (AGENTS.md), mỗi bước một commit, không push/amend/reset. Không mở rộng allowlist đọc project game ngoài những gì CLAUDE.md đã cho phép.

## Việc cần làm
B1 fix(ui): bỏ toàn bộ auto-scroll/redirect khi tương tác; bảng resource chỉ hiển thị, giữ scroll position khi re-render. Test: ghi lại window.scrollY và scrollTop vùng bảng trước/sau khi bấm mọi tab/nút/pet; phải không đổi.
B2 feat(sync)/fix(ui): xác minh quy tắc alpha + raycast bằng MCP/.ui/.fcg, sửa sync (nếu cần trường mới) và renderer (opacity, pointer-events, z-order, vùng click) cho khớp game; thêm cột alpha vào bảng resource.
B3 test(ui): mở rộng tools/audit-ui-preview.mjs kiểm: mọi entity alpha≠100 có opacity khớp; button alpha thấp vẫn nhận click; không còn scrollIntoView/location.hash thay đổi trong code UI preview (grep); chạy sync + audit, serve `python -m http.server 8080 --directory dist`, thao tác thủ công trong trình duyệt (đặc biệt bấm pet trong lưới, ShowDetailsPetButton, RedirectCollectionButton trong Recipe, tab, prev/next, close) và kiểm tra console, màn hình nhỏ. Cập nhật README/design nếu có quyết định mới.

## Báo cáo cuối
Nêu: commit đã tạo; nguyên nhân scroll đã xác nhận; quy tắc alpha/raycast xác nhận được (nguồn); bảng entity alpha ≠ 100 và hành vi click từng cái trên web so với game; phần chưa xác minh được. Không tuyên bố "khớp game" nếu chưa kiểm.
````
