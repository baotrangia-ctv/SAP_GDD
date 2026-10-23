# Prompt cho Codex — Tab "UI Proposal" (đề xuất update UI + prompt Codex + resource)

Dán khối dưới vào Codex (MCP craftland bật), chạy từ `C:\_Code\craftland\_Users\SAP_GDD`.

````text
Project GDD tĩnh: C:\_Code\craftland\_Users\SAP_GDD. Đọc trước: CLAUDE.md, AGENTS.md, plans/PLAN-ui-proposal.md (spec chính, làm đúng), plans/PLAN-ui-preview.md, design/00-decisions.md, design/20-dev-action-items.md, tools/sync-ui-preview.mjs, tools/audit-ui-preview.mjs, tools/audit-ui-preview-browser.mjs, dist/app-uipreview.js, dist/app-ui-renderer.js, dist/app-ui-collection.js, dist/app-ui-inspector.js, dist/app-router.js, dist/index.html, các rule .ui-* trong dist/styles.css, dist/data/ui/*.json.
Tham khảo ý tưởng (CHỈ ĐỌC, không sửa, không copy code): C:\_Code\craftland\_Users\plant_vs_zombie_gdd — tools/balance-web/public/uiux.html, js/uiux.js (mảng `mapping` real/approx/new), knowledge-pack/04-ui-ux/**, design/19-ui-source-asset-mapping.md. Bài học dùng: bảng resource có trạng thái, kiểm theo .ui thật. KHÔNG làm kiểu viết HTML tay từng màn: ở đây đề xuất là PATCH trên cây entity đã sync, render bằng renderer hiện có.
Nguồn game (chỉ đọc): C:\_Code\craftland\StealAPet — chỉ các file CLAUDE.md cho phép (PetsCollection.ui, .fcg liên quan, sprite/.png.meta của UI đã đăng ký, CSV). Không mở rộng allowlist. Dùng MCP craftland để xác nhận field widget hợp lệ khi định nghĩa tập field patch được; điều chưa xác minh ghi design/20-dev-action-items.md, không đoán.

## Yêu cầu tính năng
Thêm tab sidebar "UI Proposal" (ngay dưới "UI Preview", data-page="uiproposal", deep-link #uiproposal/<screen>/<id>). Trang gồm, theo đúng thứ tự dọc:
1. Preview UI đề xuất bằng cùng renderer/stage như UI Preview (tương tác giữ nguyên, Widget Inspector dùng được và hiện thêm "Thay đổi của đề xuất": field cũ → mới + reason). Công tắc Hiện tại / Đề xuất / Chồng lớp (slider opacity); tuỳ chọn tô viền entity thêm/đổi/xoá.
2. Khối "Prompt Codex": prompt sinh tự động từ diff đề xuất, hiển thị trong <pre>, nút "Sao chép" (clipboard bọc try/catch), số thao tác, cảnh báo binding .fcg.
3. Bảng "Resource của UI đề xuất": như bảng UI Preview + cột `Thay đổi` (giữ/đổi/mới/xoá) và `Nguồn sprite` (game/asset đề xuất), lọc theo trạng thái, ô tìm kiếm.
Mobile: xếp dọc, không scroll ngang, không hover (UI mobile; không thêm :hover/title tooltip/pointerenter).

## Kiến trúc bắt buộc (chi tiết trong plan §3)
- Đề xuất = file JSON do GDD sở hữu tại design/ui-proposals/<screen>/<id>.json + asset mới ở design/ui-proposals/<screen>/assets/. Ops: set / add / remove / move / replaceSprite, mỗi op có `reason`; newAssets khai báo key, file, border 9-grid (do người đề xuất khai báo, không đoán).
- tools/sync-ui-proposals.mjs: đọc dist/data/ui/<screen>.json + proposal, validate (path tồn tại, field thuộc tập renderer hỗ trợ, id không trùng, sprite tồn tại hoặc là asset mới) — sai thì lỗi rõ ràng, không sinh output nửa vời; áp patch; ghi vào dist/data/ui/proposals/: <id>.json (cây sau patch, node có proposalState added|changed|removed|unchanged), <id>-diff.json, <id>-resources.json, <id>-prompt.md, registry.json; copy sprite mới vào dist/assets/ui-proposals/<screen>/<id>/. Chỉ ghi trong dist/ của project GDD, giữ guard đích output. Idempotent. Không ghi/đọc ngoài allowlist; không đọc giftcode/Compensate.
- Prompt sinh từ template tools/templates/ui-proposal-prompt.md (không viết tay): (1) bối cảnh + quy tắc cho Codex ở repo game: chỉ sửa .ui/sprite/code HUD liên quan, không đổi gameplay/config, dùng MCP craftland xác nhận widget, giữ `_entityId` và EResKey* đang được code tham chiếu; (2) mục tiêu từ summary; (3) bảng thao tác theo entity: path, `_entityId`, op, giá trị cũ → mới, reason; (4) sprite mới/đổi: đường dẫn trong GDD, kích thước PNG, 9-grid; (5) binding .fcg bị ảnh hưởng (file:dòng, quét trong .fcg đã được phép đọc); phần cần dev viết code mới (vd widget thêm mới cần binding) nêu rõ "cần dev", không để Codex tự suy; (6) nghiệm thu: so cây .ui trước/sau, không entity mồ côi, kiểm trong Editor, báo cáo before/after, chỗ chưa xác minh. Prompt không chứa dữ liệu vận hành, không path ngoài project game/GDD.
- Tách helper dùng chung (dựng stage/scale/toolbar, hàng bảng resource) khỏi dist/app-uipreview.js để hai tab không copy code; KHÔNG đổi hành vi UI Preview (audit cũ 107/107 entity vẫn pass). dist/app-uiproposal.js là module riêng, nạp trong index.html (cache-bust ?v=), đăng ký vào pages + router. Chỉ thêm tuỳ chọn tô viền proposalState vào renderer, không đưa logic của một đề xuất cụ thể vào renderer.
- Vanilla JS, site tĩnh, không build step, tiếng Việt, mặc định gọn. Không hard-code dữ liệu config vào JS.
- Tạo MỘT đề xuất demo nhỏ, ghi rõ nhãn "ví dụ để kiểm pipeline" (ví dụ 1–2 op vô hại như đổi vị trí/cỡ chữ một label + một sprite có sẵn); không bịa số cân bằng, không tuyên bố đó là thiết kế đã duyệt. Đề xuất thật sẽ do người dùng cấp sau.

## Quy tắc cứng
CLAUDE.md/AGENTS.md áp dụng đủ. Repo game chỉ đọc: không Studio/build, không tạo file, không Git ghi. GDD: commit local Conventional Commits, mỗi bước một commit, trước commit chạy git status + git diff --stat, chỉ stage file của bước đó, kiểm dòng đầu theo regex trong AGENTS.md; không push/amend/rebase/reset/tag. Nếu cần ghi vào project game thì dừng.

## Việc cần làm (mỗi bước một commit)
0 docs(ui): record ui proposal source and boundary — cập nhật CLAUDE.md (bản đồ project/lệnh), design/00-decisions.md; nếu thấy cần sửa allowlist thì dừng và hỏi.
1 refactor(ui): share preview stage and resource table
2 feat(sync): add ui proposal patch pipeline (schema, validator, patch, diff, resources, fixture demo)
3 feat(sync): generate codex prompt from ui proposal diff (template + quét binding .fcg)
4 feat(ui): add ui proposal tab with before-after preview
5 feat(ui): show codex prompt and resources for proposals (+ Inspector hiển thị thay đổi)
6 test(ui): audit ui proposal pipeline and page — tools/audit-ui-proposals.mjs: mọi op resolve; số entity DOM data-ui-path = số entity cây sau patch; sprite trong bảng resource tồn tại hoặc đánh dấu thiếu; prompt liệt kê đủ mọi op; proposal rỗng ⇒ diff rỗng; proposal sai ⇒ sync lỗi. Chạy:
  node tools/sync-source-data.mjs --project-root "C:\_Code\craftland\StealAPet"
  node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"
  node tools/sync-ui-proposals.mjs
  node tools/audit-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"
  node tools/audit-ui-proposals.mjs
  python -m http.server 8080 --directory dist
Kiểm thủ công trên http://localhost:8080: cả 3 chế độ so sánh, Inspector, sao chép prompt, lọc bảng resource, deep-link, viewport 1440×1100 và 390×844, console sạch; sync chạy lại cho output giống nhau; git diff không chạm repo game. Cập nhật README/design.

## Báo cáo cuối
Liệt kê commit; schema đề xuất và tập field được hỗ trợ (nguồn xác minh MCP/.ui); ví dụ prompt sinh ra (rút gọn); kết quả audit; điều chưa xác minh (ghi trong design/20-dev-action-items.md); xác nhận UI Preview không đổi hành vi và repo game không bị chạm. Không tuyên bố "khớp game" nếu chưa kiểm.
````
