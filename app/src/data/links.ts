import type { NetworkLink } from "./types";
import linksData from "./generated/links.json";

// The six approved transit corridors. Identifiers, circuit codes and route
// metadata are carried over verbatim from the approved Stitch export.
// Authored demonstration content. The records live in engine/seed/links.json and reach the app
// through the Python engine's generated JSON (src/data/generated/) — edit the seed, then
// run `python -m netsense build-data` from engine/.
export const LINKS = linksData as unknown as NetworkLink[];

export function getLink(id: string): NetworkLink | undefined {
  return LINKS.find((l) => l.id === id);
}
