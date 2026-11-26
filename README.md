# Steal A Pet — Balance & Pacing GDD

Private design dashboard generated from the checked-in StealAPet config snapshot and source references.

## Mở dashboard trên Windows

Chạy `start.cmd` ở thư mục project. Launcher dùng Python để phục vụ `dist/`
qua HTTP tại `127.0.0.1`, rồi tự mở trình duyệt. Nếu server của snapshot này
đang chạy, launcher dùng lại. Không mở trực tiếp `dist/index.html` bằng
`file://` vì trình duyệt chặn tải JSON. Snapshot đã có sẵn trong repository;
không cần sync từ project game để xem dashboard.

## UI Preview · batch 2026-11-01

Đã adapt từ cây UI/controller/config/sprite nguồn; mỗi nhóm UI một commit local:

| UI | Route | Ghi chú |
|---|---|---|
| Shop Event | `#uipreview/shop-event` | shop, tasks, dialog, submit; reward catalogs |
| Rebirth | `#uipreview/rebirth` | requirements/rewards, max level, UnlockContent |
| Lobby | `#uipreview/lobby` | weather/event/weekend và Details |
| Fusion | `#uipreview/fusion-confirm`, `#uipreview/fusion-result` | dust, chances, result/retrieve/weekend |
| Leaderboard | `#uipreview/leaderboard` | bốn tab, loading/empty, top10/current rank |
| Permanent Event | `#uipreview/permanent-event` | chọn type Dig/Fish trong bảng mô phỏng |
| Storage | `#uipreview/storage` | capacity, paging, details, confirm, lock/retrieve |

Mỗi UI có `plans/PLAN-ui-*.md` ghi phạm vi và kết quả kiểm. Sync riêng bằng
`node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet" --screen <id>`;
audit bằng `node tools/audit-ui-source-screen.mjs --project-root "C:\_Code\craftland\StealAPet" --screen <id>`.
Fusion có thêm `node tools/audit-ui-fusion-model.mjs`.

Người chơi là mô phỏng cục bộ. Một số sprite lib/asset cũ chưa có đúng bytes,
native UIProfile chưa dựng avatar/tên tài khoản; ConfirmWidget Rebirth đã
vắng trong cây nguồn nên nút QA nằm ngoài canvas. Fusion giữ transform nguồn
cho non-grid `fill` vì engine algorithm chưa xác minh. Các gap chi tiết nằm
trong manifest/audit/plan; chưa có ảnh game để kết luận pixel parity.
Giữ nguyên Proposal và snapshot Collection cũ; hai audit cũ hiện báo source
alpha/binding drift với checkout game, không regenerate ngoài phạm vi batch.

## Mail · UI Preview

Công cụ **Soạn quà → GMT Mails Manager** bên dưới canvas cho chọn tối đa
5 quà, tự sinh IsConfig/GiftId/RewardTypes/RewardValues/RewardAmounts,
sao chép từng field hoặc tất cả và xem mail tự soạn trên canvas. Mặc định
là ví dụ 10 Pet Coin + 500 Dust; draft lưu trong trình duyệt.
Không gửi mail thật. Dùng Update Pending Mails trong GMT; source có giới
hạn parse/lưu RV nhiều quà được cảnh báo trong tool.
Xem [hợp đồng field và kiểm chứng](plans/PLAN-mail-composer.md).

Mở `#uipreview/mail` hoặc chọn Mail cạnh Collection/Activities/Shop.
Mail dựng từ 128 entity của project: hai tab Thông báo/Hệ thống, chọn thư,
nội dung localization, phần thưởng và nhận thử. Panel có hộp thư trống,
5 thư thử hoặc 30 thư; dữ liệu thử tổng hợp, không lấy hộp thư server.
Nhận thử chỉ cập nhật RAM, có kiểm ô trống cho thưởng pet.

