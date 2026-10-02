"""The six designed telemetry profiles and their pre-registered expectations.

Everything in this module mirrors ``docs/PROFILE_SPEC.md``, which was written and
committed *before* the engine existed. A test (``tests/test_profile_spec.py``)
fails if this table and that document ever disagree.

A profile is **resolvable** when its design fixes a single expected state for the
instant ``t = 0`` independent of oscillation phase. Only resolvable profiles are
scored for agreement.
"""

from __future__ import annotations

from dataclasses import dataclass

from .scoring import LinkState


@dataclass(frozen=True)
class ProfileSpec:
    profile: str
    link_id: str
    designed_behaviour: str
    expected_state: LinkState | None  # None when the design asserts no single-instant state
    resolvable: bool
    reason: str


PROFILE_SPECS: tuple[ProfileSpec, ...] = (
    ProfileSpec(
        profile="stable",
        link_id="bengaluru-chennai-core",
        designed_behaviour="No drift; sampling noise only.",
        expected_state="healthy",
        resolvable=True,
        reason="Nothing is designed to deviate.",
    ),
    ProfileSpec(
        profile="recovering",
        link_id="chennai-pune-core",
        designed_behaviour="A past excursion centred at t=-30h (Gaussian, width 4h) that has since cleared.",
        expected_state="healthy",
        resolvable=True,
        reason="The designed excursion has fully decayed 30 hours later.",
    ),
    ProfileSpec(
        profile="bifurcation",
        link_id="mumbai-delhi-core",
        designed_behaviour="Flat until t=-6h, then a rising cascade across all four metrics.",
        expected_state="attention",
        resolvable=True,
        reason="Drift is designed to be underway at 'now' (ramp 25.9% progressed).",
    ),
    ProfileSpec(
        profile="loss-degradation",
        link_id="mumbai-pune-metro",
        designed_behaviour="Packet loss and latency degrade from t=-20h.",
        expected_state="attention",
        resolvable=True,
        reason="Drift is designed to be underway at 'now' (ramp 68.4% progressed).",
    ),
    ProfileSpec(
        profile="saturation",
        link_id="delhi-bengaluru-core",
        designed_behaviour="Bandwidth, latency and jitter climb across the whole window.",
        expected_state="attention",
        resolvable=True,
        reason="Drift is designed to be well underway at 'now' (ramp 89.6% progressed).",
    ),
    ProfileSpec(
        profile="oscillation",
        link_id="bengaluru-hyderabad-core",
        designed_behaviour="Intermittent instability: a 9h sine on jitter and latency with growing amplitude.",
        expected_state=None,
        resolvable=False,
        reason=(
            "The designed property is intermittency over a window. The state at one instant "
            "depends on oscillation phase, so the design cannot assert one."
        ),
    ),
)

PROFILE_BY_NAME: dict[str, ProfileSpec] = {s.profile: s for s in PROFILE_SPECS}

# Which designed profile each link carries (the single place a link's "story" is declared).
LINK_PROFILES: dict[str, str] = {s.link_id: s.profile for s in PROFILE_SPECS}


def resolvable_specs() -> list[ProfileSpec]:
    return [s for s in PROFILE_SPECS if s.resolvable]
