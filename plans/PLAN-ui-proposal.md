# Plan: tab "UI Proposal" — đề xuất chỉnh UI game, kèm prompt Codex và resource mới

**Trạng thái 2026-10-23:** hoàn tất bước 0–6. Có một demo draft “ví dụ để kiểm pipeline”, schema/validator 74 field, prompt từ template và bốn .fcg Collection, trang so sánh/Inspector/resource. Audit 153 case; browser 1440×1100 và 390×844, ba chế độ, 107/107 entity demo; fixture cấu trúc mạng tạm 108 entity; UI Preview hồi quy 173 pet/214 click mỗi viewport, console sạch. Chi tiết: `design/ui-proposals/README.md`; giới hạn engine/binding: DA-002–015. Prompt giao Codex gốc: `plans/PROMPT-codex-ui-proposal.md`.

Mục tiêu: một tab mới cạnh "UI Preview". Tab render **UI sau khi áp đề xuất** bằng đúng renderer của UI Preview, rồi hiện:
1. **Preview** — UI đề xuất (có công tắc Hiện tại / Đề xuất / Chồng lớp để so).
2. **Prompt Codex** — văn bản sinh tự động từ diff, dán vào Codex để sửa `.ui`/code trong game cho khớp đề xuất.
3. **Resource** — path các sprite/entity dùng trong UI đề xuất, đánh dấu `giữ nguyên` / `đổi` / `mới`.

## 1. Học từ PvZ GDD (`plant_vs_zombie_gdd`, trang `uiux.html`)

- PvZ dựng mockup **bằng tay** (3600 dòng `uiux.js`), mỗi màn có mảng `mapping`: dòng = thành phần, nguồn (sprite / node `.ui` / mới), trạng thái `real | approx | new`. Bảng này chính là spec cho dev.
- Bài học dùng lại: bảng resource có trạng thái; luôn đối chiếu với `.ui` thật; một bộ component chung thay vì vẽ tay từng màn; ghi lịch sử vòng duyệt.
- Bài học **không** dùng lại: viết HTML tay cho từng màn. SAP GDD đã có renderer đọc cây `.ui`, nên đề xuất ở đây là **patch trên cây entity**, không phải mockup viết riêng.

## 2. Quyết định thiết kế

| Vấn đề | Quyết định |
|---|---|
| Đề xuất lưu ở đâu | `design/ui-proposals/<screen>/<proposal-id>.json` — dữ liệu do GDD sở hữu, **không** đọc từ repo game. Asset mới (PNG do designer cấp) đặt ở `design/ui-proposals/<screen>/assets/`. |
| Dạng đề xuất | **Overlay/patch** áp lên `dist/data/ui/<screen>.json` (cây đã sync): `set` (đổi field), `add` (thêm entity con), `remove`, `move`/`reorder`, `replaceSprite`. Mỗi thao tác chọn entity bằng `path` (+ `id` nếu có) và bắt buộc có `reason` ngắn. |
| Nguồn sprite mới | Sprite có sẵn trong `dist/assets/ui-sprites/**` (đã allowlist) **hoặc** file mới trong thư mục assets của đề xuất. Sprite mới ghi trạng thái `mới — chưa có trong game`, kèm kích thước PNG và 9-grid do người đề xuất khai báo (không đoán). |
| Prompt Codex | **Sinh bằng script** từ diff + template (`tools/templates/ui-proposal-prompt.md`), không viết tay mỗi lần. Chứa: file `.ui` đích, danh sách thao tác theo entity (path, `_entityId`, field cũ → mới), sprite mới cần import, các `.fcg` đang gán runtime lên entity bị đổi (để Codex không phá binding), quy tắc an toàn. |
| Quan hệ với repo game | GDD vẫn **chỉ đọc** repo game. Prompt là văn bản để người dùng chạy trong phiên Codex **riêng** ở repo game; GDD không ghi vào đó. |
| Dữ liệu người chơi | Giữ state mô phỏng như UI Preview; ghi nhãn "mô phỏng". |
| Không bịa số | Mọi số trong đề xuất là **quyết định thiết kế** của người đề xuất (ghi `reason`), không phải số cân bằng. Field nào không có nguồn → "chưa có dữ liệu". |

## 3. Kiến trúc