Sync riêng: `node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet" --screen mail`.
Audit: `node tools/audit-ui-mail.mjs --project-root "C:\_Code\craftland\StealAPet"`.
Đã kiểm desktop/mobile và tương tác; 31/36 sprite có PNG, 5 sprite thiếu
được ghi trong manifest. Chưa có ảnh game để xác nhận pixel parity.
Xem [kế hoạch và nghiệm thu](plans/PLAN-ui-mail.md).

## Shop · UI Preview

Mở `#uipreview/shop` hoặc chọn Shop cạnh Collection/Activities. Pipeline đọc
`Shop.ui` và HudShop/config, giữ đủ 70 entity, raw props/callback, sprite
identity/9-grid và runtime override trong Inspector. Có ba nhóm hàng, chọn
món/chi tiết, hai loại ví, giá bạn bè, pet theo Rebirth, stock và cooldown.
Ví/wave/mua thử là mô phỏng RAM; không chạy gameplay UseItem hay server.

Sync riêng: `node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet" --screen shop`.
Audit: `node tools/audit-ui-shop.mjs --project-root "C:\_Code\craftland\StealAPet"`.
Nguồn có 110 sprite tham chiếu: 100 PNG đã kiểm hash/metadata, 7 sprite
thư viện `lib://` và 3 đường dẫn thời tiết chưa resolve được theo fileId.
Không thay bằng PNG cùng tên khi identity khác. Font/shader/scaler và pixel
parity engine chưa xác minh; xem `plans/PLAN-ui-shop.md` và `shop-audit.json`.

## Activities · UI Preview

Mở `#uipreview/activities` hoặc chọn Activities bên cạnh Collection. Snapshot
Activities có 286 entity, 54 sprite trong manifest; 50 có PNG cục bộ, 4 sprite
`lib://` chưa có file. Giữ nguyên entity ID, raw props và callback để Inspect.
Controller/config, localization và sprite runtime lấy từ source có hash.
Thanh Pet Points chung của 5 milestone dùng nền màu tạm theo tint/geometry
source để hiển thị dù thiếu sprite white `lib://`; Inspector ghi RenderFallback,
manifest vẫn đánh dấu thiếu PNG. Thanh chỉ tăng khi nhận điểm nhiệm vụ.

Hỗ trợ quà đăng nhập theo UserType/Rebirth, nhiệm vụ theo ngày cycle, tiến độ,
nhận thưởng/mốc Pet Points và vòng quay theo weight/angle config. Panel người
chơi là mô phỏng cục bộ. Tab Event giữ inactive theo `.ui`; công cụ trong panel
cho xem riêng nội dung Event và thử trạng thái nhận, không mở tab game.

Chạy `node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet" --screen activities`
và `node tools/audit-ui-activities.mjs --project-root "C:\_Code\craftland\StealAPet" --browser-url http://localhost:8080`.
Report/ảnh ở `dist/data/ui/activities-*`; kế hoạch ở `plans/PLAN-ui-activities.md`.
Không regenerate Collection/Proposal khi chỉ sync Activities. Chưa có ảnh
engine để xác nhận pixel parity; font/shader/scaler, inertia, tooltip/effect và
server/database chưa được mô phỏng đầy đủ. MoneyTime dùng thu nhập base nhập
trong panel. Website vẫn static; thay đổi này chỉ commit local, không publish.

## UI Components

Đã thêm 11 template Activities (27 component tổng cộng). Lọc **Nguồn →
Activities** để xem thẻ quà, dòng nhiệm vụ, ô thưởng, mốc/thanh điểm, tab và
vòng quay. Mỗi component có slot/state, spec và nút Sao chép template JSON.
Nguồn định nghĩa: `design/ui-components/activities-*.json`; kế hoạch ở
`plans/PLAN-ui-components-activities.md`. Không đổi UI Preview/Proposal.

