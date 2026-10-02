// Parity helper for engine/tests/test_parity_ts.py.
// Prints, as JSON, what the TypeScript side computes so the Python tests can compare:
//   - legacyTelemetry: the ORIGINAL TypeScript generator's output for every link
//   - appVitals / displayStatus / overview: what the app's own scoring + aggregation give
//     on the telemetry the Python engine generated
import { LINKS } from "../src/data/links";
import { DRIFT_PROFILES, computeVitals } from "../src/lib/derive";
import { allLinkDisplays, overviewStats } from "../src/lib/aggregate";
import { generateTelemetry } from "./reference/legacy-telemetry";

const legacyTelemetry = Object.fromEntries(LINKS.map((l) => [l.id, generateTelemetry(l, DRIFT_PROFILES[l.id])]));

const appVitals = Object.fromEntries(
  LINKS.map((l) => {
    const v = computeVitals(l);
    return [
      l.id,
      {
        anomalyScore: v.anomalyScore,
        healthScore: v.healthScore,
        status: v.status,
        latencyDeltaMs: v.latencyDeltaMs,
        latencyDeltaPct: v.latencyDeltaPct,
        jitterDeltaMs: v.jitterDeltaMs,
      },
    ];
  }),
);

const displayStatus = Object.fromEntries(allLinkDisplays().map((d) => [d.link.id, d.displayStatus]));
const o = overviewStats();

console.log(
  JSON.stringify({
    legacyTelemetry,
    appVitals,
    displayStatus,
    overview: {
      networkBaselinePct: o.networkBaselinePct,
      activeSignals: o.activeSignals,
      openIncidents: o.openIncidents,
      corridorsFlagged: o.corridorsFlagged,
      corridorsTotal: o.corridorsTotal,
    },
  }),
);
