import type { Incident } from "./types";
import incidentsData from "./generated/incidents.json";

// Six incidents across the six approved corridors. INC-402's narrative and
// timeline follow the approved Stitch export verbatim; the remaining five
// are authored in the same structural shape so the Incident Detail
// implementation is genuinely reusable.
// Authored demonstration content. The records live in engine/seed/incidents.json and reach the app
// through the Python engine's generated JSON (src/data/generated/) — edit the seed, then
// run `python -m netsense build-data` from engine/.
export const INCIDENTS = incidentsData as unknown as Incident[];

export function getIncident(id: string): Incident | undefined {
  return INCIDENTS.find((i) => i.id.toLowerCase() === id.toLowerCase());
}

export const INCIDENT_SEVERITY_RANK: Record<Incident["severity"], number> = { critical: 2, high: 1, medium: 0 };
