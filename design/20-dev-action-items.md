# Việc kỹ thuật còn mở

Chỉ ghi các việc cần xác minh có bằng chứng từ snapshot/code. Không ghi đề xuất balance chưa được duyệt.

| ID | Việc | Bằng chứng | Trạng thái |
|---|---|---|---|
| DA-001 | Đối chiếu ghi chú rate-test trong `HudDebug.fcg` với modifier thực tế trong `PetParadeManager.fcg` trên build đang phát hành. | Snapshot hiện tại phát hiện ghi chú nói road spawn không áp dụng daily modifier, trong khi nhánh tính trọng số có gọi `DailyPoolConfigs.GetDailyModifier(petId)`. | Mở · cần xác nhận build |

Không có action item nào khác đã được xác nhận trong phạm vi nguồn được phép đọc.
