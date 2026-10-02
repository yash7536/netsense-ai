"""Cross-language parity: the original TypeScript implementation vs the Python engine.

These run the real TypeScript (``app/src/lib/derive.ts``, ``aggregate.ts`` and the original
telemetry generator) through ``tsx`` and compare *exactly* — no tolerances. They are skipped,
with a clear reason, when Node or ``npm install`` in ``app/`` is not available.
"""

import json
import random
import shutil
import subprocess

import pytest

from netsense.jsmath import js_round
from netsense.rng import mulberry32, seed_from_string
from netsense.scoring import score_snapshot
from netsense.telemetry import Baseline, TelemetryPoint

pytestmark = pytest.mark.parity


@pytest.fixture(scope="module")
def tsx(repo_root):
    app = repo_root / "app"
    node = shutil.which("node")
    npx = shutil.which("npx")
    if not (node and npx):
        pytest.skip("Node.js/npx not found; cannot run the TypeScript side of the parity check")
    if not (app / "node_modules" / ".bin").exists():
        pytest.skip("run `npm install` in app/ to enable the TypeScript parity checks")

    def run_script(script: str, *args: str) -> dict:
        proc = subprocess.run(
            [npx, "tsx", f"scripts/{script}", *args],
            cwd=app,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=180,
        )
        assert proc.returncode == 0, proc.stderr
        return json.loads(proc.stdout)

    return run_script


@pytest.fixture(scope="module")
def ts_export(tsx):
    return tsx("parity-export.ts")


def test_original_typescript_generator_equals_python_telemetry_sample_for_sample(run, ts_export):
    compared = 0
    for link_id, ts_points in ts_export["legacyTelemetry"].items():
        py_points = [p.to_json() for p in run.telemetry[link_id]]
        assert py_points == ts_points, f"telemetry differs for {link_id}"
        compared += len(py_points)
    assert compared == 6 * 121


def test_app_scoring_on_the_engines_telemetry_equals_python_vitals(run, ts_export):
    for link_id, ts in ts_export["appVitals"].items():
        v = run.vitals[link_id]
        assert ts == {
            "anomalyScore": v.anomaly_score,
            "healthScore": v.health_score,
            "status": v.status,
            "latencyDeltaMs": v.latency_delta_ms,
            "latencyDeltaPct": v.latency_delta_pct,
            "jitterDeltaMs": v.jitter_delta_ms,
        }, link_id


def test_app_display_status_and_overview_equal_python_workflow(run, ts_export):
    assert ts_export["displayStatus"] == {c.link_id: c.display_status for c in run.cases}
    assert ts_export["overview"] == run.overview


def _score_cases(n: int = 600) -> list[dict]:
    rng = random.Random(20261002)
    cases = []
    for _ in range(n):
        base = Baseline(
            latency_ms=round(rng.uniform(1, 120), 1),
            loss_pct=round(rng.uniform(0.0, 0.1), 2),
            jitter_ms=round(rng.uniform(0.1, 6), 1),
            bandwidth_pct=round(rng.uniform(20, 85), 1),
        )
        now = TelemetryPoint(
            t=0,
            latency_ms=round(max(0.1, base.latency_ms * rng.uniform(0.7, 3.0)), 1),
            loss_pct=round(max(0.0, base.loss_pct + rng.uniform(-0.02, 1.5)), 2),
            jitter_ms=round(max(0.0, base.jitter_ms + rng.uniform(-0.5, 8)), 1),
            bandwidth_pct=round(min(100.0, max(0.0, rng.uniform(10, 105))), 1),
        )
        cases.append({"baseline": base.to_json(), "now": now.to_json()})
    # Boundary cases around the attention threshold: latency-only excursions in 0.1 ms steps.
    base = Baseline(20.0, 0.02, 1.0, 60.0)
    for i in range(0, 300):
        now = TelemetryPoint(0, round(20.0 + 4.5 + i * 0.01, 2), 0.02, 1.0, 60.0)
        cases.append({"baseline": base.to_json(), "now": now.to_json()})
    return cases


def test_typescript_scorer_equals_python_scorer_on_arbitrary_inputs(tsx, tmp_path):
    cases = _score_cases()
    round_cases = [x / 8 for x in range(-80, 81)] + [0.5, -0.5, 1.4999999999999998, 2.5, -2.5, 1e-9, 123456.5]
    rng_seeds = ["mumbai-delhi-core", "a", "–", "bengaluru-hyderabad-core", "Mumbai–Delhi Core", ""]
    payload = tmp_path / "cases.json"
    payload.write_text(json.dumps({"scoreCases": cases, "roundCases": round_cases, "rngSeeds": rng_seeds}), encoding="utf-8")

    ts = tsx("parity-score.ts", str(payload))

    # 1. scoring: every field, exact equality, on 900 inputs
    assert len(ts["scores"]) == len(cases) == 900
    for case, ts_score in zip(cases, ts["scores"]):
        v = score_snapshot(TelemetryPoint.from_json(case["now"]), Baseline.from_json(case["baseline"]))
        assert ts_score == {
            "anomalyScore": v.anomaly_score,
            "healthScore": v.health_score,
            "status": v.status,
            "latencyDeltaMs": v.latency_delta_ms,
            "latencyDeltaPct": v.latency_delta_pct,
            "jitterDeltaMs": v.jitter_delta_ms,
        }, case

    # 2. both states are exercised, so the comparison is not vacuous
    states = {s["status"] for s in ts["scores"]}
    assert states == {"healthy", "attention"}

    # 3. Math.round semantics
    assert [js_round(x) for x in round_cases] == ts["rounds"]

    # 4. RNG: FNV-1a seed and the first 8 mulberry32 values
    for text, entry in zip(rng_seeds, ts["rng"]):
        assert seed_from_string(text) == entry["seed"]
        rand = mulberry32(entry["seed"])
        assert [rand() for _ in range(8)] == entry["values"]
