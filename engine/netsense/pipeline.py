"""One end-to-end pass of the engine: seed -> telemetry -> scores -> workflow."""

from __future__ import annotations

from dataclasses import dataclass

from .profiles import LINK_PROFILES
from .scoring import Vitals, compute_vitals
from .seed import Seed, load_seed, validate_seed
from .telemetry import Baseline, TelemetryPoint, generate_telemetry
from .workflow import LinkCase, build_link_cases, overview


@dataclass
class EngineRun:
    seed: Seed
    telemetry: dict[str, list[TelemetryPoint]]
    vitals: dict[str, Vitals]
    cases: list[LinkCase]
    overview: dict
    seed_notes: list[str]


def run_engine(seed: Seed | None = None) -> EngineRun:
    seed = seed or load_seed()
    errors, notes = validate_seed(seed)
    if errors:
        raise ValueError("seed data failed validation:\n  " + "\n  ".join(errors))

    telemetry: dict[str, list[TelemetryPoint]] = {}
    vitals: dict[str, Vitals] = {}
    for link in seed.links:
        baseline = Baseline.from_json(link["baseline"])
        points = generate_telemetry(link["id"], baseline, LINK_PROFILES[link["id"]])
        telemetry[link["id"]] = points
        vitals[link["id"]] = compute_vitals(baseline, points)

    cases = build_link_cases(seed, vitals, LINK_PROFILES)
    return EngineRun(
        seed=seed,
        telemetry=telemetry,
        vitals=vitals,
        cases=cases,
        overview=overview(seed, cases),
        seed_notes=notes,
    )
