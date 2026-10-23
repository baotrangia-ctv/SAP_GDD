# Prompt cho Codex — áp dụng rule Conventional Commits

Copy toàn bộ phần trong khung dưới vào Codex, chạy ở thư mục `C:\_Code\craftland\_Users\SAP_GDD`.

````text
Bạn đang làm việc trong project GDD tĩnh `C:\_Code\craftland\_Users\SAP_GDD`. Đọc `CLAUDE.md` và `AGENTS.md` trước. Project game `C:\_Code\craftland\StealAPet` là CHỈ ĐỌC; không commit/push ở đó.

## Quy tắc commit — bắt buộc cho mọi commit từ giờ

Tuân thủ Conventional Commits 1.0.0 (https://www.conventionalcommits.org/en/v1.0.0/), chi tiết trong `AGENTS.md`:

    <type>(<scope>): <description>

- type: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
- scope: module/trang, chữ thường (shop, missions, pools, rewards, sync, ui, docs...)
- description: tiếng Anh, mệnh lệnh thức, chữ thường, không dấu chấm cuối, dòng đầu ≤ 72 ký tự
- Breaking change: `type(scope)!:` + footer `BREAKING CHANGE: ...`
- Một commit = một vấn đề; chỉ stage file của vấn đề đó (`git status` + `git diff --stat` trước khi commit)
- Cấm message kiểu `Update ...`, `Fix stuff`, `WIP`, viết hoa đầu câu, hay không có type

Trước mỗi `git commit`, tự kiểm tra dòng đầu khớp regex:
    ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .{1,72}$
Không khớp thì sửa message, không commit. Không push, amend, rebase, reset, tạo tag nếu chưa được yêu cầu.

## Việc cần làm

1. Xác nhận `AGENTS.md` có mục "Quy tắc commit" và `CLAUDE.md` có dòng trỏ tới nó. Nếu thiếu hoặc mâu thuẫn quy tắc cứng khác, sửa cho khớp.
2. Chạy `git log --format="%h %s" origin/main..HEAD` và kiểm tra từng commit chưa push bằng regex trên. Báo cáo commit nào sai; KHÔNG tự rewrite history — chỉ liệt kê và đề xuất message đúng.
3. Từ đây, mọi commit bạn tạo đều phải theo rule. Khi kết thúc task, in danh sách commit đã tạo (hash + message).
````
