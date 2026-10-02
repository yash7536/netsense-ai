import pytest

from netsense.scoring import (
    ANOMALY_ATTENTION_THRESHOLD,
    HEALTH_FLOOR,
    WEIGHT_BANDWIDTH,
    WEIGHT_JITTER,
    WEIGHT_LATENCY,
    WEIGHT_LOSS,
    contributions,
    score_snapshot,
)
from netsense.telemetry import Baseline, TelemetryPoint

BASE = Baseline(latency_ms=20.0, loss_pct=0.02, jitter_ms=1.0, bandwidth_pct=60.0)


def pt(latency=20.0, loss=0.02, jitter=1.0, bandwidth=60.0) -> TelemetryPoint:
    return TelemetryPoint(t=0, latency_ms=latency, loss_pct=loss, jitter_ms=jitter, bandwidth_pct=bandwidth)


def test_documented_weights_and_threshold():
    assert (WEIGHT_LATENCY, WEIGHT_LOSS, WEIGHT_JITTER, WEIGHT_BANDWIDTH) == (0.40, 0.30, 0.15, 0.15)
    assert round(WEIGHT_LATENCY + WEIGHT_LOSS + WEIGHT_JITTER + WEIGHT_BANDWIDTH, 10) == 1.0
    assert ANOMALY_ATTENTION_THRESHOLD == 0.22


def test_baseline_telemetry_scores_zero_and_healthy():
    v = score_snapshot(pt(), BASE)
    assert v.anomaly_score == 0 and v.health_score == 100 and v.status == "healthy"


def test_only_deviation_in_the_bad_direction_counts():
    better = score_snapshot(pt(latency=10.0, loss=0.0, jitter=0.2, bandwidth=20.0), BASE)
    assert better.anomaly_score == 0 and better.status == "healthy"


@pytest.mark.parametrize(
    "kwargs, weight",
    [
        (dict(latency=20.0 * 1.5), WEIGHT_LATENCY),  # +50% latency saturates the latency term
        (dict(loss=0.02 + 0.5), WEIGHT_LOSS),  # +0.5 percentage points saturates loss
        (dict(jitter=1.0 + 2.0), WEIGHT_JITTER),  # +2 ms saturates jitter
        (dict(bandwidth=100.0), WEIGHT_BANDWIDTH),  # 75% -> 100% maps onto 0 -> 1
    ],
)
def test_each_term_saturates_at_its_own_weight(kwargs, weight):
    assert score_snapshot(pt(**kwargs), BASE).raw_anomaly_score == pytest.approx(weight)


def test_terms_are_capped_at_one_so_composite_never_exceeds_one():
    v = score_snapshot(pt(latency=500, loss=50, jitter=100, bandwidth=100), BASE)
    assert v.raw_anomaly_score == pytest.approx(1.0)
    assert v.anomaly_score == 1.0
    assert v.health_score == 62.0  # 100 - 38; the 55 floor is defensive and unreachable with a capped score
    assert v.health_score >= HEALTH_FLOOR


def test_contributions_sum_to_the_raw_score():
    v = score_snapshot(pt(latency=26, loss=0.3, jitter=2.2, bandwidth=88), BASE)
    assert sum(contributions(v).values()) == pytest.approx(v.raw_anomaly_score)


def test_status_flips_exactly_at_the_threshold_on_the_unrounded_score():
    for i in range(400, 700):
        v = score_snapshot(pt(latency=round(20 + i * 0.01, 2)), BASE)
        assert (v.status == "attention") == (v.raw_anomaly_score >= ANOMALY_ATTENTION_THRESHOLD)


def test_displayed_score_can_round_to_the_threshold_while_status_stays_healthy():
    """Status is decided on the unrounded score, so a link can display 0.22 and still be healthy."""
    candidates = [score_snapshot(pt(latency=round(20 + i * 0.01, 2)), BASE) for i in range(500, 600)]
    assert any(v.anomaly_score == 0.22 and v.status == "healthy" for v in candidates)


def test_health_is_100_minus_38_times_anomaly():
    v = score_snapshot(pt(latency=24.0), BASE)
    assert v.health_score == pytest.approx(round(100 - v.raw_anomaly_score * 38, 1))


def test_score_is_monotone_non_decreasing_in_each_metric():
    for metric, values in {
        "latency": [20, 22, 25, 30, 40],
        "loss": [0.02, 0.1, 0.3, 0.6],
        "jitter": [1.0, 1.5, 2.5, 4.0],
        "bandwidth": [60, 75, 85, 100],
    }.items():
        scores = [score_snapshot(pt(**{metric: v}), BASE).raw_anomaly_score for v in values]
        assert scores == sorted(scores)


def test_scorer_takes_one_snapshot_and_a_baseline_and_nothing_else():
    """The documented limitation, as an interface fact: no history goes into the score."""
    assert score_snapshot.__code__.co_argcount == 2
    assert score_snapshot.__code__.co_varnames[:2] == ("now", "baseline")


def test_rounding_of_reported_deltas():
    v = score_snapshot(pt(latency=22.34, jitter=1.26), BASE)
    assert v.latency_delta_ms == 2.3 and v.jitter_delta_ms == 0.3
    assert v.latency_delta_pct == 11.7
