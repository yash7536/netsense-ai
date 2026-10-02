import type { Engineer } from "./types";
import engineersData from "./generated/engineers.json";

// Ten engineers across the six approved cities — six on shift, three standby,
// one off shift — mirroring the roster structure from the approved Stitch
// export (data/engineer duty math is computed dynamically in lib/aggregate.ts).
// Authored demonstration content. The records live in engine/seed/engineers.json and reach the app
// through the Python engine's generated JSON (src/data/generated/) — edit the seed, then
// run `python -m netsense build-data` from engine/.
export const ENGINEERS = engineersData as unknown as Engineer[];

export function getEngineer(id: string): Engineer | undefined {
  return ENGINEERS.find((e) => e.id === id);
}
