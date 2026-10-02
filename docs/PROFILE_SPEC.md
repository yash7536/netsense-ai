# Evaluation spec — designed telemetry profiles and expected states

This file is the **pre-registration** for the NetSense rule-based detection evaluation. It was written and committed *before* the Python engine and evaluation harness existed, so the expectations below cannot have been adjusted to fit results. Results live in [`EVALUATION.md`](EVALUATION.md); this file only defines what is being tested and what counts as agreement.

## What is being tested

NetSense scores each network link with a fixed, hand-written rule: weighted deviation of latency, packet loss, jitter and bandwidth utilisation from that link's own baseline, compared against a single attention threshold (`0.22`). There is no trained model, so there is no train/test split and no "model accuracy". The question this evaluation asks is narrower and honest about that:

> For telemetry that was *designed* to represent a particular kind of behaviour, does the rule produce the state the design implies?

This is **rule-based detection agreement against designed test scenarios**. It is not accuracy, precision or recall, and it says nothing about real networks.

## Test material

- 6 corridors, each assigned exactly one designed telemetry profile (the existing mapping in the app).
- 121 synthetic samples per corridor: `t = -48 h … +12 h` in 30-minute steps. `t = 0` is the "now" sample the detector scores. Samples with `t > 0` come from the same profile function (a synthetic projection, **not** a forecasting model) and are never scored.
- Synthetic, seeded, deterministic. No real network data of any kind.

## Resolvability rule (fixed in advance)

A profile is **resolvable** if its design fixes one expected state for the single instant `t = 0` independent of oscillation phase. That holds when the profile's deterministic component at `t = 0` is monotone (flat, a ramp, or a decayed excursion). A profile is **not resolvable** if its deterministic component is dominated by a zero-mean periodic wave (a small slow offset aside): whether one particular instant falls on a crest, a trough or a zero-crossing is then an accident of phase, so the design itself cannot assert a state at that instant.

Only resolvable profiles are scored for agreement. Unresolvable profiles are reported, never counted for or against the agreement rate.

## Profiles and expected `t = 0` state

| Profile | Link | Designed behaviour | Deterministic component at `t = 0` | Expected state | Resolvable? | Reason |
|---|---|---|---|---|---|---|
| `stable` | Bengaluru–Chennai Core | No drift; sampling noise only | none | healthy | yes | Nothing designed to deviate. |
| `recovering` | Chennai–Pune Core | A past excursion centred at `t = -30 h` (Gaussian, width 4 h) that has since cleared | `exp(-(30/4)²) ≈ 4·10⁻²⁵` of the excursion — numerically zero | healthy | yes | The designed excursion has fully decayed 30 h later. |
| `bifurcation` | Mumbai–Delhi Core | Flat until `t = -6 h`, then a rising cascade across all four metrics | smooth-step ramp already 25.9 % progressed | attention | yes | Drift is designed to be underway at "now". |
| `loss-degradation` | Mumbai–Pune Metro | Loss and latency degrade from `t = -20 h` | ramp 68.4 % progressed | attention | yes | Drift is designed to be underway at "now". |
| `saturation` | Delhi–Bengaluru Core | Bandwidth, latency and jitter climb across the whole window | ramp 89.6 % progressed | attention | yes | Drift is designed to be well underway at "now". |
| `oscillation` | Bengaluru–Hyderabad Core | Intermittent instability: a 9 h sine on jitter and latency whose amplitude grows over the window | latency: a zero-mean sine evaluated at a phase accident (`sin(1)`); jitter: `sin(0) = 0` plus a small slowly-growing offset (`0.4 × growth`) | **none asserted** | **no** | Designed property is *intermittency over a window*. A single instant's state depends on phase, so the design cannot assert one. |

Counts fixed in advance: **6 profiles, 5 resolvable, 1 unresolvable.**

### Scoring the result

- For each resolvable profile: **match** if the engine's `t = 0` state equals the expected state, otherwise **mismatch**.
- Reported figure: *matches ÷ resolvable* (target denominator: 5).
- The unresolvable profile is reported separately (anomaly score, health score, state), with no pass/fail.

### Diagnostic for the unresolvable profile (not scored, no pass/fail)

To characterise — not fix — what a single-instant check can miss, the harness also reports, for the oscillation link only, how many of the 30-minute samples in the trailing 24 h would have been flagged *if the same single-sample rule were applied at each of those instants*. This is a measurement of exposure, not a scoring method: it is not a rolling-window algorithm, it is not part of the engine, and the app never uses it. Rolling-window / variance-aware scoring remains **future work, not built**.

## Authored-versus-computed consistency audit

Separate from the above and never merged with it. For each prediction and incident, compare its *authored* severity (fixed demonstration content) with the *live computed* state of the corridor it points at.

- Evaluation-only heuristic bands on the live anomaly score: `< 0.22` → no live signal; `0.22 – < 0.35` → moderate; `≥ 0.35` → strong. **This is not a product rule**; no function in the product maps scores to severities.
- Prediction → **review** if: authored severity is high/critical and there is no live signal; or authored severity is below high and the live signal is strong; or status is `monitored` while any live signal exists. Otherwise consistent.
- Incident → **not comparable** if resolved (a healthy "now" is the correct outcome for a past event). Otherwise **review** if authored severity is high/critical and there is no live signal; otherwise consistent.
- Population: 7 predictions + 6 incidents = 13 records.

## Evidence layers (kept separate)

1. Rule-based detection agreement on designed profiles (this spec, resolvable cases only).
2. Authored-versus-computed consistency audit (13 records).
3. The oscillation diagnostic (descriptive only).

These are three different measurements. They are never added together or presented as one accuracy figure.

## Provenance note

The same expectations were used when this check was first run against the original TypeScript implementation. The Python engine is a re-implementation, so this evaluation is a re-run against fixed expectations plus a parity check against the TypeScript scorer — not a blind first look.
