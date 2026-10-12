# Steal A Pet — Balance & Pacing GDD

Private design dashboard generated from the checked-in StealAPet config snapshot and source references.

## Refresh the data

Run from this folder:

    node tools/sync-source-data.mjs --project-root "D:\Craftland\StealAPet"

The generator mirrors an allowlist of balance and progression CSVs into dist/data/config-snapshot.json, and copies the Pet.csv icon art plus selected action icons into dist/assets. It excludes operational gift-code and compensation exports. It does not edit game files.

## Pet Parade spawn explorer

Use **Pet spawn lab** to inspect the weekday modifier for each road pet and its chance within each player-Rebirth pool. Edit the five player counts to see the code's 60-slot room mix, and toggle Weekend Event independently from the weekday. The default six-player cohort is an editable example, not match telemetry.

The model follows `PetParadeManager.CalculateRoadSpawnWeights`, `GetPetsCount`, and the Mythic guarantee replacement performed while refreshing pools. It shows expected probabilities from the current CSV/code snapshot; it does not reproduce a finite 400-entry pool or a live match's observed counts. Road candidates are normal pet IDs plus Lucky Box IDs; Secret Fusion IDs are loaded for other systems but are not appended to the road-spawn list.

## Item-system config views

- **Mutagen** joins `Mutagen.csv` to `mutation.csv`, applies the runtime pet-rarity and Secret Fusion chance factors, shows the min/max clamp, and plots `MutateCost.csv` bands with the pet-level cost multiplier.
- **Weather Drop / Weathergen** shows item-use chance after pet modifiers, the separate natural weather-effect chance, and the `weatherWaves.csv` cycle sorted by runtime wave ID. The UI labels these as different rolls; `WeatherGen.csv Chance` is not a world item-drop rate.
- **Lucky Box** normalizes `DrawWeight` inside each `BoxID`, joins rewards to pet names/art/rarity, and shows the per-rarity and per-pet odds. It also surfaces the Giftbox Storm road counts from `LuckyBoxManager`.

These pages are read-only views of repository CSV and FC config logic. Derived rules are refreshed from `MutagenConfigs.fcg`, `WeatherGenConfigs.fcg`, `WeatherConfigs.fcg`, `LuckyBoxConfigs.fcg`, `LuckyBoxManager.fcg`, and `WeatherManager.fcg` by the same sync script.

Serve the site locally:

    python -m http.server 8080 --directory dist

Then open http://localhost:8080.

## Data boundaries

The linked Google Sheets could not be read with the available connector during this build. The site labels its snapshot as repository CSV/code data and does not claim it is a fresh pull from those sheets. It has no validated session-time simulator or retention telemetry; pacing is shown as configured progression gates and event cadence.

The site source is its own Git checkout. It does not commit or push the StealAPet game repository.