Thư viện riêng ở `#uicomponents`, ngay dưới UI Proposal, theo
`plans/PLAN-ui-components.md`. Nguồn duy nhất là snapshot Collection và sprite
đã sync trong GDD. Không đổi allowlist, UI Preview hoặc nội dung UI Proposal.
Định nghĩa: `design/ui-components/`; sync: `node tools/sync-ui-components.mjs`;
audit: `node tools/audit-ui-components.mjs`.
Catalog đã chốt gồm 16 component; preview chỉnh slot/state, spec dẫn xuất,
quan hệ tái dùng và xuất template op add. [Catalog/schema](design/ui-components/README.md),
[báo cáo nghiệm thu và ranh giới](design/ui-components/QA.md).
Components: 219 case tĩnh; hai viewport, 112 lượt slot/22 lượt state;
26 crop/DOM Preview–Proposal không đổi. Lỗi có sẵn của ba Proposal thưởng
ở mode current được bảo toàn và ghi DA-019, không gọi là console sạch.

## UI Preview: sprite đã move/rename và label (2026-10-25)

`Assets/HUDs/PetsCollection.ui` lưu cả `fileId` và `filePath` trong
`propsData.image.source` / `propsData.button.spriteName`. Move/rename PNG
không đảm bảo đường dẫn đã serialize trong HUD được cập nhật. Sync hiện
tra ID trong `.png.meta` ở `Assets/Sprites/NewAssets/`, chỉ copy PNG có ID
khớp và giữ `declaredKeys` trong `collection-sprites.json` để truy vết.
Ví dụ `Img_bg02_BG.png` → `ContainerBG.png`, `Img_decorate01/02.png` →
`DecorateIcon1/2.png`, `Icon_mutation.png` → `HasMWIcon.png`. Hai alias
BG/ShadowTriangleRounded được xác thực ID với metadata tại đường dẫn mới.
Resource đang dùng hiển thị cả đường dẫn thực và đường dẫn cũ trong `.ui`.

Renderer ghép 9-slice vào bitmap ở kích thước tham chiếu trước khi scale,
tránh đường nối vuông của CSS border-image. Label `overflow=0` (Reduce
when exceed, do designer xác nhận) tự giảm từ `fontSize` nguồn, cập nhật
khi đổi nội dung/ngôn ngữ/kích thước; giữ bold/italic và căn ngang/dọc.
Font `Default` vẫn dùng sans-serif hệ thống vì chưa có font engine gốc.
Placeholder chỉ hiện khi bật Debug; bảng resource vẫn ghi sprite thiếu.
Hiện còn 2 sprite `lib://` không có file trong checkout.

Collection bindings: clone sprite được xử lý lại tint/gradient riêng, gồm
HasMW. Khung pet lớn cập nhật cả thanh `Rarity` (UIUtils.UpdatePetWidgetV3;
chưa sở hữu dùng DEFAULT_COLOR) và badge `RarityBG` (HudCollection).
Sync xuất nguồn nhận cho từng pet theo thứ tự Giftcode → LuckyBox → Fusion
→ Road → Fishing → Dig → Event, kiểm membership từ PoolFishing/DigPools
như client config; không phụ thuộc event hiện đang mở. Recipe dùng icon
`Summon<previousPetRarity>` từ `Assets/Sprites/Summon/`, nhãn/màu ô bất kỳ
theo rarity pet đích và giữ pet cụ thể ở ô thứ hai nếu pet trước là secret.

## UI Proposal

### Collection rewards · 2026-10-25

Ba phương án ở UI Proposal: `#uiproposal/collection/collection-rewards-inline`
(A, khuyến nghị: thanh thưởng trong tab), `collection-rewards-overview`
(B: hai thẻ ở Info), `collection-rewards-roadmap` (C: cửa sổ lộ trình).
Có nút chuyển A/B/C, ưu/nhược điểm, các tình huống 3/3, 4/4, 8/4,
đủ toàn bộ loại và khôi phục demo. Nhận thử cập nhật badge pet, rarity
và từng tab Mutation/Weather; quà của pet khác vẫn giữ badge nhóm.

