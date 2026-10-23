# Steal A Pet — Balance & Pacing GDD

Private design dashboard generated from the checked-in StealAPet config snapshot and source references.

## Refresh the data

Run from this folder:

    node tools/sync-source-data.mjs --project-root "D:\Craftland\StealAPet"

The generator reads an allowlist of balance/progression CSVs and `.fcg` rules from the game checkout, then writes the snapshot and derived JSON under this project's `dist/data/`. The 2,060-row `RotationShopItems.csv` mirror is stored in `dist/data/tables/rotation-shop-items.json`; its schedule join is generated separately in `dist/data/shop-schedule.json`. `reward.csv` is mirrored as `dist/data/tables/rewards.json`, outside the snapshot and loaded only when its page tab opens; `dist/data/missions.json` contains code-verified reward/milestone pairings. It excludes operational gift-code and compensation exports. Existing GDD-local art is referenced when present; sync does not read or write game assets, and never writes into the game checkout.

See [CLAUDE.md](CLAUDE.md) for the read-only source boundary, output guard, project map, and change workflow. Design rulings and open engineering follow-ups live in `design/`.

## Pet Parade spawn explorer

Use **Pet spawn lab** to inspect each road pet's probability for a selected cycle day and match composition. Set Rebirth for each of the six player slots, or disable unused slots; the page maps levels into the five runtime pools and shows each pet's pool odds, combined match chance, and expected appearances per 60 slots. The roster groups pets from Common through Apex, then sorts by `Rank` ascending inside each rarity group. Weekend Event is a separate toggle, not inferred from Saturday or Sunday. The default player levels are an editable example, not match telemetry.

The model follows `PetParadeManager.CalculateRoadSpawnWeights`, `GetPetsCount`, and the Mythic guarantee replacement performed while refreshing pools. It shows expected probabilities from the current CSV/code snapshot; it does not reproduce a finite 400-entry pool or a live match's observed counts. `GetPetsCount` gives the remaining slots to Type5 after flooring Type1–4, including when Type5 has no player; the page mirrors that runtime behavior. Road candidates are normal pet IDs plus Lucky Box IDs; Secret Fusion IDs are loaded for other systems but are not appended to the road-spawn list.

## Item-system config views

- **Mutagen** joins `Mutagen.csv` to `mutation.csv`, applies the runtime pet-rarity and Secret Fusion chance factors, shows the min/max clamp, and plots `MutateCost.csv` bands with the pet-level cost multiplier.
- **Weather Drop / Weathergen** shows item-use chance after pet modifiers, the separate natural weather-effect chance, and the `weatherWaves.csv` cycle sorted by runtime wave ID. The UI labels these as different rolls; `WeatherGen.csv Chance` is not a world item-drop rate.
- **Lucky Box** normalizes `DrawWeight` inside each `BoxID`, joins rewards to pet names/art/rarity, and shows the per-rarity and per-pet odds. It also surfaces the Giftbox Storm road counts from `LuckyBoxManager`.

## Shop Schedule

Use **Lịch shop** to filter the Rotation Shop's fixed item list by wave or item ID/type/value. Rows show the configured `Count`, price fields, and the share of schedule waves containing that item. This is schedule coverage, not a random chance. Event shop can be filtered by `EventType`; its item cards show Gift → Reward details and visualize `TimeAvailable` relative to the scheduled event start when a schedule exists. The normal shop keeps raw CSV fields, including unconfirmed `Requirement`/`TimeLock` units.

These pages are read-only views of repository CSV and FC config logic. Mutation and WeatherGen rows use the matching sprite from `Assets/Sprites/Mutations`; weather-effect sprites are joined by the `weatherEffects.csv` icon key. Derived rules are refreshed from `MutagenConfigs.fcg`, `WeatherGenConfigs.fcg`, `WeatherConfigs.fcg`, `LuckyBoxConfigs.fcg`, `LuckyBoxManager.fcg`, and `WeatherManager.fcg` by the same sync script.

## Missions & Rewards

Use **Nhiệm vụ & quà** for daily gifts (filter by reward type and minimum Rebirth), onboarding and Revival mission rewards (filter by reward type), and Lucky Spin rewards. Gift IDs resolve to Reward IDs through the runtime gift lookup; reward cards show item art, type, configured quantity, and readable details. Lucky Spin odds are normalized from `loginReward.csv` weights; the wheel angle is shown as presentation data, not as the odds source. Revival target values are formatted as time because the runtime sends them to its time formatter.

Serve the site locally:

    python -m http.server 8080 --directory dist

Then open http://localhost:8080.

## Pool & phần thưởng

Use **Pool & phần thưởng** to review `PoolRandomItem`, secret reward pools, Dig and Fishing pet/reward pools, GuaranteePool, and Collector/FuseContract schedules. `dist/data/pools.json` stores weight shares precomputed by sync. A share appears only when the `.fcg` load/draw code confirms a weighted selection; Dig/Fishing chest counters, GuaranteePool, and event schedules remain raw where runtime semantics do not establish a per-item probability. Fishing bands follow the runtime Rebirth mapping (RB 0–5 through RB 21+). Large tables are filtered and paginated in the page; IDs and reward values remain raw unless their meaning is confirmed by source code.

## Data boundaries

The linked Google Sheets could not be read with the available connector during this build. The site labels its snapshot as repository CSV/code data and does not claim it is a fresh pull from those sheets. The gift view projects only referenced Gift `ID` → `Reward` ID links from `giftcode.csv`; redeem codes, limits, and availability fields are excluded. It has no validated session-time simulator or retention telemetry; pacing is shown as configured progression gates and event cadence.

The site source is its own Git checkout. It does not commit or push the StealAPet game repository.
