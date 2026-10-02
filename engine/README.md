# NetSense engine

The Python engine behind the NetSense prototype: **seeded synthetic telemetry**, a **rule-based scorer**, a **rule-based anomaly-to-incident workflow**, and the **evaluation harness**. Standard library only; `pytest` for tests.

It is rule-based and deterministic. It is **not machine learning** (nothing is trained or learned), the telemetry is **synthetic**, and it is not connected to any network.

## What it does

| Module | Role |
|---|---|
| `netsense/telemetry.py` | Seeded generator: 121 samples per link, every 30 min, `t = -48h … +12h`. Six designed profiles (`stable`, `recovering`, `bifurcation`, `loss-degradation`, `saturation`, `oscillation`). `t > 0` is a synthetic continuation, not a forecast model. |
| `netsense/scoring.py` | The rule: per-link-baseline deviation of latency/loss/jitter/bandwidth, normalised and capped, weighted 40/30/15/15, attention at `>= 0.22`; health = `100 - 38 x anomaly`. Scores **one snapshot** — no memory of earlier samples. |
| `netsense/workflow.py` | Joins the computed signal to the authored prediction, incident and engineer records and labels each stage computed or authored. Reads and links; never creates, resolves or assigns anything. |
| `netsense/profiles.py` | The six profiles and their pre-registered expected states (kept in sync with `docs/PROFILE_SPEC.md` by a test). |
| `netsense/seed.py` | Loads and validates the authored seed in `seed/`. |
| `netsense/evaluation.py` | Drift-profile agreement, the authored-vs-computed consistency audit, and the oscillation window diagnostic. |
| `netsense/dataset.py` | Writes the JSON the React app imports (`app/src/data/generated/`) and checks it has not drifted. |
| `netsense/jsmath.py`, `netsense/rng.py` | JavaScript-compatible `Math.round`/`Math.imul` and the seeded PRNG, so Python and the app's TypeScript agree exactly. |

## Computed versus authored

| Computed by the engine | Authored demonstration content (read and validated, never generated) |
|---|---|
| Telemetry, anomaly score, health score, healthy/attention state, per-term evidence | Prediction severity, confidence, fault labels, narrative |
| Display status (worse of live state and authored severity), consistency flags | Incident severity, status, timeline |
| Cross-reference resolution | Engineer assignment |

No function maps a score to a severity, classifies a fault, or assigns an engineer.

## Commands

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"    # Windows; macOS/Linux: .venv/bin/python

python -m netsense evaluate        # print results; rewrite ../docs/results/*.json
python -m netsense build-data      # regenerate ../app/src/data/generated/
python -m netsense check           # exit 1 if generated data or results drifted from the engine
python -m netsense validate-seed   # referential integrity of the authored seed
pytest                             # unit, evaluation, spec and TypeScript-parity tests
```

The TypeScript parity tests run the app's real scorer and the original telemetry generator through `tsx` and need `npm install` in `../app`; without it they are skipped with a reason.

## Evaluation

See [`../docs/EVALUATION.md`](../docs/EVALUATION.md) (method, results, limitations) and [`../docs/PROFILE_SPEC.md`](../docs/PROFILE_SPEC.md) (pre-registered expectations).