Quy tắc 4 loại/mốc/nhánh do người dùng cung cấp. Giả định đếm loại đã
ghi nhận trong Collection theo pet type; không đếm số hiệu ứng đồng thời.
Snapshot có 10 loại mỗi nhánh nên chỉ hiện mốc 4 và 8. Lượng Cash/Dust
ghi “chưa có dữ liệu”; không dùng số thưởng giả. Claim chỉ lưu trong RAM.
Spec: `design/ui-proposals/collection-reward-experiments.json`; layout
patch: ba file `collection/collection-rewards-*.json`. Helper tác giả
`tools/create-collection-reward-proposals.mjs` tái tạo các patch; sau khi
designer sửa patch bằng tay, không chạy helper nếu muốn giữ thay đổi đó.
`sync-ui-proposals.mjs` sinh JSON/resource/diff/prompt và spec cho website.

QA phiên này: 671 case tĩnh; browser trong pane 650×668 kiểm A/B/C,
nhận độc lập hai nhánh, giữ badge nhóm, Current/Overlay/Proposed và
không sở hữu. Chi tiết: `design/ui-proposals/collection-rewards-qa.md`.
Chưa đối chiếu runtime game hoặc kiểm viewport 390/1440 trong phiên này.

Mở `#uiproposal/collection/collection-pipeline-example` hoặc mục **UI Proposal**
ngay dưới UI Preview. Trang so sánh Hiện tại/Đề xuất/Chồng lớp trên renderer
chung, có Inspector (right-click hoặc bật chạm Inspect), prompt tự sinh và
bảng resource có bộ lọc. Demo chỉ là “ví dụ để kiểm pipeline”, chưa duyệt.

Nguồn JSON/PNG do GDD sở hữu ở `design/ui-proposals/`; [hợp đồng schema,
74 field và nguồn MCP](design/ui-proposals/README.md). Không ghi repo game.

```powershell
node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"
node tools/sync-ui-proposals.mjs
node tools/audit-ui-proposals.mjs
python -m http.server 8080 --directory dist
# Khi đã có server và Playwright trong môi trường QA:
node tools/audit-ui-proposals.mjs --browser-url http://localhost:8080
```

Audit Proposal: 153 case tĩnh; browser 1440×1100/390×844, ba chế độ, opacity,
Inspector, clipboard thành công/bị chặn, lọc/tìm, deep-link/storage, fixture
cấu trúc 108 entity khớp DOM; console sạch, không tràn ngang. Report ở
`dist/data/ui/proposals-audit.json`; ảnh QA cùng thư mục. UI Preview hồi quy
107/107 entity, 173 pet và 214 click/viewport. Chưa khẳng định parity game;
xem DA-002–015. Snapshot config đã regenerate theo checkout hiện tại
master/1075dcec, khác snapshot GDD cũ dev/290aacf2; không sửa config game.

## Refresh the data

Run from this folder:

    node tools/sync-source-data.mjs --project-root "C:\_Code\craftland\StealAPet"

The generator reads an allowlist of balance/progression CSVs and `.fcg` rules from the game checkout, then writes the snapshot and derived JSON under this project's `dist/data/`. The 2,060-row `RotationShopItems.csv` mirror is stored in `dist/data/tables/rotation-shop-items.json`; its schedule join is generated separately in `dist/data/shop-schedule.json`. `reward.csv` is mirrored as `dist/data/tables/rewards.json`, outside the snapshot and loaded only when its page tab opens; `dist/data/missions.json` contains code-verified reward/milestone pairings. It excludes operational gift-code and compensation exports. Existing GDD-local pet/system art is referenced when present; sync copies only weather sprites from `Assets/Sprites/Weather` into `dist/assets/weather-icons/`. It never writes into the game checkout or outside this project's `dist/`.

See [CLAUDE.md](CLAUDE.md) for the read-only source boundary, output guard, project map, and change workflow. Design rulings and open engineering follow-ups live in `design/`.

## UI Preview · Collection

Quy trình tái sử dụng cho Codex/Claude:
[`map-game-ui`](design/skills/map-game-ui/SKILL.md), gồm rule mapping từ
source, regression gắn với commit Collection, acceptance gates và prompt
cho màn hình tiếp theo. Skill tách phần dùng chung khỏi allowlist SAP;
audit web pass chưa thay thế đối chiếu runtime game.

