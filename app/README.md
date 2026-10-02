# NetSense AI

A functional, data-driven React implementation of the approved NetSense AI
Stitch design (`../stitch_netsense_ai_design_system`). The visual design is
frozen — this app makes it real: routed, reusable, and backed by a small
computed telemetry model instead of static mockup text.

## Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 (via `@tailwindcss/vite`) +
React Router 7. IBM Plex Sans / IBM Plex Mono and Material Symbols are loaded
from Google Fonts in `index.html`, matching the Stitch export.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc -b --noEmit
npm run lint       # oxlint
npm run build       # tsc -b && vite build
```

## Structure

- `src/data/` — the dataset: 6 approved India corridors (`links.ts`), 7
  predictions, 6 incidents, 10 engineers. These are thin typed modules over
  `src/data/generated/*.json`, which the Python engine in `../engine` produces
  (authored seed records + seeded 30-minute telemetry, `t = -48h … +12h`).
  Edit `engine/seed/`, then run `python -m netsense build-data` from `engine/`;
  do not edit the generated files by hand. The app needs no Python at build time.
- `src/lib/derive.ts` — turns telemetry into health score / anomaly score
  / status for a link (the Python engine is the reference implementation; parity tests hold the two equal) (`ANOMALY_ATTENTION_THRESHOLD` is the single shared
  threshold used everywhere that number is displayed).
- `src/lib/aggregate.ts` — cross-references links ↔ predictions ↔ incidents ↔
  engineers so every screen agrees (e.g. a link with an open critical
  incident always shows "attention" in the Network Links table too).
- `src/components/charts/` — the reusable SVG chart primitives
  (`TelemetryTrendChart`, `Sparkline`, `HealthRing`, `RiskHorizonMini`,
  `RouteTopology`). All are driven by real data arrays and scale via
  `viewBox`, not fixed pixel widths.
- `src/components/layout/AppShell.tsx` — the sidebar + header chrome shared
  by every route.
- `src/pages/` — the 8 approved screens (`Overview`, `NetworkLinks` +
  `LinkDetail`, `Predictions` + `PredictionDetail`, `Incidents` +
  `IncidentDetail`, `Engineers`) plus `EngineerDetail`, which the Stitch
  export doesn't design explicitly — it's assembled only from primitives
  already used elsewhere (hairline stat rows, editorial captions) rather
  than inventing new UI, to satisfy the reusable-routes requirement in
  `/engineers/:engineerId`.

## Data model notes

- Only the six approved cities/links appear anywhere in the app.
- Fault detection is rule-based (telemetry vs. baseline deltas), not a real
  ML claim — see `computeVitals` in `src/lib/derive.ts`.
- Specific incident timelines/UTC timestamps are authored narrative content
  (frozen from the approved export where applicable); aggregate counts,
  filters, and chart series are computed from the shared dataset.
