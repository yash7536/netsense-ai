"""Evaluation harness.

Implements ``docs/PROFILE_SPEC.md`` exactly. Three separate measurements, never
merged into one figure:

1. **Rule-based detection agreement** on the designed telemetry profiles
   (resolvable profiles only). This is *not* model accuracy — there is no model.
2. **Authored-versus-computed consistency audit** over every prediction and
   incident, using an evaluation-only heuristic (not a product rule).
3. A descriptive **window-exposure diagnostic** for the one unresolvable profile.
   It is not a scoring method and the engine and app never use it.
"""

from __future__ import annotations

import json
from pathlib import Path

from .pipeline import EngineRun
from .profiles import PROFILE_SPECS
from .scoring import ANOMALY_ATTENTION_THRESHOLD, score_snapshot
from .telemetry import Baseline

# Evaluation-only heuristic. Not a product rule: no function in the product maps a
# score to a severity.
STRONG_SIGNAL_THRESHOLD = 0.35

DIAGNOSTIC_WINDOW_HOURS = 24

NO_SIGNAL = "no live signal"
MODERATE_SIGNAL = "moderate live signal"
STRONG_SIGNAL = "strong live signal"


def signal_band(anomaly_score: float) -> str:
    if anomaly_score < ANOMALY_ATTENTION_THRESHOLD:
        return NO_SIGNAL
    if anomaly_score < STRONG_SIGNAL_THRESHOLD:
        return MODERATE_SIGNAL
    return STRONG_SIGNAL


# --------------------------------------------------------------------------- #
# 1. Drift-profile agreement
# --------------------------------------------------------------------------- #


def window_exposure(run: EngineRun, link_id: str) -> dict:
    """How many trailing-window samples a single-sample application of the rule would flag.

    Descriptive only. Each sample is scored independently with the *same*
    point-in-time rule; nothing is aggregated, smoothed or learned.
    """
    link = run.seed.link(link_id)
    baseline = Baseline.from_json(link["baseline"])
    window = [p for p in run.telemetry[link_id] if -DIAGNOSTIC_WINDOW_HOURS < p.t <= 0]
    scored = [(p, score_snapshot(p, baseline)) for p in window]
    flagged = [p.t for p, v in scored if v.status == "attention"]
    return {
        "window": f"trailing {DIAGNOSTIC_WINDOW_HOURS}h, samples with -{DIAGNOSTIC_WINDOW_HOURS} < t <= 0",
        "samples": len(window),
        "flaggedSamples": len(flagged),
        "fractionFlagged": round(len(flagged) / len(window), 3),
        "maxSingleSampleScore": max(v.anomaly_score for _, v in scored),
        "maxSingleSampleScoreUnrounded": round(max(v.raw_anomaly_score for _, v in scored), 4),
        "thresholdMarginAtMax": round(ANOMALY_ATTENTION_THRESHOLD - max(v.raw_anomaly_score for _, v in scored), 4),
        "scoreAtNow": next(v.anomaly_score for p, v in scored if p.t == 0),
        "note": (
            "Descriptive measurement of exposure, not a scoring method. It is not a rolling-window "
            "algorithm, is not used by the engine or the app, and has no pass/fail criterion."
        ),
    }