Chạy sync HUD riêng rồi serve site:

```powershell
node tools/sync-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"
node tools/audit-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet"
python -m http.server 8080 --directory dist
```

Mở **UI Preview → Collection** hoặc `http://localhost:8080/#uipreview/collection`. Mission còn “Sắp có”; các màn đã adapt được liệt kê ở đầu README. Trang đọc cây entity từ `PetsCollection.ui`, rule từ `HudCollection.fcg`/`CollectionManager.fcg`/`PetConfigs.fcg`, và dữ liệu pet/effect từ snapshot GDD hiện có. Có thể xem rarity, phân trang, chọn pet, ba tab chi tiết, bật debug/inactive và giả lập sở hữu; đây không phải dữ liệu người chơi thật. Nếu snapshot GDD cũ, cập nhật snapshot theo runbook riêng trước khi đối chiếu dữ liệu.

Collection có bộ chọn **Tiếng Việt / English** (mặc định tiếng Việt), bảng **Resource đang dùng** và trạng thái sở hữu mô phỏng. Bảng cho xem đường dẫn entity, sprite hiện dùng, kích thước/border 9-grid, màu button, loại image và localization; có thể lọc theo path. Bảng chỉ hiển thị, không chọn/scroll/focus từ preview; hàng được giữ theo ID và chỉ cập nhật ô thay đổi. Không có hiệu ứng hover trong UI Preview; widget dùng trạng thái normal/pressed/disabled. Chuột phải trên canvas mở **Widget Inspector** với danh sách widget chồng nhau, source/runtime props và nút sao chép JSON. Cột alpha ghi giá trị gốc .ui và alpha cộng dồn web; cascade/raycast engine chưa xác minh (DA-009). Button alpha 0 vẫn có vùng click RectTransform; disableCollider tắt vùng click. Sync trích key Collection từ Assets/Localization/key.csv vào dist/data/ui/collection-i18n.json; sprite .ui và icon Obtain gán bằng code nằm trong manifest riêng. dist/data/ui/collection-audit.json ghi sprite/key còn thiếu và đối chiếu border với .png.meta.

Audit hiện tại: 107/107 entity (gồm root), DOM 107/107 path+ID+type, không lệch; 41 sprite tham chiếu, 34 copy được, 7 thiếu/ngoài allowlist. Có 57 entity với 76 trường chưa được renderer xử lý (phần lớn metadata animation và callback), cùng 8 localization key thiếu. Kích thước 1500×750 suy từ root .ui, chưa xác minh độ phân giải engine. Font metrics, raster/shader và scale/safe-area chưa xác nhận trong Craftland Editor; preview là bản dựng từ source, không phải ảnh đối chiếu engine. Danh sách chi tiết ở dist/data/ui/collection-audit.json, collection-browser-audit.json, collection-sprites.json và design/20-dev-action-items.md.

## Pet Parade spawn explorer

Use **Pet spawn lab** to inspect each road pet's probability for a selected cycle day and match composition. Set Rebirth for each of the six player slots, or disable unused slots; the page maps levels into the five runtime pools and shows each pet's pool odds, combined match chance, and expected appearances per 60 slots. The roster groups pets from Common through Apex, then sorts by `Rank` ascending inside each rarity group. Weekend Event is a separate toggle, not inferred from Saturday or Sunday. The default player levels are an editable example, not match telemetry.

The model follows `PetParadeManager.CalculateRoadSpawnWeights`, `GetPetsCount`, and the Mythic guarantee replacement performed while refreshing pools. It shows expected probabilities from the current CSV/code snapshot; it does not reproduce a finite 400-entry pool or a live match's observed counts. `GetPetsCount` gives the remaining slots to Type5 after flooring Type1–4, including when Type5 has no player; the page mirrors that runtime behavior. Road candidates are normal pet IDs plus Lucky Box IDs; Secret Fusion IDs are loaded for other systems but are not appended to the road-spawn list.

