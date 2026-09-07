import { LINKS } from "../data/links";
import { generateTelemetry, currentSnapshot, type DriftProfile } from "../data/telemetry";
import type { NetworkLink, TelemetryPoint } from "../data/types";

/** Maps each of the six approved corridors to the shape of its 48h telemetry.
 *  This is the single place a link's "story" (stable vs. drifting vs.
 *  recovering) is declared — every screen derives its numbers from here. */
export const DRIFT_PROFILES: Record<string, DriftProfile> = {
  "mumbai-delhi-core": "bifurcation",
  "mumbai-pune-metro": "loss-degradation",
  "delhi-bengaluru-core": "saturation",
  "bengaluru-chennai-core": "stable",
  "bengaluru-hyderabad-core": "oscillation",
  "chennai-pune-core": "recovering",
};

const telemetryCache = new Map<string, TelemetryPoint[]>();

export function getTelemetry(link: NetworkLink): TelemetryPoint[] {
  const cached = telemetryCache.get(link.id);
  if (cached) return cached;
  const profile = DRIFT_PROFILES[link.id] ?? "stable";
  const points = generateTelemetry(link, profile);
  telemetryCache.set(link.id, points);
  return points;
}

export interface LinkVitals {
  link: NetworkLink;
  now: TelemetryPoint;
  healthScore: number;
  anomalyScore: number;
  status: "healthy" | "attention";
  latencyDeltaMs: number;
  latencyDeltaPct: number;
  jitterDeltaMs: number;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Anomaly-score threshold above which a corridor is flagged for attention —
 *  shared by the link status calculation and every "Threshold: X (Exceeded)"
 *  readout so the page never shows a contradictory verdict. */
export const ANOMALY_ATTENTION_THRESHOLD = 0.22;

export function computeVitals(link: NetworkLink): LinkVitals {
  const points = getTelemetry(link);
  const now = currentSnapshot(points);
  const { latencyMs: bl, lossPct: blLoss, jitterMs: blJitter } = link.baseline;

  const latencyDeltaPct = (now.latencyMs - bl) / bl;
  const jitterDeltaMs = now.jitterMs - blJitter;
  const lossDeltaPct = now.lossPct - blLoss;

  // Each term is normalised to its own "notable excursion" scale and capped
  // at 1 before weighting, so the composite score stays a readable 0..1
  // regardless of how close to zero a metric's baseline happens to sit
  // (packet loss baselines are ~0.02%, so raw ratios would blow up).
  const latencyTerm = clamp(Math.max(0, latencyDeltaPct) / 0.5, 0, 1);
  const lossTerm = clamp(Math.max(0, lossDeltaPct) / 0.5, 0, 1);
  const jitterTerm = clamp(Math.max(0, jitterDeltaMs) / 2, 0, 1);
  const bandwidthTerm = clamp((now.bandwidthPct - 75) / 25, 0, 1);

  const anomalyScore = clamp(0.4 * latencyTerm + 0.3 * lossTerm + 0.15 * jitterTerm + 0.15 * bandwidthTerm, 0, 1);

  const healthScore = clamp(100 - anomalyScore * 38, 55, 100);
  const status: "healthy" | "attention" = anomalyScore >= ANOMALY_ATTENTION_THRESHOLD ? "attention" : "healthy";

  return {
    link,
    now,
    healthScore: Math.round(healthScore * 10) / 10,
    anomalyScore: Math.round(anomalyScore * 100) / 100,
    status,
    latencyDeltaMs: Math.round((now.latencyMs - bl) * 10) / 10,
    latencyDeltaPct: Math.round(latencyDeltaPct * 1000) / 10,
    jitterDeltaMs: Math.round(jitterDeltaMs * 10) / 10,
  };
}

export function allVitals(): LinkVitals[] {
  return LINKS.map(computeVitals);
}

export function networkBaselinePct(): number {
  const vitals = allVitals();
  const avg = vitals.reduce((s, v) => s + v.healthScore, 0) / vitals.length;
  return Math.round(avg * 10) / 10;
}

export function corridorsNeedingReview(): { total: number; flagged: number; vitals: LinkVitals[] } {
  const vitals = allVitals();
  return { total: vitals.length, flagged: vitals.filter((v) => v.status === "attention").length, vitals };
}
