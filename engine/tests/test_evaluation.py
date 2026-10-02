"""The evaluation: real numbers from the real engine run, asserted so they cannot silently change."""

import pytest

from netsense.evaluation import (
    NO_SIGNAL,
    STRONG_SIGNAL,
    audit_consistency,
    build_results,
    evaluate_drift_profiles,
    signal_band,
)


@pytest.fixture(scope="module")
def drift(run):
    return evaluate_drift_profiles(run)


@pytest.fixture(scope="module")
def audit(run):
    return audit_consistency(run)


# ---- 1. Rule-based detection agreement on designed profiles ----------------------------------


def test_agreement_is_five_of_five_resolvable_profiles(drift):
    s = drift["summary"]
    assert (s["profiles"], s["resolvable"], s["unresolvable"]) == (6, 5, 1)
    assert (s["matches"], s["mismatches"]) == (5, 0)
    assert s["agreement"] == "5/5"


def test_each_resolvable_profile_matches_its_pre_registered_expectation(drift):
    for row in drift["rows"]:
        if row["resolvable"]:
            assert row["state"] == row["expectedState"], row["profile"]
            assert row["agreement"] == "match"


def test_the_designed_drift_profiles_score_as_recorded(drift):
    by = {r["profile"]: r for r in drift["rows"]}
    assert (by["bifurcation"]["anomalyScore"], by["bifurcation"]["healthScore"]) == (0.25, 90.6)
    assert (by["loss-degradation"]["anomalyScore"], by["loss-degradation"]["healthScore"]) == (0.51, 80.6)
    assert (by["saturation"]["anomalyScore"], by["saturation"]["healthScore"]) == (0.44, 83.2)
    assert by["stable"]["anomalyScore"] == 0 and by["recovering"]["anomalyScore"] == 0


def test_oscillation_shows_the_healthy_score_blind_spot(drift):
    osc = next(r for r in drift["rows"] if r["profile"] == "oscillation")
    assert osc["resolvable"] is False and osc["agreement"] == "not-scored"
    assert osc["anomalyScore"] == 0.16
    assert osc["state"] == "healthy"
    assert osc["anomalyScore"] < drift["threshold"] == 0.22


def test_unresolvable_profile_is_reported_but_never_counted(drift):
    assert drift["summary"]["matches"] + drift["summary"]["mismatches"] == drift["summary"]["resolvable"]
    assert sum(1 for r in drift["rows"] if r["agreement"] == "not-scored") == 1


def test_oscillation_window_diagnostic_is_descriptive_and_reported_as_measured(drift):
    d = next(r for r in drift["rows"] if r["profile"] == "oscillation")["diagnostic"]
    assert d["samples"] == 48 and d["scoreAtNow"] == 0.16
    # Measured result: no single sample in the trailing 24h reaches the threshold either.
    assert d["flaggedSamples"] == 0
    assert d["maxSingleSampleScoreUnrounded"] < 0.22 <= d["maxSingleSampleScore"] + 0.005
    assert "not a rolling-window algorithm" in d["note"]


def test_detection_agreement_is_never_called_accuracy(drift):
    assert "not model accuracy" in drift["measurement"]


# ---- 2. Authored-versus-computed consistency audit -------------------------------------------


def test_audit_covers_13_records_with_10_consistent_2_flagged_1_not_comparable(audit):
    s = audit["summary"]
    assert (s["records"], s["predictions"], s["incidents"]) == (13, 7, 6)
    assert (s["consistent"], s["review"], s["notComparable"]) == (10, 2, 1)
    assert s["consistent"] + s["review"] + s["notComparable"] == s["records"]


def test_the_two_flagged_records_are_prd_102_and_inc_395(audit):
    assert {r["record"] for r in audit["rows"] if r["result"] == "review"} == {"PRD-102", "INC-395"}


def test_inc_395_is_an_open_high_severity_incident_beside_a_healthy_live_score(audit):
    r = next(r for r in audit["rows"] if r["record"] == "INC-395")
    assert (r["authoredSeverity"], r["authoredStatus"]) == ("high", "investigating")
    assert (r["liveAnomalyScore"], r["liveState"], r["liveSignal"]) == (0.16, "healthy", NO_SIGNAL)
    assert r["linkId"] == "bengaluru-hyderabad-core"


def test_prd_102_understates_a_strong_live_signal(audit):
    r = next(r for r in audit["rows"] if r["record"] == "PRD-102")
    assert (r["authoredSeverity"], r["liveSignal"]) == ("medium", STRONG_SIGNAL)


def test_resolved_incident_is_not_comparable(audit):
    r = next(r for r in audit["rows"] if r["record"] == "INC-385")
    assert r["result"] == "not-comparable"


def test_heuristic_bands_are_labelled_as_not_a_product_rule(audit):
    assert "NOT a product rule" in audit["heuristic"]["note"]
    assert signal_band(0.1) == NO_SIGNAL and signal_band(0.22) != NO_SIGNAL and signal_band(0.35) == STRONG_SIGNAL


# ---- the two measurements stay separate ------------------------------------------------------


def test_evidence_layers_are_separate_artefacts_never_summed(run):
    results = build_results(run)
    assert set(results) == {"drift_profile_eval.json", "consistency_audit.json", "workflow_cases.json"}
    drift_keys = set(results["drift_profile_eval.json"]["summary"])
    audit_keys = set(results["consistency_audit.json"]["summary"])
    assert not (drift_keys & audit_keys)  # no shared/merged metric
    assert "agreement" in drift_keys and "agreement" not in audit_keys