## Item-system config views

- **Mutagen** joins `Mutagen.csv` to `mutation.csv`, applies the runtime pet-rarity and Secret Fusion chance factors, shows the min/max clamp, and plots `MutateCost.csv` bands with the pet-level cost multiplier.
- **Weather Drop / Weathergen** shows item-use chance after pet modifiers, the separate natural weather-effect chance, and the `weatherWaves.csv` cycle sorted by runtime wave ID. The UI labels these as different rolls; `WeatherGen.csv Chance` is not a world item-drop rate.
- **Lucky Box** normalizes `DrawWeight` inside each `BoxID`, joins rewards to pet names/art/rarity, and shows the per-rarity and per-pet odds. It also surfaces the Giftbox Storm road counts from `LuckyBoxManager`.

## Shop Schedule

Use **Lịch shop** to filter the Rotation Shop's scheduled items by wave or item ID/type/value. Cards show the pet, mutation or WeatherGen icon, stock, prices, and share of schedule waves containing that item. This is schedule coverage, not a random chance. Rotation item types follow `RSItemType`: Pet=1, Mutagen=2, Weather=3, WeatherGen=4. Weather=3 and standard-shop `Summon<X>` use the source weather sprite selected by `weather.csv` Icon; pet weather and WeatherGen use `weatherEffects.csv` icons. Standard shop cards otherwise use the icon key from `shopItems.csv`. Item art backgrounds use the game rarity palette when a CSV/reward rarity exists; unclassified items use the neutral `#8DA6B6` color. Event shop filters show the event name and Shop ID; item cards map Gift → Reward and visualize `TimeAvailable` relative to the scheduled event start when a schedule exists.

These pages are read-only views of repository CSV and FC config logic. Mutation icons use their matching mutation sprites; pet weather and WeatherGen use the `weatherEffects.csv` icon key. Weather summons use the original world-weather sprite from `Assets/Sprites/Weather`. Derived rules are refreshed from `MutagenConfigs.fcg`, `WeatherGenConfigs.fcg`, `WeatherConfigs.fcg`, `LuckyBoxConfigs.fcg`, `LuckyBoxManager.fcg`, and `WeatherManager.fcg` by the same sync script.

Core item and reward sprites used by the standalone shop, Activities rewards, and pool views are bundled under `dist/assets/game-sprites`; source weather sprites are generated into `dist/assets/weather-icons` and keyed by weather ID in `config-snapshot.json`. Weather-effect icons are keyed separately by weather-effect ID from `dist/assets/system-icons`.

## Missions & Rewards

Use **Nhiệm vụ & quà** for daily gifts (filter by UserType and minimum Rebirth), onboarding rewards (filter by reward type), Revival mission rewards (filter by Rebirth), and Lucky Spin odds. Gift IDs resolve to Reward IDs through the runtime gift lookup; reward cards use the corresponding item, pet, mutation or weather icon and show type, configured quantity, and readable details. Lucky Spin odds are normalized from `loginReward.csv` weights; the wheel angle is shown as presentation data, not as the odds source. Revival target values are formatted as time because the runtime sends them to its time formatter.

Serve the site locally:

    python -m http.server 8080 --directory dist

Then open http://localhost:8080.

## Pool & phần thưởng

Use **Pool & phần thưởng** to review `PoolRandomItem`, secret reward pools, Dig and Fishing pet/reward pools, GuaranteePool, and Collector/FuseContract schedules. Each row includes its matching pet, reward, item or chest icon. `dist/data/pools.json` stores weight shares precomputed by sync. A share appears only when the `.fcg` load/draw code confirms a weighted selection; Dig/Fishing chest counters, GuaranteePool, and event schedules remain raw where runtime semantics do not establish a per-item probability. Fishing bands follow the runtime Rebirth mapping (RB 0–5 through RB 21+). Large tables are filtered and paginated in the page; IDs and reward values remain raw unless their meaning is confirmed by source code.

