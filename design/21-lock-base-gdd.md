# GDD — Lock Base

Ngày kiểm tra: 26/11/2026. Trạng thái: snapshot hành vi web và cập nhật thiết kế.

## Cập nhật thiết kế do người dùng chốt

- Token đã nạp vào Lock Base không thể lấy ra, rút lại hoặc hoàn lại.
  Không đổi thời gian bảo vệ còn lại về token. Đặt lại chỉ xóa lựa chọn
  chưa nạp; offline không trả token về ví.
- Khi Lock Base đang hiệu lực, người chơi không thể cướp pet của người khác.
- Người chơi vẫn mua pet, chơi event và thực hiện các hoạt động khác bình
  thường theo điều kiện gốc. Lock Base chỉ hạn chế hành động cướp pet.
- Người khác lọt vào base đang khóa bằng bất kỳ cách nào vẫn không thể
  cướp pet trong base đó. Server phải kiểm trạng thái khóa của người cướp
  và base mục tiêu, không dựa riêng vào cửa/rào hay vị trí đứng.
- Thời gian bảo vệ chỉ giảm khi người chơi online trong game. Offline tạm
  dừng bộ đếm, giữ thời gian còn lại để tiếp tục khi vào lại.
- Thiết kế đích phải lưu ví token và thời gian còn lại, không reset khi
  reconnect. Công thức: thời gian mới = max(0, thời gian cũ − thời gian
  online đã trôi qua) + thời gian nạp thêm. Khoảng offline không bị trừ.

Hai quy tắc đầu là quyết định mới của người dùng. Yêu cầu lưu trạng thái
là hệ quả để thực hiện việc giữ thời gian offline. Code web chưa được sửa
trong lần cập nhật tài liệu này. Các phần bên dưới vẫn mô tả snapshot web,
bao gồm cách dùng Date.now() và reset controller cũ, không phải thiết kế
đích cho offline. Sheet LockBase đã mở rộng quy tắc và tiêu chí nghiệm thu.
Các trường hợp nạp khi đang cướp, tắt khóa sớm và quan hệ với Rebirth/phá
khóa vẫn cần chốt. Quy tắc bảo vệ pet ngay cả khi có người lọt vào base đã
được xác nhận ở trên.

## 1. Phạm vi và nguồn kiểm chứng

Tài liệu mô tả hành vi đọc được từ code web hiện tại. Các con số của
prototype là thông số mô phỏng, chưa phải cấu hình balance được xác nhận
trong game. Không có thay đổi cơ chế hoặc UI trong lần viết tài liệu này.

| Nguồn | Vai trò |
|---|---|
| `dist/app-ui-lock-base.js` | Logic Lock Base tại `#uipreview/lock-base`: chọn token, nạp, đếm giờ, hiệu ứng tiêu hao |
| `dist/app-uipreview.js` | Đăng ký và khởi tạo màn; tái sử dụng cây UI Fusion Confirm |
| `dist/data/ui/registry.json` | Khai báo tab Lock Base, nguồn màn `fusion-confirm` |
| `dist/prototypes/lock-base/index.html` | Điểm vào prototype độc lập |
| `dist/prototypes/lock-base/assets/base-lock.js` | Logic prototype độc lập, thanh kéo và thông báo nạp thành công |
| `dist/data/ui/rebirth-rules.json` | Snapshot có `BaseLockTime`; chưa được logic Lock Token trên web sử dụng |

Hai bản web có cùng công thức nạp nhưng khác cách trình bày. GDD lấy hành
vi chung làm cơ chế chính và ghi riêng các khác biệt UI. Các asset/CSS có
tên raid, breaker hoặc shield không đủ chứng minh các cơ chế này đang hoạt
động; hai controller Lock Base được kiểm tra không triển khai chúng.

## 2. Tổng quan cơ chế

