"""Seeded, deterministic synthetic telemetry.

Each network link gets one *designed drift profile* — a named shape describing how
its latency, packet loss, jitter and bandwidth depart from that link's own
baseline over time. Samples are taken every 30 minutes from ``t = -48 h`` to
``t = +12 h`` relative to "now" (121 samples).

Two things worth being precise about:

* **Synthetic.** Nothing here is measured from a network. Values are baseline
  plus seeded noise plus a profile-specific deviation, then lightly smoothed.
* **``t > 0`` is not a forecast.** The ``+12 h`` samples come from the same
  profile function continuing forward. There is no forecasting model; the
  detector never scores them.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, get_args

from .jsmath import js_round
from .rng import mulberry32, seed_from_string

DriftProfile = Literal[
    "bifurcation",
    "loss-degradation",
    "saturation",
    "oscillation",
    "recovering",
    "stable",
]
DRIFT_PROFILES: tuple[str, ...] = get_args(DriftProfile)

HOURS_PAST = 48
HOURS_FUTURE = 12
STEP_HOURS = 0.5
SAMPLE_INTERVAL_MINUTES = 30
SAMPLES_PER_LINK = int((HOURS_PAST + HOURS_FUTURE) / STEP_HOURS) + 1  # 121

_SMOOTHING_WINDOW = 5


@dataclass(frozen=True)
class Baseline:
    """A link's nominal, undisturbed telemetry. Deviation is always measured from this."""

    latency_ms: float
    loss_pct: float
    jitter_ms: float
    bandwidth_pct: float

    @classmethod
    def from_json(cls, data: dict) -> "Baseline":
        return cls(data["latencyMs"], data["lossPct"], data["jitterMs"], data["bandwidthPct"])

    def to_json(self) -> dict:
        return {
            "latencyMs": self.latency_ms,
            "lossPct": self.loss_pct,
            "jitterMs": self.jitter_ms,
            "bandwidthPct": self.bandwidth_pct,
        }


@dataclass(frozen=True)
class TelemetryPoint:
    """One 30-minute sample. ``t`` is hours relative to "now" (negative = past)."""

    t: float
    latency_ms: float
    loss_pct: float
    jitter_ms: float
    bandwidth_pct: float

    @classmethod
    def from_json(cls, data: dict) -> "TelemetryPoint":
        return cls(data["t"], data["latencyMs"], data["lossPct"], data["jitterMs"], data["bandwidthPct"])

    def to_json(self) -> dict:
        return {
            "t": self.t,
            "latencyMs": self.latency_ms,
            "lossPct": self.loss_pct,
            "jitterMs": self.jitter_ms,
            "bandwidthPct": self.bandwidth_pct,
        }


def _smooth_step(x: float) -> float:
    c = min(1.0, max(0.0, x))
    return c * c * (3 - 2 * c)


def _apply_profile(profile: str, t: float, latency: float, loss: float, jitter: float, bandwidth: float):
    """Add the profile's designed deviation to one noisy baseline sample."""
    if profile == "bifurcation":
        # Flat until T-6h, then a rising cascade that continues into the projection.
        inception = -6
        if t > inception:
            progress = _smooth_step((t - inception) / (HOURS_FUTURE - inception))
            latency += progress * 26
            loss += progress * 0.42
            jitter += progress * 1.1
            bandwidth += progress * 20
    elif profile == "loss-degradation":
        start = -20
        if t > start:
            progress = _smooth_step((t - start) / (HOURS_FUTURE - start))
            loss += progress * 0.95
            latency += progress * 1.6
            bandwidth += progress * 5
    elif profile == "saturation":
        progress = _smooth_step((t + HOURS_PAST) / (HOURS_PAST + HOURS_FUTURE))
        bandwidth += progress * 30
        latency += progress * 6.5
        jitter += progress * 2.6
    elif profile == "oscillation":
        cycles_per_hour = (math.pi * 2) / 9
        growth = _smooth_step((t + HOURS_PAST) / (HOURS_PAST + HOURS_FUTURE))
        jitter += math.sin(t * cycles_per_hour) * (0.5 + growth * 1.1) + growth * 0.4
        latency += math.sin(t * cycles_per_hour + 1) * (1.2 + growth * 1.8)
    elif profile == "recovering":
        # A past excursion centred on T-30h that has since cleared.
        x = (t + 30) / 4
        dip = math.exp(-(x * x))
        latency += dip * 9
        loss += dip * 0.3
        jitter += dip * 0.7
    elif profile == "stable":
        pass
    else:
        raise ValueError(f"unknown drift profile: {profile!r}")
    return latency, loss, jitter, bandwidth


def _smooth_series(rows: list[list[float]], window: int = _SMOOTHING_WINDOW) -> list[list[float]]:
    """Centred moving average over the four metric columns (``t`` is carried through)."""
    half = window // 2
    out: list[list[float]] = []
    for i, row in enumerate(rows):
        lo = max(0, i - half)
        hi = min(len(rows) - 1, i + half)
        window_rows = rows[lo : hi + 1]
        smoothed = [row[0]]
        for col in range(1, 5):
            total = 0
            for r in window_rows:  # sequential sum, same order as the TypeScript reduce
                total += r[col]
            smoothed.append(total / len(window_rows))
        out.append(smoothed)
    return out


def generate_telemetry(link_id: str, baseline: Baseline, profile: str) -> list[TelemetryPoint]:
    """Generate the 121-sample series for one link. Pure and deterministic."""
    rand = mulberry32(seed_from_string(link_id))
    rows: list[list[float]] = []

    def noise(amp: float) -> float:
        return (rand() - 0.5) * 2 * amp

    t = float(-HOURS_PAST)
    while t <= HOURS_FUTURE:
        # Noise is drawn in a fixed order (latency, loss, jitter, bandwidth) so the
        # random stream lines up exactly with the TypeScript original.
        latency = baseline.latency_ms + noise(baseline.latency_ms * 0.012)
        loss = max(0, baseline.loss_pct + noise(baseline.loss_pct * 0.12))
        jitter = max(0, baseline.jitter_ms + noise(baseline.jitter_ms * 0.08))
        bandwidth = baseline.bandwidth_pct + noise(1.1)

        latency, loss, jitter, bandwidth = _apply_profile(profile, t, latency, loss, jitter, bandwidth)

        rows.append(
            [
                js_round(t * 100) / 100,
                max(0.1, latency),
                max(0, loss),
                max(0, jitter),
                min(100, max(0, bandwidth)),
            ]
        )
        t += STEP_HOURS

    smoothed = _smooth_series(rows)
    return [
        TelemetryPoint(
            t=row[0],
            latency_ms=js_round(row[1] * 10) / 10,
            loss_pct=js_round(row[2] * 100) / 100,
            jitter_ms=js_round(row[3] * 10) / 10,
            bandwidth_pct=js_round(row[4] * 10) / 10,
        )
        for row in smoothed
    ]


def current_snapshot(points: list[TelemetryPoint]) -> TelemetryPoint:
    """The "now" sample the detector scores: the point at ``t == 0``."""
    for p in points:
        if p.t == 0:
            return p
    return points[-1]
