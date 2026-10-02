"""The rule-based scoring engine.

This is a hand-written rule, not a trained model — there is nothing learned and
nothing to "train". For one telemetry snapshot and one link baseline it computes:

1. Four **deviation terms**, each measured against *that link's own baseline* and
   normalised to a "notable excursion" scale, then capped at 1:
   latency (relative rise), packet loss (absolute rise), jitter (absolute rise),
   bandwidth utilisation (how far above 75 %). Only deviation in the bad
   direction counts.
2. A **weighted composite anomaly score** in ``[0, 1]``:
   ``0.40·latency + 0.30·loss + 0.15·jitter + 0.15·bandwidth``.
3. A single **attention threshold** (``0.22``): at or above it a link is
   ``attention``, below it ``healthy``.
4. A **health score** for display: ``100 - 38·anomaly``, floored at 55.

The detector scores exactly one instant — the latest sample. It has no memory of
earlier samples, which is the temporal limitation documented in ``docs/EVALUATION.md``.

Constants below are the single source of truth for the Python side; the TypeScript
scorer in ``app/src/lib/derive.ts`` is held to the same numbers by the parity tests.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .jsmath import clamp, js_round
from .telemetry import Baseline, TelemetryPoint, current_snapshot

LinkState = Literal["healthy", "attention"]

WEIGHT_LATENCY = 0.40
WEIGHT_LOSS = 0.30
WEIGHT_JITTER = 0.15
WEIGHT_BANDWIDTH = 0.15

# "Notable excursion" scales: the deviation at which a term saturates at 1.
LATENCY_EXCURSION_FRACTION = 0.5  # +50 % over baseline latency
LOSS_EXCURSION_PCT_POINTS = 0.5  # +0.5 percentage points of packet loss
JITTER_EXCURSION_MS = 2.0  # +2 ms of jitter
BANDWIDTH_FLOOR_PCT = 75.0  # utilisation below this contributes nothing
BANDWIDTH_SPAN_PCT = 25.0  # 75 % -> 100 % maps onto 0 -> 1

ANOMALY_ATTENTION_THRESHOLD = 0.22

HEALTH_SLOPE = 38.0
HEALTH_FLOOR = 55.0


@dataclass(frozen=True)
class Vitals:
    """Scoring output for one link at one instant."""

    anomaly_score: float  # rounded to 2 dp, as displayed
    health_score: float  # rounded to 1 dp
    status: LinkState  # decided from the *unrounded* score
    latency_delta_ms: float
    latency_delta_pct: float
    jitter_delta_ms: float
    terms: dict[str, float]  # normalised 0..1 deviation terms (evidence for the score)
    raw_anomaly_score: float  # unrounded, for transparency

    def to_json(self) -> dict:
        return {
            "anomalyScore": self.anomaly_score,
            "healthScore": self.health_score,
            "status": self.status,
            "latencyDeltaMs": self.latency_delta_ms,
            "latencyDeltaPct": self.latency_delta_pct,
            "jitterDeltaMs": self.jitter_delta_ms,
            "terms": self.terms,
        }


def score_snapshot(now: TelemetryPoint, baseline: Baseline) -> Vitals:
    """Score a single telemetry snapshot against a link baseline."""
    bl = baseline.latency_ms
    latency_delta_pct = (now.latency_ms - bl) / bl
    jitter_delta_ms = now.jitter_ms - baseline.jitter_ms
    loss_delta_pct = now.loss_pct - baseline.loss_pct

    latency_term = clamp(max(0, latency_delta_pct) / LATENCY_EXCURSION_FRACTION, 0, 1)
    loss_term = clamp(max(0, loss_delta_pct) / LOSS_EXCURSION_PCT_POINTS, 0, 1)
    jitter_term = clamp(max(0, jitter_delta_ms) / JITTER_EXCURSION_MS, 0, 1)
    bandwidth_term = clamp((now.bandwidth_pct - BANDWIDTH_FLOOR_PCT) / BANDWIDTH_SPAN_PCT, 0, 1)

    anomaly = clamp(
        WEIGHT_LATENCY * latency_term
        + WEIGHT_LOSS * loss_term
        + WEIGHT_JITTER * jitter_term
        + WEIGHT_BANDWIDTH * bandwidth_term,
        0,
        1,
    )
    health = clamp(100 - anomaly * HEALTH_SLOPE, HEALTH_FLOOR, 100)
    status: LinkState = "attention" if anomaly >= ANOMALY_ATTENTION_THRESHOLD else "healthy"

    return Vitals(
        anomaly_score=js_round(anomaly * 100) / 100,
        health_score=js_round(health * 10) / 10,
        status=status,
        latency_delta_ms=js_round((now.latency_ms - bl) * 10) / 10,
        latency_delta_pct=js_round(latency_delta_pct * 1000) / 10,
        jitter_delta_ms=js_round(jitter_delta_ms * 10) / 10,
        terms={
            "latency": float(latency_term),
            "loss": float(loss_term),
            "jitter": float(jitter_term),
            "bandwidth": float(bandwidth_term),
        },
        raw_anomaly_score=float(anomaly),
    )


def compute_vitals(baseline: Baseline, points: list[TelemetryPoint]) -> Vitals:
    """Score a link from its telemetry series — i.e. the sample at ``t == 0``."""
    return score_snapshot(current_snapshot(points), baseline)


def contributions(vitals: Vitals) -> dict[str, float]:
    """Weighted contribution of each term to the composite score (the 'why' behind a score)."""
    return {
        "latency": WEIGHT_LATENCY * vitals.terms["latency"],
        "loss": WEIGHT_LOSS * vitals.terms["loss"],
        "jitter": WEIGHT_JITTER * vitals.terms["jitter"],
        "bandwidth": WEIGHT_BANDWIDTH * vitals.terms["bandwidth"],
    }
