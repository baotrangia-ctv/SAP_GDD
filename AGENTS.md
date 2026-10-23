# AGENTS — Steal A Pet Balance & Pacing GDD

Đọc `CLAUDE.md` trước: mọi quy tắc cứng ở đó cũng áp dụng cho Codex. File này bổ sung quy tắc commit.

## Quy tắc commit (Conventional Commits 1.0.0)

Tuân thủ https://www.conventionalcommits.org/en/v1.0.0/ cho MỌI commit, không ngoại lệ.

Định dạng:

```
<type>(<scope>): <description>

[body tuỳ chọn]

[footer tuỳ chọn]
```

- `type` (bắt buộc, chữ thường): `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - `feat`: thêm tính năng/trang/dữ liệu hiển thị mới. `fix`: sửa lỗi sai (map sai, icon sai, số sai).
  - `docs`: chỉ đổi `design/`, `plans/`, `README.md`, `CLAUDE.md`, `AGENTS.md`.
  - `chore`: việc vặt không đổi hành vi (regenerate snapshot đơn thuần, dọn file). `refactor`: đổi cấu trúc code, không đổi hành vi.
- `scope` (nên có, chữ thường, một danh từ): theo trang/module — `shop`, `missions`, `pools`, `rewards`, `roster`, `progression`, `cadence`, `sync`, `ui`, `site`, `docs`.
- `description`: tiếng Anh, mệnh lệnh thức, chữ thường đầu câu, không dấu chấm cuối, tối đa 72 ký tự cả dòng đầu. Ví dụ: `fix(shop): correct weather icon mapping`.
- Breaking change: thêm `!` sau type/scope (`feat(sync)!: ...`) và footer `BREAKING CHANGE: <mô tả>`.
- Body (nếu cần): cách dòng đầu một dòng trống, giải thích vì sao/nguồn dữ liệu đã kiểm chứng; wrap ~72 cột.
- Một commit = một thay đổi logic. Không gộp nhiều vấn đề; không dùng message kiểu `Update ...`, `Fix stuff`, `WIP`.
- Dữ liệu sinh ra (`dist/data/**`) commit cùng thay đổi script/UI gây ra nó; nếu chỉ regenerate thì dùng `chore(sync): ...`.

Quy trình trước mỗi commit: `git status` và `git diff --stat`, chỉ stage file của thay đổi đó, rồi kiểm tra lại dòng đầu message khớp mẫu
`^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .{1,72}$` trước khi `git commit`.
Không push, amend, rebase, reset hay tạo tag nếu người dùng chưa yêu cầu rõ.