## Guarantee theo ngày (Chase Apex)

Use **Guarantee theo ngày** for Dig, Fish and Lucky Box pity ceilings from
`ChaseConfigs.fcg` and `ChaseManager.fcg`. Sync generates `dist/data/chase.json`;
the browser only renders the derived data. Days count full daily quotas from a
fresh counter with no Chase hit, across GMT day boundaries, independently of the
world's seven-day cycle. The page shows each day's maximum per-roll rate and the
plateau, eligibility rules, feature flags, Limited-first Box probabilities, and
positive-weight leaks in ordinary pools. These are conditional rate ceilings,
not cumulative daily success probabilities or a 100% guarantee. Extra rolls
after the daily quota keep rolling without increasing pity.

The audited source is commit `2c3598a21952bf57ae09b56cf65dd7a6fe6e1794`.
Current code gives 10.921021375% at Fish/Dig shot 56 and 26.6648% at Box shot 21.
The original GDD's 80% at day 7 is cumulative first-hit probability,
not the per-shot rate. The constants reproduce 79.9998% for Fish/Dig
after 56 eligible shots. Box reaches 79.9997% after 21 opens when Limited
is excluded; the runtime Limited-first flow lowers Chase first-hit probability
to 77.5462%, because Kirin can consume daily quota without increasing pity.
These figures assume exactly the daily cap of eligible actions, starting at
zero, and exclude ordinary-pool leaks. See
`design/20-dev-action-items.md` for confirmed config concerns.

Validate calculations after sync: `node --test tools/chase-model.test.mjs`.

Primary audience: designers auditing all progression cohorts; secondary:
developers checking config and call sites. No player-facing progression changes.
The tables make the rate cap and counter rules inspectable; their limitation is
that player history, eligible action frequency and daily hit probability are not
modeled.

## Source boundaries

The linked Google Sheets could not be read with the available connector during this build. The site labels its snapshot as repository CSV/code data and does not claim it is a fresh pull from those sheets. The gift view projects only referenced Gift `ID` → `Reward` ID links from `giftcode.csv`; redeem codes, limits, and availability fields are excluded. It has no validated session-time simulator or retention telemetry; pacing is shown as configured progression gates and event cadence.

The site source is its own Git checkout. It does not commit or push the StealAPet game repository.

### QA alpha / scroll Collection

Audit tĩnh kiểm tra alpha/collider với `.ui` và chặn lệnh cuộn, focus hoặc
navigation trong ba module preview. Để chạy thêm kiểm thử trình duyệt (cần
Playwright trong môi trường QA và Microsoft Edge đã cài):

```powershell
$env:NODE_PATH = "C:\Users\trang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
node tools/audit-ui-preview.mjs --project-root "C:\_Code\craftland\StealAPet" --browser-url http://localhost:8080
```

Có thể đặt `UI_AUDIT_BROWSER=chrome` nếu dùng Chrome. Browser audit dùng click theo tọa độ, không dựa vào thao tác click tự cuộn của Playwright. Nó kiểm tra hit target, alpha, màu rarity theo RARITY_COLOR, owned/unowned, mọi tab và pet qua tất cả trang, Recipe redirect, Inspector, resource row không đổi khi rê chuột và 12 widget mẫu.

Báo cáo so sánh transform/color từ source .ui với AABB/màu web đo được nằm trong dist/data/ui/collection-browser-audit.json; đây không phải số đo từ game. Viewport kiểm tra: 1440×1100 và 390×844. Chỉ bỏ qua 404 /favicon.ico mặc định; lỗi console/page khác làm audit thất bại. Đây là QA hành vi web, không thay thế xác nhận engine ở DA-009. Trước QA, chạy sync-ui-preview.mjs và khởi động server ở trên. Audit gồm cả trang cuối, ba tab chi tiết, Recipe redirect và hai trạng thái sở hữu. Các giới hạn asset/font/render vẫn giữ nguyên; chưa tuyên bố khớp game.
