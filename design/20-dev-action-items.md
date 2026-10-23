# Việc kỹ thuật còn mở

Chỉ ghi các việc cần xác minh có bằng chứng từ snapshot/code. Không ghi đề xuất balance chưa được duyệt.

| ID | Việc | Bằng chứng | Trạng thái |
|---|---|---|---|
| DA-001 | Đối chiếu ghi chú rate-test trong `HudDebug.fcg` với modifier thực tế trong `PetParadeManager.fcg` trên build đang phát hành. | Snapshot hiện tại phát hiện ghi chú nói road spawn không áp dụng daily modifier, trong khi nhánh tính trọng số có gọi `DailyPoolConfigs.GetDailyModifier(petId)`. | Mở · cần xác nhận build |
| DA-002 | Cấp/đối chiếu 8 sprite HUD thiếu hoặc nằm ngoài allowlist. | `dist/data/ui/collection-sprites.json` ghi 2 `lib://fftextures`, 4 `Assets/_Test/**`, 2 path `Assets/Sprites/**` không tìm thấy trong checkout. | Mở · cần asset gốc |
| DA-003 | Xác nhận độ phân giải tham chiếu và primitive render của Studio bằng ảnh game. | `.ui` cho root `sizeDelta=1500×750` nhưng không khai báo engine canvas; renderer web dùng font stack, tint/multiply, 9-slice và outline xấp xỉ. | Mở · cần ảnh chụp game |
| DA-004 | Đối chiếu đường đi Obtain/Recipe và routing đóng với build game. | `HudCollection.fcg` gọi `PetConfigs.GetPetObtainSource` (có tham số pool Fishing/Dig); preview chưa có đầy đủ phép tra pool trong bước này. `CloseCollection` đã rõ, nhưng handler `DarkBG`/`PreventCloseButton` nằm ngoài hai `.fcg` chính. | Mở · cần xác minh runtime |
| DA-005 | Xem 272 trường HUD chưa được renderer xử lý trước khi tuyên bố tương đương hình ảnh. | Audit thấy 69 entity có trường chưa hỗ trợ, chủ yếu animation metadata, button callback và `m_ApplyingPreviewAnimation`; có `ecaScripts` trên 1 entity. | Mở · cần đối chiếu visual/runtime |

Các mục UI Preview trên là giới hạn đã quan sát từ nguồn được phép đọc, chưa phải đề xuất đổi game.