Người chơi dùng **Lock Token** để mua thêm thời gian khóa base. Người chơi
chọn số lượng trước, xem thời gian sẽ được cộng, sau đó bấm nạp. Nạp thành
công trừ token ngay và cộng thời gian vào bộ đếm bảo vệ hiện tại.

Ý nghĩa thiết kế thể hiện trên web là cho người chơi chủ động phân bổ tài
nguyên bảo vệ base. Tuy nhiên, web hiện chỉ mô phỏng ví token và thời gian;
chưa thực thi chặn người khác vào base hoặc ngăn trộm pet.

## 3. Tài nguyên và thông số hiện có

| Thành phần | Giá trị/hành vi trên web | Tình trạng |
|---|---|---|
| Tài nguyên | Lock Token, số lượng nguyên | Có trong cả hai bản |
| Quy đổi | 1 token = 30 giây | Hằng số trong controller web |
| Ví khởi tạo | 24 token | Dữ liệu mô phỏng mỗi lần khởi tạo |
| Lượng chọn ban đầu | 0 token | Chưa nạp tự động |
| Thời gian ban đầu | `00:00` | Chưa có bảo vệ từ token |
| Bước chọn | 1 token | Có nút tăng/giảm |
| Lượng chọn tối đa | Toàn bộ token còn trong ví | Không cho chọn vượt ví |
| Tổng thời gian tối đa | Chưa có trần riêng trong logic | Bị giới hạn bởi số token đang có |
| Hoàn lại token | Không có | Prototype ghi rõ không thể lấy lại |
| Nguồn kiếm/mua token | Chưa có dữ liệu | Không có luồng cấp thêm token |

24 token tương đương 720 giây, tức **12 phút**, nếu nạp toàn bộ. Đây là phép
tính từ thông số mô phỏng, không phải mục tiêu balance đã chốt.

## 4. Luồng người chơi

1. Mở Lock Base. Màn hiển thị số token đang có và thời gian còn lại.
2. Chọn số token bằng tăng/giảm, Tối đa hoặc thanh kéo nếu dùng prototype
   độc lập. Đặt lại đưa số lượng chọn về 0.
3. Xem số lượng `đã chọn / đang có` và thời gian cộng thêm dạng `+MM:SS`.
4. Bấm **NẠP TOKEN** / **Use Tokens** khi đã chọn ít nhất 1 token.
5. Hệ thống trừ lượng đã chọn, cộng thời gian bảo vệ và đưa lựa chọn về 0.
6. Bộ đếm giảm theo thời gian thực. Có thể nạp tiếp khi vẫn còn thời gian.
7. Khi thời gian hết, bộ đếm dừng ở `00:00`. Web không có hành động gameplay
   tiếp theo được triển khai tại thời điểm này.

Không có bước xác nhận thứ hai hoặc chức năng hủy giao dịch sau khi nạp.
Đặt lại chỉ xóa lựa chọn chưa nạp; không tác động tới thời gian đã mua.

## 5. Quy tắc tính toán

Đặt:

- `I`: token còn trong ví.
- `Q`: token đang chọn, số nguyên từ 0 đến `I`.
- `E`: thời điểm hết hạn, tính bằng mili giây.
- `N`: thời gian hiện tại từ `Date.now()`.

Thời gian xem trước:

```text
addedSeconds = Q × 30
```

Khi nạp hợp lệ:

```text
E mới = max(N, E cũ) + Q × 30 × 1000
I mới = I cũ − Q
Q mới = 0
```

Thời gian hiển thị:

```text
remainingSeconds = max(0, ceil((E − N) / 1000))
```

Nếu đang được bảo vệ, thời gian nạp thêm nối vào thời điểm hết hạn hiện
có. Nếu chưa khóa hoặc đã hết hạn, thời gian mới bắt đầu từ lúc nạp.
Lựa chọn chưa xác nhận không làm dừng bộ đếm và không trừ token.