```
design/ui-proposals/<screen>/<id>.json         (đề xuất, nguồn thật)
design/ui-proposals/<screen>/assets/*.png      (sprite mới, nếu có)
tools/templates/ui-proposal-prompt.md          (template prompt)
tools/sync-ui-proposals.mjs                    (chỉ ghi trong dist/, guard đích)
  ├─ đọc dist/data/ui/<screen>.json (đầu ra của sync-ui-preview) + proposal JSON
  ├─ validate: path tồn tại, field hợp lệ, không trùng id, sprite tồn tại
  ├─ áp patch → dist/data/ui/proposals/<id>.json   (cây sau khi áp, node gắn proposalState)
  ├─ diff → dist/data/ui/proposals/<id>-diff.json  (before/after theo entity+field)
  ├─ resource table → dist/data/ui/proposals/<id>-resources.json
  ├─ prompt → dist/data/ui/proposals/<id>-prompt.md
  ├─ copy sprite mới → dist/assets/ui-proposals/<screen>/<id>/
  └─ dist/data/ui/proposals/registry.json
tools/audit-ui-proposals.mjs                   (kiểm tĩnh)

dist/app-uiproposal.js     trang "UI Proposal": chọn đề xuất, khung preview, prompt, bảng resource
dist/app-ui-renderer.js    dùng lại; chỉ thêm tuỳ chọn tô viền theo proposalState (added/changed/removed)
```

`app-uipreview.js` hiện gắn cứng `collection`; cần tách phần dựng stage/scale/toolbar/resource-table thành hàm dùng chung (`uiStageMount`, `uiResourceRows`) để hai tab không copy code. Việc tách này là bước riêng, không đổi hành vi UI Preview.

### 3.1 Schema đề xuất (tối thiểu)
```json
{
  "id": "collection-v2-example",
  "screen": "collection",
  "title": "…",
  "author": "…",
  "status": "draft | review | approved",
  "summary": "một–hai câu mục đích",
  "ops": [
    { "op": "set", "path": "Container/Title/Label", "field": "text.fontSize", "value": 28, "reason": "…" },
    { "op": "replaceSprite", "path": "Container/BG/Main", "sprite": "<key trong manifest hoặc asset mới>", "reason": "…" },
    { "op": "add", "parent": "Container", "entity": { "name": "…", "type": "Image", "transform": { }, "image": { } }, "reason": "…" },
    { "op": "remove", "path": "…", "reason": "…" }
  ],
  "newAssets": [ { "file": "assets/foo.png", "key": "proposal/foo", "border": { "left": 0, "right": 0, "top": 0, "bottom": 0 } } ]
}
```
Field đổi được chỉ gồm tập renderer đã hỗ trợ (transform, alpha, active, image/button sprite+màu+fill, text content/size/màu/align, layout). Field ngoài tập → script từ chối, không bỏ qua im lặng.

### 3.2 Trang web
Bố cục dọc, đúng thứ tự yêu cầu:
1. **Thanh trên:** chọn đề xuất (dropdown + trạng thái), công tắc `Hiện tại | Đề xuất | Chồng lớp (opacity slider)`, các toggle sẵn có (debug, inactive, ngôn ngữ, tỉ lệ khung), tô viền `thêm/đổi/xoá`.
2. **Preview:** cùng stage/renderer, tương tác như UI Preview, Widget Inspector hiện thêm "Thay đổi của đề xuất" cho entity được chọn (field cũ → mới, reason).
3. **Prompt Codex:** khối `<pre>` đọc từ `-prompt.md`, nút "Sao chép" (clipboard bọc try/catch), hiển thị số thao tác và cảnh báo (vd entity bị đổi có binding `.fcg`).
4. **Resource của UI đề xuất:** bảng như UI Preview (path, sprite, trạng thái file, 9-grid, màu, text/key) **thêm** cột `Thay đổi` (giữ/đổi/mới/xoá) và `Nguồn sprite` (game / asset đề xuất); lọc theo trạng thái; ô tìm kiếm.
5. Deep-link `#uiproposal/<screen>/<id>`; nhớ đề xuất cuối (try/catch localStorage). Mobile: các khối xếp dọc, không scroll ngang.

