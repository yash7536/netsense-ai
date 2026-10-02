"""Deterministic seeded randomness.

``mulberry32`` is a tiny 32-bit PRNG; ``seed_from_string`` is FNV-1a. Both are
ports of the TypeScript originals and produce bit-identical streams, so a link id
always yields the same telemetry, in either language.
"""

from __future__ import annotations

from collections.abc import Callable

from .jsmath import U32, imul, utf16_code_units


def seed_from_string(text: str) -> int:
    """FNV-1a (32-bit) over the string's UTF-16 code units."""
    h = 2166136261
    for unit in utf16_code_units(text):
        h ^= unit
        h = imul(h, 16777619)
    return h & U32


def mulberry32(seed: int) -> Callable[[], float]:
    """Return a function yielding floats in ``[0, 1)``, deterministic for a seed."""
    a = seed & U32

    def random() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & U32
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & U32) ^ t
        return ((t ^ (t >> 14)) & U32) / 4294967296

    return random
