"""The JavaScript-compat primitives, pinned to values observed from real JavaScript (Node)."""

import math

from netsense.jsmath import clamp, imul, js_round, utf16_code_units
from netsense.rng import mulberry32, seed_from_string


def test_js_round_matches_math_round_on_ties_and_negatives():
    # Observed in Node: Math.round(2.5)=3, (-2.5)=-2, (0.5)=1, (-0.5)=-0, (1.4999999999999998)=1
    assert js_round(2.5) == 3
    assert js_round(-2.5) == -2
    assert js_round(0.5) == 1
    assert js_round(-0.5) == 0
    assert js_round(1.4999999999999998) == 1


def test_js_round_differs_from_pythons_bankers_rounding_on_exact_halves():
    assert round(2.5) == 2 and js_round(2.5) == 3  # why the primitive exists


def test_js_round_passes_through_non_finite():
    assert math.isnan(js_round(float("nan")))
    assert js_round(float("inf")) == float("inf")


def test_clamp_uses_min_of_hi_and_max_of_lo():
    assert clamp(5, 0, 1) == 1
    assert clamp(-5, 0, 1) == 0
    assert clamp(0.4, 0, 1) == 0.4


def test_imul_wraps_like_math_imul():
    # Math.imul(-1, 5) === -5, i.e. the unsigned 32-bit pattern 0xFFFFFFFB
    assert imul(0xFFFFFFFF, 5) == 0xFFFFFFFB
    assert imul(0x7FFFFFFF, 2) == 0xFFFFFFFE


def test_utf16_code_units_for_bmp_and_astral():
    assert utf16_code_units("a") == [97]
    assert utf16_code_units("–") == [0x2013]  # en dash, as in "Mumbai-Delhi"
    assert utf16_code_units("\U0001F600") == [0xD83D, 0xDE00]  # surrogate pair, like charCodeAt


def test_seed_from_string_matches_typescript_fnv1a():
    # Values observed from the original TypeScript seedFromString
    assert seed_from_string("mumbai-delhi-core") == 2120031975
    assert seed_from_string("a") == 3826002220
    assert seed_from_string("–") == 373217250


def test_mulberry32_stream_matches_typescript():
    rand = mulberry32(2120031975)
    first = [rand() for _ in range(3)]
    assert first == [0.5459876901004463, 0.7639983906410635, 0.09133433504030108]


def test_mulberry32_is_deterministic_and_in_unit_interval():
    a, b = mulberry32(42), mulberry32(42)
    xs = [a() for _ in range(1000)]
    assert xs == [b() for _ in range(1000)]
    assert all(0 <= x < 1 for x in xs)