Sidebar: mục **"UI Proposal"** ngay dưới "UI Preview", `data-page="uiproposal"`; thêm vào `pages` và router.

### 3.3 Prompt sinh ra (cấu trúc cố định)
1. Bối cảnh + quy tắc: sửa **chỉ** file `.ui`/sprite/code HUD liên quan; không đổi gameplay/config; dùng MCP craftland xác nhận widget; giữ `_entityId` và `EResKey*` đang được code tham chiếu.
2. Mục tiêu một đoạn (từ `summary`).
3. Bảng thao tác theo entity: path, `_entityId`, thao tác, giá trị cũ → mới, reason.
4. Sprite: file mới cần import (đường dẫn trong GDD, kích thước, 9-grid), sprite đổi.
5. Binding `.fcg` bị ảnh hưởng (grep tên entity/`EResKey` trong `.fcg` đã được phép đọc lúc sync; liệt kê file:dòng).
6. Nghiệm thu: so sánh tree `.ui` trước/sau, không có entity mồ côi, build/preview trong Editor, báo cáo bảng before/after, chỗ chưa xác minh.
Prompt **không** chứa dữ liệu vận hành (giftcode, compensation) và không chứa path ngoài dự án game/GDD.

## 4. Lộ trình (mỗi bước một commit local, Conventional Commits, không push)

| Bước | Nội dung | Commit gợi ý |
|---|---|---|
| 0 | Ghi quyết định: nguồn đề xuất do GDD sở hữu, prompt chỉ là văn bản; cập nhật CLAUDE.md/AGENTS.md/design/00-decisions.md nếu thêm script/thư mục mới | `docs(ui): record ui proposal source and boundary` |
| 1 | Tách helper dùng chung khỏi `app-uipreview.js` (stage, scale, resource rows), không đổi hành vi | `refactor(ui): share preview stage and resource table` |
| 2 | Schema + validator + áp patch + diff + resource table + fixture demo | `feat(sync): add ui proposal patch pipeline` |
| 3 | Sinh prompt từ template + quét binding `.fcg` | `feat(sync): generate codex prompt from ui proposal diff` |
| 4 | Trang UI Proposal: sidebar, router, preview, so sánh Hiện tại/Đề xuất/Chồng lớp | `feat(ui): add ui proposal tab with before-after preview` |
| 5 | Khối prompt + nút sao chép + bảng resource có trạng thái + Inspector hiển thị thay đổi | `feat(ui): show codex prompt and resources for proposals` |
| 6 | `audit-ui-proposals.mjs`, QA trình duyệt, README/design | `test(ui): audit ui proposal pipeline and page` |

## 5. Nghiệm thu

- Sync chạy lại cho kết quả giống nhau (idempotent); `git diff` không chạm repo game; mọi output nằm trong `dist/`.
- Audit: mọi `op` resolve được path; số entity DOM có `data-ui-path` = số entity cây sau patch; mọi sprite trong bảng resource tồn tại (game hoặc asset đề xuất) hoặc được đánh dấu thiếu; prompt liệt kê đủ mọi `op`; diff rỗng ⇔ cây giống hệt hiện tại.
- Đề xuất sai (path không tồn tại, field ngoài tập hỗ trợ, sprite không có) → sync lỗi rõ ràng, không sinh output nửa vời.
- Tab UI Preview hiện có không đổi hành vi (so audit cũ 107/107 entity).
- Trình duyệt: không lỗi console, viewport 1440×1100 và 390×844, copy prompt hoạt động, deep-link hoạt động.

## 6. Rủi ro / việc mở

- Chưa có độ phân giải/scaler engine đã xác minh (DA-002–005): so sánh trước/sau trên web chỉ đúng tương đối; giữ nhãn "chưa xác minh".
- Đề xuất thêm widget mới có thể cần `ecaScripts`/binding code mới: prompt phải nêu rõ phần này **cần dev viết code**, không để Codex tự suy.
- Sprite `lib://fftextures/...` không có file: đề xuất không được tham chiếu trừ khi đánh dấu thiếu.
- Prompt dài với đề xuất lớn: chia theo nhóm entity, cho phép xuất từng phần.
- Chỉ Collection được đăng ký phase này; thêm màn khác cần mở allowlist `.ui` trong CLAUDE.md trước.
