"""JavaScript-compatible numeric primitives.

NetSense's synthetic telemetry was first written in TypeScript, and the React app
still scores it in TypeScript. For the Python engine to be a faithful source of
truth, the two must agree exactly, so the few JavaScript semantics the original
code relied on (``Math.imul``, ``Math.round``, UTF-16 string hashing) are
reproduced here rather than approximated with Python's own behaviour.
"""

from __future__ import annotations

import math

U32 = 0xFFFFFFFF


def imul(a: int, b: int) -> int:
    """``Math.imul`` on 32-bit patterns, returned as an unsigned 32-bit integer."""
    return (a * b) & U32


def js_round(x: float) -> float:
    """``Math.round``: nearest integer, ties rounded toward +infinity.

    Python's built-in ``round`` uses banker's rounding, which would silently
    disagree with the TypeScript output on exact halves.
    """
    if math.isnan(x) or math.isinf(x):
        return x
    floor = math.floor(x)
    return float(floor + 1) if (x - floor) >= 0.5 else float(floor)


def utf16_code_units(text: str) -> list[int]:
    """The sequence JavaScript's ``String.prototype.charCodeAt`` would yield."""
    raw = text.encode("utf-16-le")
    return [int.from_bytes(raw[i : i + 2], "little") for i in range(0, len(raw), 2)]


def clamp(n: float, lo: float, hi: float) -> float:
    """``Math.min(hi, Math.max(lo, n))`` — same argument order as the TypeScript scorer."""
    return min(hi, max(lo, n))
