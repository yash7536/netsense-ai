import pytest

from netsense.profiles import LINK_PROFILES
from netsense.scoring import ANOMALY_ATTENTION_THRESHOLD, score_snapshot
from netsense.telemetry import (
    DRIFT_PROFILES,
    HOURS_FUTURE,
    HOURS_PAST,
    SAMPLES_PER_LINK,
    Baseline,
    current_snapshot,
    generate_telemetry,
)

BASE = Baseline(latency_ms=20.0, loss_pct=0.02, jitter_ms=1.0, bandwidth_pct=60.0)


def test_shape_is_121_half_hour_samples_from_minus_48_to_plus_12():
    pts = generate_telemetry("any-link", BASE, "stable")
    assert len(pts) == SAMPLES_PER_LINK == 121
    assert pts[0].t == -HOURS_PAST and pts[-1].t == HOURS_FUTURE
    assert [b.t - a.t for a, b in zip(pts, pts[1:])] == [0.5] * 120


def test_generation_is_deterministic_per_link_id():
    assert generate_telemetry("x", BASE, "oscillation") == generate_telemetry("x", BASE, "oscillation")
    assert generate_telemetry("x", BASE, "stable") != generate_telemetry("y", BASE, "stable")


@pytest.mark.parametrize("profile", DRIFT_PROFILES)
def test_values_stay_in_physical_ranges_and_rounding(profile):
    for p in generate_telemetry("range-check", BASE, profile):
        assert p.latency_ms >= 0.1 and p.loss_pct >= 0 and p.jitter_ms >= 0
        assert 0 <= p.bandwidth_pct <= 100
        assert round(p.latency_ms, 1) == p.latency_ms and round(p.bandwidth_pct, 1) == p.bandwidth_pct
        assert round(p.loss_pct, 2) == p.loss_pct


def test_unknown_profile_is_rejected():
    with pytest.raises(ValueError):
        generate_telemetry("x", BASE, "not-a-profile")


def test_stable_profile_stays_near_baseline():
    pts = generate_telemetry("stable-check", BASE, "stable")
    assert max(abs(p.latency_ms - BASE.latency_ms) for p in pts) < BASE.latency_ms * 0.05


def test_saturation_and_bifurcation_trend_upward_toward_now():
    sat = generate_telemetry("s", BASE, "saturation")
    assert current_snapshot(sat).bandwidth_pct > sat[0].bandwidth_pct + 15
    bif = generate_telemetry("b", BASE, "bifurcation")
    assert current_snapshot(bif).latency_ms > bif[0].latency_ms


def test_recovering_excursion_has_cleared_by_now_but_is_visible_earlier():
    pts = generate_telemetry("r", BASE, "recovering")
    at = {p.t: p for p in pts}
    assert at[-30.0].latency_ms > BASE.latency_ms + 4  # the designed past excursion
    assert abs(at[0.0].latency_ms - BASE.latency_ms) < 1.0  # cleared


def test_current_snapshot_is_the_t0_sample():
    assert current_snapshot(generate_telemetry("c", BASE, "stable")).t == 0


def test_every_link_has_exactly_one_designed_profile():
    assert set(LINK_PROFILES.values()) == set(DRIFT_PROFILES)
    assert len(LINK_PROFILES) == 6


def test_projection_samples_exist_but_vitals_come_from_t0_only(run):
    for link in run.seed.links:
        points = run.telemetry[link["id"]]
        assert any(p.t > 0 for p in points)  # a synthetic continuation exists...
        now = current_snapshot(points)
        assert now.t == 0  # ...but the detector scores the t == 0 sample only
        assert score_snapshot(now, Baseline.from_json(link["baseline"])).anomaly_score == run.vitals[link["id"]].anomaly_score


def test_threshold_constant_is_the_documented_value():
    assert ANOMALY_ATTENTION_THRESHOLD == 0.22
