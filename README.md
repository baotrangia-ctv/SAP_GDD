# Steal A Pet — Balance & Pacing GDD

Private design dashboard generated from the checked-in StealAPet config snapshot and source references.

## Refresh the data

Run from this folder:

    node tools/sync-source-data.mjs --project-root "D:\Craftland\StealAPet"

The generator mirrors an allowlist of balance and progression CSVs into dist/data/config-snapshot.json. It excludes operational gift-code and compensation exports. It does not edit game files.

Serve the site locally:

    python -m http.server 8080 --directory dist

Then open http://localhost:8080.

## Data boundaries

The linked Google Sheets could not be read with the available connector during this build. The site labels its snapshot as repository CSV/code data and does not claim it is a fresh pull from those sheets. It has no validated session-time simulator or retention telemetry; pacing is shown as configured progression gates and event cadence.

The site source is its own Git checkout. It does not commit or push the StealAPet game repository.