Ví dụ: nạp 2 token từ trạng thái hết giờ được 60 giây. Khi còn 40 giây,
nạp thêm 3 token sẽ có khoảng 130 giây còn lại tại thời điểm giao dịch.
Ví giảm tổng cộng 5 token. Sai lệch hiển thị dưới 1 giây có thể xuất hiện
do cách làm tròn lên.

Định dạng là phút:giây, mỗi phần có ít nhất hai chữ số; code không chuyển
sang giờ:phút:giây khi số phút lớn.

## 6. Trạng thái và điều kiện thao tác

| Trạng thái | Hiển thị | Thao tác |
|---|---|---|
| Chưa nạp/hết giờ | `00:00` | Chọn và nạp nếu còn token |
| Đang chọn | Có thời gian `+MM:SS` | Chỉnh số lượng, đặt lại hoặc nạp |
| Đang bảo vệ | Thời gian còn lại lớn hơn 0 | Vẫn được chọn và nạp thêm |
| Hết token | Ví bằng 0 | Không thể tăng, chọn tối đa hoặc nạp |

Trạng thái đang chọn có thể đồng thời tồn tại với trạng thái đang bảo vệ.

- Nút giảm và Đặt lại bị vô hiệu khi `Q = 0`.
- Nút tăng và Tối đa bị vô hiệu khi `Q = I`.
- Nút nạp bị vô hiệu khi `Q = 0`.
- Prototype độc lập còn kiểm `Q > I` khi render và khi xử lý nạp;
  thanh kéo bị vô hiệu khi ví bằng 0.
- UI Preview giữ lựa chọn trong biên qua nút tăng/giảm và reset sau nạp;
  handler nạp chỉ kiểm `Q > 0`, chưa có bước xác thực giao dịch phía server.

## 7. Yêu cầu hiển thị theo bản web

| Thành phần | UI Preview | Prototype độc lập |
|---|---|---|
| Tiêu đề | BASE LOCK | KHÓA BASE |
| Ví | Icon và số token | Lock Token và số đang có |
| Bộ chọn | Tăng, giảm, Max, Reset | Tăng, giảm, Tối đa, Đặt lại và thanh kéo |
| Thời gian | Time Remaining và `MM:SS` | Thời gian còn lại và `MM:SS` |
| Xem trước | `+MM:SS` khi có lựa chọn | `+MM:SS` khi có lựa chọn |
| Nút nạp | Use Tokens, kèm số token | NẠP TOKEN / NẠP Q TOKEN / HẾT TOKEN |
| Phản hồi thành công | Ví, bộ đếm và lựa chọn cập nhật | Thêm dòng thông báo số token và thời gian đã nạp |
| Cảnh báo không hoàn | Chưa có dòng thông báo | Có dòng token đã nạp không thể lấy lại |
| Hiệu ứng tiêu hao | Có icon token đang cháy | Không có logic tương ứng |

Ở UI Preview, số token hiển thị trên slot khi đang chạy là
`ceil(remainingSeconds / 30)`. Đây là số đơn vị thời gian còn lại, không
phải token chưa tiêu trong ví. Token đã bị trừ toàn bộ ngay lúc nạp.
Khi hết giờ, slot dùng số token đang chọn; không có lựa chọn thì ẩn slot.

Hiệu ứng cháy chạy theo phần thời gian còn lại trong từng chu kỳ 30 giây.
Nó không phát sinh lần trừ ví mới. UI Preview cập nhật bộ đếm mỗi 1 giây và
hiệu ứng mỗi 100 ms; prototype độc lập cập nhật bộ đếm mỗi 250 ms.

## 8. Vòng đời và giới hạn hiện tại

Ví token, lượng chọn và thời điểm hết hạn đều nằm trong bộ nhớ của
controller. Không có API giao dịch, lưu máy chủ hoặc lưu các biến này vào
localStorage. Tải lại trang hoặc khởi tạo lại màn sẽ trở về 24 token,
0 token chọn và `00:00`.