def evaluate_drift_profiles(run: EngineRun) -> dict:
    cases = {c.link_id: c for c in run.cases}
    rows: list[dict] = []
    for spec in PROFILE_SPECS:
        case = cases[spec.link_id]
        link = run.seed.link(spec.link_id)
        now = next(p for p in run.telemetry[spec.link_id] if p.t == 0)
        state = case.vitals.status
        if not spec.resolvable:
            agreement = "not-scored"
        else:
            agreement = "match" if state == spec.expected_state else "mismatch"
        row = {
            "profile": spec.profile,
            "linkId": spec.link_id,
            "linkName": link["name"],
            "designedBehaviour": spec.designed_behaviour,
            "resolvable": spec.resolvable,
            "expectedState": spec.expected_state,
            "reason": spec.reason,
            "anomalyScore": case.vitals.anomaly_score,
            "healthScore": case.vitals.health_score,
            "state": state,
            "agreement": agreement,
            "terms": case.vitals.terms,
            "now": now.to_json(),
            "baseline": link["baseline"],
        }
        if not spec.resolvable:
            row["diagnostic"] = window_exposure(run, spec.link_id)
        rows.append(row)

    resolvable = [r for r in rows if r["resolvable"]]
    matches = sum(1 for r in resolvable if r["agreement"] == "match")
    return {
        "measurement": "rule-based detection agreement against designed test scenarios (not model accuracy)",
        "spec": "docs/PROFILE_SPEC.md",
        "threshold": ANOMALY_ATTENTION_THRESHOLD,
        "summary": {
            "profiles": len(rows),
            "resolvable": len(resolvable),
            "unresolvable": len(rows) - len(resolvable),
            "matches": matches,
            "mismatches": len(resolvable) - matches,
            "agreement": f"{matches}/{len(resolvable)}",
        },
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# 2. Authored-versus-computed consistency audit
# --------------------------------------------------------------------------- #


def _prediction_verdict(pred: dict, band: str, score: float) -> tuple[str, str]:
    severe = pred["severity"] in ("high", "critical")
    if severe and band == NO_SIGNAL:
        return "review", (
            f"Authored severity is '{pred['severity']}' but the live detector reads this corridor as healthy "
            f"(anomaly score {score} < {ANOMALY_ATTENTION_THRESHOLD})."
        )
    if not severe and band == STRONG_SIGNAL:
        return "review", (
            f"Authored severity is '{pred['severity']}' (below high) but the live detector reads a strong signal "
            f"(anomaly score {score}); the prediction may understate what the corridor's telemetry shows."
        )
    if pred["status"] == "monitored" and band != NO_SIGNAL:
        return "review", (
            f"Prediction is 'monitored' (lowest urgency) while the live detector reads a non-trivial signal "
            f"(anomaly score {score}, '{band}')."
        )
    return "consistent", f"Authored severity '{pred['severity']}' and live signal '{band}' are directionally aligned."


def _incident_verdict(inc: dict, band: str, score: float) -> tuple[str, str]:
    if inc["status"] == "resolved":
        return "not-comparable", (
            "Resolved (historical) incident: a healthy live reading describes 'now', not the incident's "
            "inception, so it is not a meaningful comparison."
        )
    severe = inc["severity"] in ("high", "critical")
    if severe and band == NO_SIGNAL:
        return "review", (
            f"Incident is open ('{inc['status']}') with authored severity '{inc['severity']}', but the live "
            f"detector reads this corridor as healthy (anomaly score {score})."
        )
    return "consistent", f"Open incident, authored severity '{inc['severity']}', live signal '{band}' — directionally aligned."


def audit_consistency(run: EngineRun) -> dict:
    cases = {c.link_id: c for c in run.cases}
    rows: list[dict] = []

    for pred in run.seed.predictions:
        case = cases[pred["linkId"]]
        score = case.vitals.anomaly_score
        band = signal_band(score)
        verdict, why = _prediction_verdict(pred, band, score)
        rows.append(
            {
                "record": pred["id"],
                "type": "prediction",
                "linkId": pred["linkId"],
                "linkName": case.link_name,
                "authoredSeverity": pred["severity"],
                "authoredConfidencePct": pred["confidencePct"],
                "authoredFaultLabel": pred["faultLabel"],
                "authoredStatus": pred["status"],
                "liveAnomalyScore": score,
                "liveState": case.vitals.status,
                "liveSignal": band,
                "result": verdict,
                "interpretation": why,
            }
        )

    for inc in run.seed.incidents:
        case = cases[inc["linkId"]]
        score = case.vitals.anomaly_score
        band = signal_band(score)
        verdict, why = _incident_verdict(inc, band, score)
        rows.append(
            {
                "record": inc["id"],
                "type": "incident",
                "linkId": inc["linkId"],
                "linkName": case.link_name,
                "authoredSeverity": inc["severity"],
                "authoredFaultLabel": inc["faultLabel"],
                "authoredStatus": inc["status"],
                "liveAnomalyScore": score,
                "liveState": case.vitals.status,
                "liveSignal": band,
                "result": verdict,
                "interpretation": why,
            }
        )

    def count(label: str) -> int:
        return sum(1 for r in rows if r["result"] == label)

    return {
        "measurement": "authored-versus-computed consistency audit (separate from detection agreement; never combined with it)",
        "spec": "docs/PROFILE_SPEC.md",
        "heuristic": {
            "note": "Evaluation-only heuristic bands on the live anomaly score. NOT a product rule: no function in the product maps scores to severities.",
            "noLiveSignalBelow": ANOMALY_ATTENTION_THRESHOLD,
            "strongSignalAtOrAbove": STRONG_SIGNAL_THRESHOLD,
        },
        "summary": {
            "records": len(rows),
            "predictions": len(run.seed.predictions),
            "incidents": len(run.seed.incidents),
            "consistent": count("consistent"),
            "review": count("review"),
            "notComparable": count("not-comparable"),
        },
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #


def _dump(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def build_results(run: EngineRun) -> dict[str, dict]:
    """All committed result artefacts, keyed by file name."""
    return {
        "drift_profile_eval.json": evaluate_drift_profiles(run),
        "consistency_audit.json": audit_consistency(run),
        "workflow_cases.json": {
            "note": (
                "Per-link output of the rule-based anomaly-to-incident workflow. 'origin' marks what is "
                "computed versus authored demonstration content."
            ),
            "overview": run.overview,
            "seedNotes": run.seed_notes,
            "cases": [c.to_json() for c in run.cases],
        },
    }


def write_results(run: EngineRun, out_dir: Path) -> dict[str, dict]:
    results = build_results(run)
    for name, payload in results.items():
        _dump(out_dir / name, payload)
    return results
