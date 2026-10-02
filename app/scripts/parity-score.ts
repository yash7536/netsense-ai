// Parity helper for engine/tests/test_parity_ts.py.
// Input (JSON file path in argv[2]): { scoreCases, roundCases, rngSeeds }
// Output (JSON on stdout): the TypeScript results for the same inputs.
import fs from "node:fs";
import { scoreSnapshot } from "../src/lib/derive";
import { mulberry32, seedFromString } from "./reference/legacy-telemetry";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const scores = input.scoreCases.map((c: { now: never; baseline: never }) => scoreSnapshot(c.now, c.baseline));
const rounds = input.roundCases.map((x: number) => Math.round(x));
const rng = input.rngSeeds.map((s: string) => {
  const seed = seedFromString(s);
  const next = mulberry32(seed);
  return { seed, values: Array.from({ length: 8 }, () => next()) };
});

console.log(JSON.stringify({ scores, rounds, rng }));