Trong UI Preview, chuyển màn rồi quay lại khởi tạo controller mới và mất
trạng thái Lock Base trước đó. Tùy chọn tab được lưu riêng không đồng nghĩa
với việc trạng thái bảo vệ được lưu.

Bộ đếm dùng thời gian thiết bị. Khi callback bị trình duyệt trì hoãn,
lần cập nhật tiếp theo tính lại từ thời điểm hết hạn. Chưa có đồng bộ
thời gian máy chủ hoặc xử lý thay đổi đồng hồ thiết bị.

## 9. Các quyết định còn thiếu trước khi triển khai game

| Nội dung cần chốt | Bằng chứng hiện tại |
|---|---|
| Khóa chặn hành vi nào: vào base, lấy pet hay hành vi khác? | Web chỉ hiển thị thời gian bảo vệ; chưa có kiểm tra hành vi |
| Bắt đầu khóa cần đứng ở đâu, có cần tương tác vật thể? | Màn được mở trực tiếp từ web; chưa có điều kiện khoảng cách |
| Token kiếm từ đâu, có giá mua hoặc giới hạn sở hữu không? | Chưa có dữ liệu |
| Giữ mức 30 giây/token khi lên game hay dùng config khác? | Hiện chỉ là hằng số web |
| Có trần tích lũy thời gian, cooldown hoặc điều kiện nạp không? | Controller chưa có các điều kiện này |
| Lock Token cộng với `BaseLockTime` từ Rebirth ra sao? | Snapshot có trường này nhưng controller Lock Base không đọc |
| Khi offline, đổi server hoặc reconnect có tiếp tục đếm không? | Web chưa lưu trạng thái; chưa xác nhận quy tắc game |
| Người đang trong base hoặc đang mang pet bị xử lý thế nào khi khóa bật? | Chưa có dữ liệu |
| Có phá khóa, miễn nhiễm hoặc ngoại lệ cho người khác không? | Chưa có logic trong hai controller được kiểm tra |
| Ai xác thực trừ token và xử lý nhiều yêu cầu đồng thời? | Chưa có giao dịch server, mã yêu cầu hoặc chống xử lý lặp |

Các mục này là câu hỏi thiết kế còn mở, không phải tính năng mặc định của
cơ chế. Không lấy `BaseLockTime` từ Rebirth thay cho 30 giây/token khi chưa
có quyết định xác nhận quan hệ giữa hai hệ thống.

## 10. Tiêu chí nghiệm thu hành vi web

| Tình huống | Kết quả kỳ vọng từ code hiện tại |
|---|---|
| Khởi tạo màn | Ví 24, chọn 0, giờ `00:00`, nút nạp vô hiệu |
| Chọn 1 token | Hiện `1 / 24`, xem trước `+00:30`, ví chưa bị trừ |
| Chọn Tối đa | Chọn 24, xem trước `+12:00`, không tăng thêm được |
| Đặt lại | Chọn 0, bỏ thời gian xem trước, ví và thời gian đã nạp giữ nguyên |
| Nạp 2 token từ hết giờ | Ví 22, chọn 0, bắt đầu khoảng `01:00` |
| Nạp khi đang chạy | Cộng thêm vào thời gian còn lại, không thay bằng thời gian mới |
| Chờ hết giờ | Hiện `00:00`, không âm, không tự trừ thêm token |
| Nạp toàn bộ ví | Ví 0; không còn thao tác chọn/nạp hợp lệ; giờ vẫn chạy |
| Prototype độc lập sau nạp | Có thông báo số token và thời gian đã nạp |
| UI Preview đang chạy | Slot thể hiện đơn vị thời gian còn lại và hiệu ứng cháy |
| Tải lại/khởi tạo lại | Trở về dữ liệu mô phỏng ban đầu |

Các tiêu chí trên được suy ra từ controller đã đọc, chưa phải báo cáo
chạy nghiệm thu bằng trình duyệt hay xác nhận tích hợp game.
