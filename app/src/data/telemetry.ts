import type { NetworkLink, TelemetryPoint } from "./types";

/** Deterministic PRNG (mulberry32) so telemetry is stable across renders/reloads. */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** How a corridor's telemetry departs from baseline over the 48h trailing
 *  window and the +12h forecast horizon. Kept small and named so each link's
 *  narrative (see links.ts / predictions.ts) has one matching shape. */
export type DriftProfile = "bifurcation" | "loss-degradation" | "saturation" | "oscillation" | "stable" | "recovering";

const HOURS_PAST = 48;
const HOURS_FUTURE = 12;
const STEP = 0.5; // 30 minute samples

function smoothStep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

export function generateTelemetry(link: NetworkLink, profile: DriftProfile): TelemetryPoint[] {
  const rand = mulberry32(seedFromString(link.id));
  const points: TelemetryPoint[] = [];
  const { latencyMs: baseLatency, lossPct: baseLoss, jitterMs: baseJitter, bandwidthPct: baseBw } = link.baseline;

  for (let t = -HOURS_PAST; t <= HOURS_FUTURE; t += STEP) {
    const noise = (amp: number) => (rand() - 0.5) * 2 * amp;
    let latency = baseLatency + noise(baseLatency * 0.012);
    let loss = Math.max(0, baseLoss + noise(baseLoss * 0.12));
    let jitter = Math.max(0, baseJitter + noise(baseJitter * 0.08));
    let bandwidth = baseBw + noise(1.1);

    switch (profile) {
      case "bifurcation": {
        // Flat baseline until T-6h, then a rising cascade continuing into the forecast.
        const inception = -6;
        if (t > inception) {
          const progress = smoothStep((t - inception) / (HOURS_FUTURE - inception));
          latency += progress * 26;
          loss += progress * 0.42;
          jitter += progress * 1.1;
          bandwidth += progress * 20;
        }
        break;
      }
      case "loss-degradation": {
        const start = -20;
        if (t > start) {
          const progress = smoothStep((t - start) / (HOURS_FUTURE - start));
          loss += progress * 0.95;
          latency += progress * 1.6;
          bandwidth += progress * 5;
        }
        break;
      }
      case "saturation": {
        const progress = smoothStep((t + HOURS_PAST) / (HOURS_PAST + HOURS_FUTURE));
        bandwidth += progress * 30;
        latency += progress * 6.5;
        jitter += progress * 2.6;
        break;
      }
      case "oscillation": {
        const cyclesPerHour = (Math.PI * 2) / 9;
        const growth = smoothStep((t + HOURS_PAST) / (HOURS_PAST + HOURS_FUTURE));
        jitter += Math.sin(t * cyclesPerHour) * (0.5 + growth * 1.1) + growth * 0.4;
        latency += Math.sin(t * cyclesPerHour + 1) * (1.2 + growth * 1.8);
        break;
      }
      case "recovering": {
        // A past excursion around T-30h that has since been mitigated.
        const dip = Math.exp(-Math.pow((t + 30) / 4, 2));
        latency += dip * 9;
        loss += dip * 0.3;
        jitter += dip * 0.7;
        break;
      }
      case "stable":
      default:
        break;
    }

    points.push({
      t: Math.round(t * 100) / 100,
      latencyMs: Math.max(0.1, latency),
      lossPct: Math.max(0, loss),
      jitterMs: Math.max(0, jitter),
      bandwidthPct: Math.min(100, Math.max(0, bandwidth)),
    });
  }

  const smoothed = smoothSeries(points);
  return smoothed.map((p) => ({
    t: p.t,
    latencyMs: Math.round(p.latencyMs * 10) / 10,
    lossPct: Math.round(p.lossPct * 100) / 100,
    jitterMs: Math.round(p.jitterMs * 10) / 10,
    bandwidthPct: Math.round(p.bandwidthPct * 10) / 10,
  }));
}

/** Light centred moving-average so the plotted curve reads as an editorial
 *  line rather than raw per-sample noise — the underlying drift shape is
 *  unchanged, only the sampling jitter is softened. */
function smoothSeries(points: TelemetryPoint[], window = 5): TelemetryPoint[] {
  const half = Math.floor(window / 2);
  return points.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(points.length - 1, i + half);
    const slice = points.slice(lo, hi + 1);
    const avg = (key: keyof Omit<TelemetryPoint, "t">) => slice.reduce((s, p) => s + p[key], 0) / slice.length;
    return {
      t: points[i].t,
      latencyMs: avg("latencyMs"),
      lossPct: avg("lossPct"),
      jitterMs: avg("jitterMs"),
      bandwidthPct: avg("bandwidthPct"),
    };
  });
}

export function currentSnapshot(points: TelemetryPoint[]): TelemetryPoint {
  // "now" is t === 0
  return points.find((p) => p.t === 0) ?? points[points.length - 1];
}

export function historyOnly(points: TelemetryPoint[]): TelemetryPoint[] {
  return points.filter((p) => p.t <= 0);
}

export function projectionOnly(points: TelemetryPoint[]): TelemetryPoint[] {
  return points.filter((p) => p.t >= 0);
}
