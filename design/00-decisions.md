# Quyết định thiết kế

Ngày ghi nhận: 2026-10-22. Các mục dưới đây ghi lại quyết định đã có trong README và plan; đây không phải đề xuất số balance mới.

## D-001 — Giữ site tĩnh

- **Trạng thái:** ✅ Đã chốt trong plan.
- **Quyết định:** Không dùng Express hoặc server ứng dụng. Script `tools/*.mjs` sinh dữ liệu vào `dist/data/`; site đọc JSON tĩnh.
- **Lý do:** Giữ cách chạy và phân phối hiện tại, không thêm runtime dependency.
- **Phạm vi:** F9 chỉ xem diff và tải dữ liệu; mô phỏng F10 chạy offline nếu sau này được duyệt.
- **Nguồn:** `plans/PLAN-features-from-pvz.md` §3; `README.md`.

## D-002 — Snapshot loại dữ liệu vận hành, chỉ chiếu khóa quà cần thiết

- **Trạng thái:** ✅ Quy tắc nguồn hiện hành.
- **Quyết định:** CSV/code trong checkout game là nguồn của snapshot; không tuyên bố đã đồng bộ Google Sheets. Không mirror `Assets/CSV/giftcode.csv` hoặc `Assets/CSV/Compensate/**`. Để hiển thị quà theo yêu cầu, sync chỉ xuất `ID` → `Reward` cho Gift ID được config hiện hành tham chiếu; không lưu hoặc hiển thị Code, Name, Limit, Start, End, Reuse hay Rebirth.
- **Lý do:** Giữ phần dữ liệu vận hành riêng khỏi site GDD, đồng thời cho phép xem nội dung reward của gift đang được config dùng.
- **Nguồn:** `README.md`; `plans/PLAN-features-from-pvz.md` §5.

## D-003 — Không đổi tiến trình thành phút chơi khi chưa có income model

- **Trạng thái:** ✅ Giới hạn hiện tại đã được ghi nhận.
- **Quyết định:** Có thể hiển thị gate và giá trị cấu hình; không đưa ra phút tới mục tiêu hoặc kết luận retention nếu chưa xác nhận logic income và có dữ liệu phù hợp.
- **Lý do:** CSV Rebirth và spawn chưa đủ mô tả thu nhập trong base, hành vi trộm/phòng thủ hoặc thời gian chơi thực tế.
- **Nguồn:** `README.md` phần Data boundaries; `plans/PLAN-features-from-pvz.md` F10 và §5.

## D-004 — Map Rotation Shop và icon thời tiết theo enum nguồn

- **Trạng thái:** ✅ Đã xác nhận từ `RSItemType`, CSV và UI game.
- **Quyết định:** Rotation Shop dùng Pet=1, Mutagen=2, Weather=3, WeatherGen=4. Pet weather và WeatherGen lấy icon từ `weatherEffects.csv`; item Weather và shop thường `Summon<X>` lấy icon thời tiết gốc qua `weather.csv` → `Assets/Sprites/Weather`.
- **Lý do:** Weather effect trên pet/WeatherGen và weather của world là hai catalog/icon set riêng.
- **Phạm vi:** Sync chỉ copy sprite thời tiết cần dùng vào `dist/assets/weather-icons/`; nếu không tìm thấy nguồn sau hai phép dò tên thì ghi nhận trong `visualAssets.missingWeatherIcons`. Output của sync vẫn bị giới hạn trong `dist/`.
- **Nguồn:** `EditorGenLib.fcc` · `RotationShopItems.csv` · `weather.csv` · `weatherEffects.csv` · `HudShop.fcg` · `HudRotationShop.fcg` · `RewardManager.fcg`.

## D-005 — Nền item dùng rarity màu game khi có nguồn

- **Trạng thái:** ✅ Quy tắc trình bày từ config game.
- **Quyết định:** Nền shop Rotation dùng rarity pet/Mutagen từ CSV; WeatherGen dùng cột `Rarity` của `WeatherGen.csv`; reward pet, MutaGen, WeatherGen và pet ngẫu nhiên dùng nguồn tương ứng. Shop thường, weather summon, tiền, Dust, vé và spin giữ rarity NONE, màu `#8DA6B6`.
- **Lý do:** Rarity chỉ được hiển thị khi có nguồn config; weather effect và weather summon không tự suy ra rarity.
- **Phạm vi:** Art và viền item dùng palette `PetConfigs.RARITY_COLOR`: COMMON `#8CFF91`, RARE `#4CC8FE`, EPIC `#EA70FF`, LEGENDARY `#FED868`, MYTHIC `#FF6F6F`, APEX `#FF9F43`, LIMITED `#B3CA1F`, NONE `#8DA6B6`.
- **Nguồn:** `PetConfigs.fcg` · `Mutagen.csv` · `WeatherGen.csv` · `reward.csv` · `RewardManager.fcg`.

## D-006 — Đọc HUD UI và sprite tham chiếu cho UI Preview

- **Trạng thái:** ✅ Đã chốt theo yêu cầu triển khai UI Preview.
- **Quyết định:** Mở rộng allowlist đọc-only của checkout game cho `Assets/HUDs/<UI đã đăng ký>.ui` và đúng các sprite mà file đó tham chiếu. Phase này chỉ đăng ký `PetsCollection.ui`. Dữ liệu dẫn xuất và sprite copy chỉ ghi dưới `dist/` của GDD.
- **Lý do:** Bố cục Collection cần lấy trực tiếp từ cây entity và asset gốc; không tự dựng tọa độ hoặc màu.
- **Giới hạn:** Không chạy Studio/build, không ghi vào checkout game, không đọc `Compensate/**` hoặc `giftcode.csv` cho tính năng này.
- **Nguồn:** `plans/PLAN-ui-preview.md` §2–3; yêu cầu UI Preview.

## D-007 — Dùng sở hữu giả lập trong Collection preview

- **Trạng thái:** ✅ Đã triển khai cho preview tĩnh.
- **Quyết định:** Cho chọn sở hữu tất cả, không sở hữu, ngẫu nhiên theo seed hoặc tự chọn pet/mutation/weather. Hiển thị nhãn “Người chơi giả lập”; không ghi hoặc suy ra sở hữu thật.
- **Giới hạn:** Các cặp pet và effect trong chế độ ngẫu nhiên chỉ để kiểm tra trạng thái HUD, không mô tả tỉ lệ sở hữu trong game.
- **Nguồn:** `plans/PLAN-ui-preview.md` §3.4; `CollectionManager.fcg` về dữ liệu sở hữu.

## D-008 — Mở rộng nguồn đọc cho độ chính xác UI Collection

- **Trạng thái:** ✅ Người dùng đã đồng ý ngày 2026-10-23.
- **Quyết định:** Cho phép đọc-only `.png.meta` của các sprite UI Collection được dùng để lấy border 9-grid; `Assets/Localization/key.csv` để trích duy nhất các key Collection thực sự dùng; sprite runtime mà `HudCollection.fcg` hoặc config gán cho UI này; và file/bảng định nghĩa `EResSprite`/`Res.Sprite` cần để ánh xạ chúng. Không mirror toàn bộ localization hoặc asset ngoài phạm vi UI Collection.
- **Giới hạn:** Không đọc `Compensate/**` và `giftcode.csv`; không ghi hay chạy Git ghi trong project game. Mọi JSON và sprite dẫn xuất chỉ ghi dưới `dist/` của GDD với guard đường dẫn.
- **Nguồn:** Yêu cầu sửa UI Preview > Collection ngày 2026-10-23.
