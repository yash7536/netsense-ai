import type { Prediction } from "./types";
import predictionsData from "./generated/predictions.json";

// Seven predictive signals across the six approved corridors. Confidence,
// severity and narrative copy follow the approved Stitch export; cross
// references (relatedIncidentId) tie into data/incidents.ts.
// Authored demonstration content. The records live in engine/seed/predictions.json and reach the app
// through the Python engine's generated JSON (src/data/generated/) — edit the seed, then
// run `python -m netsense build-data` from engine/.
export const PREDICTIONS = predictionsData as unknown as Prediction[];

export function getPrediction(id: string): Prediction | undefined {
  return PREDICTIONS.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

export const SEVERITY_RANK: Record<Prediction["severity"], number> = { critical: 3, high: 2, medium: 1, low: 0 };
