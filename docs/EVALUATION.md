# NetSense evaluation

This is the evaluation of the NetSense **rule-based** detector. It reports two separate measurements (plus a parity check), each with its own method, and it states what they do **not** show. Everything here is reproducible from this repository with the commands at the bottom; every number below is copied from the committed result files in [`results/`](results/).

> **Scope.** The telemetry is synthetic and seeded. The detector is a hand-written rule, not a trained model, so there is no model accuracy to report. Nothing here is a claim about real networks, real outages, real users or any deployment.

## Summary

| Measurement | Result | What it is |
|---|---|---|
| Rule-based detection agreement on designed profiles | **5/5** resolvable profiles matched their pre-registered expected state (1 profile unresolvable, reported separately) | Does the rule give the state each designed test scenario implies? **Not** model accuracy. |
| Authored-versus-computed consistency audit | **10** consistent, **2** flagged, **1** not comparable, across 13 records (7 predictions + 6 incidents) | Does the hand-authored demonstration layer agree with the live computed signal? A separate check. |

These two are different measurements and are never added together or presented as one accuracy figure.

**The finding that matters:** a **temporal blind spot** — on the intermittent-instability profile (Bengaluru–Hyderabad Core) the scorer gives a healthy score (~0.16) beside an active high-severity incident (INC-395, authored demonstration data) on that same corridor. The expected-state check could not assert a state for this profile in advance, and the consistency audit independently flags the contradiction. Rolling-window scoring is documented as the next step and is **not built**.

## What is being tested

NetSense scores each link with one fixed rule ([`engine/netsense/scoring.py`](../engine/netsense/scoring.py)):

1. For latency, packet loss, jitter and bandwidth utilisation, measure deviation from **that link's own baseline** (only in the bad direction), normalise each to a "notable excursion" scale and cap it at 1.
2. Combine with weights: **latency 40%, loss 30%, jitter 15%, bandwidth 15%** into an anomaly score in [0, 1].
3. A link is `attention` at or above **0.22**, otherwise `healthy`. Health score = 100 − 38 × anomaly score.

The rule looks at **one instant**: the latest ("now", `t = 0`) sample. That is the property under test in the oscillation finding below.

## Method

**Pre-registration.** The designed profiles, each profile's expected state, the rule for which profiles are *resolvable*, the agreement metric and the audit rules were fixed in [`PROFILE_SPEC.md`](PROFILE_SPEC.md) and committed **before** the Python engine or this harness existed. A test (`tests/test_profile_spec.py`) fails if that document and the code disagree.

**Provenance, stated plainly.** The same expectations were first used when this check ran against the original TypeScript implementation. The Python engine is a re-implementation, so this evaluation is a re-run against fixed expectations plus a parity check against the TypeScript scorer — not a blind first look.

**Material.** Six corridors, each carrying one designed telemetry profile. Each has 121 synthetic samples: `t = −48 h … +12 h` at 30-minute intervals, from a seeded generator (baseline + seeded noise + a profile-specific deviation, lightly smoothed). `t = 0` is the sample the detector scores. Samples with `t > 0` are the same profile function continuing forward — a synthetic projection, **not** a forecasting model — and are never scored.

**Resolvable versus unresolvable.** A profile is *resolvable* when its design fixes one expected state for the single instant `t = 0` regardless of oscillation phase. Five are: `stable` (nothing deviates → healthy), `recovering` (a past excursion that has decayed → healthy), and three ramps already under way at "now" (`bifurcation`, `loss-degradation`, `saturation` → attention). `oscillation` is not: its designed property is *intermittency over a window*, so the state at one instant depends on phase and the design cannot assert one. Only resolvable profiles count toward agreement.

**What is computed and what is authored.** The anomaly score, health score and healthy/attention state are **computed** from the telemetry. Prediction severity and confidence, fault labels, incident narratives and severities, and engineer assignments are **authored demonstration content**: the engine validates and joins them, never generates them, and nothing here presents them as model output. No function in the product maps a score to a severity. The audit therefore uses an **evaluation-only heuristic** on the live score — below 0.22 is "no live signal", 0.22 to below 0.35 "moderate", 0.35 and above "strong" — which is *not* a product rule.

## Result 1 — Detection agreement on designed profiles

Rule-based detection agreement against designed test scenarios (**not** model accuracy):

| Profile | Corridor | Expected at `t = 0` | Anomaly score | Health score | Engine state | Result |
|---|---|---|---|---|---|---|
| `stable` | Bengaluru–Chennai Core | healthy | 0.00 | 100.0 | healthy | match |
| `recovering` | Chennai–Pune Core | healthy | 0.00 | 100.0 | healthy | match |
| `bifurcation` | Mumbai–Delhi Core | attention | 0.25 | 90.6 | attention | match |
| `loss-degradation` | Mumbai–Pune Metro | attention | 0.51 | 80.6 | attention | match |
| `saturation` | Delhi–Bengaluru Core | attention | 0.44 | 83.2 | attention | match |
| `oscillation` | Bengaluru–Hyderabad Core | none asserted | 0.16 | 93.9 | healthy | not scored (unresolvable) |

**5/5 resolvable profiles matched; 0 mismatched.** The oscillation row is reported, not scored.

## Result 2 — The temporal blind spot

At `t = 0` the oscillation corridor is 15.6 ms against a 13.4 ms baseline (latency term 0.33) with jitter 1.3 ms against 0.9 ms (jitter term 0.20). Weighted, that is **0.16**, below the 0.22 threshold, so the corridor reads **healthy**.

Beside it, the authored data holds **INC-395** — "BGP Peer Dampening", status *investigating*, authored severity *high* — on the same corridor. The consistency audit flags this as the one record where an open, severe incident has no live corroborating signal. (The app's display rule — the worse of live state and authored severity — still shows this corridor as needing attention, because of the authored incident; the live computed state is healthy. The engine reports this as `authored_severity_without_live_signal`.)

The scorer reads one instant and has no memory of earlier samples, so intermittent instability is a **temporal blind spot** for it. Rolling-window scoring is documented as the next step and is **not built**; this evaluation does not test whether it would help.

## Result 3 — Authored-versus-computed consistency audit

All 13 records compared with the live state of the corridor each points at (heuristic bands above; **not** a product rule). Resolved incidents are "not comparable": a healthy reading *now* is the correct outcome for a past event.

| Record | Type | Corridor | Live score | Live state | Authored severity | Authored status | Result |
|---|---|---|---|---|---|---|---|
| PRD-104 | prediction | Mumbai–Delhi Core | 0.25 | attention | high | active | consistent |
| PRD-103 | prediction | Mumbai–Pune Metro | 0.51 | attention | high | active | consistent |
| PRD-102 | prediction | Delhi–Bengaluru Core | 0.44 | attention | medium | investigating | **review** |
| PRD-101 | prediction | Bengaluru–Chennai Core | 0.00 | healthy | low | monitored | consistent |
| PRD-100 | prediction | Bengaluru–Hyderabad Core | 0.16 | healthy | medium | investigating | consistent |
| PRD-099 | prediction | Chennai–Pune Core | 0.00 | healthy | medium | monitored | consistent |
| PRD-105 | prediction | Bengaluru–Chennai Core | 0.00 | healthy | low | monitored | consistent |
| INC-402 | incident | Mumbai–Delhi Core | 0.25 | attention | critical | investigating | consistent |
| INC-398 | incident | Delhi–Bengaluru Core | 0.44 | attention | high | investigating | consistent |
| INC-395 | incident | Bengaluru–Hyderabad Core | 0.16 | healthy | high | investigating | **review** |
| INC-391 | incident | Chennai–Pune Core | 0.00 | healthy | medium | mitigated | consistent |
| INC-388 | incident | Mumbai–Pune Metro | 0.51 | attention | medium | mitigated | consistent |
| INC-385 | incident | Bengaluru–Chennai Core | 0.00 | healthy | medium | resolved | not comparable |

**10 consistent, 2 flagged, 1 not comparable.**

- **INC-395** (flagged, the significant one): described above — an open, high-severity incident on a corridor the detector reads as healthy.
- **PRD-102** (flagged, minor): authored severity *medium* beside a *strong* live signal (0.44). It understates the live signal; it does not contradict it.

## Failure analysis — INC-395

```
Oscillating telemetry (a 9-hour sine, the `oscillation` profile)
  → the scorer reads one instant ("now") and gives it 0.16
    → live state: healthy
      → an active, high-severity incident (INC-395, authored demonstration data) sits on the same corridor
        → an operator checking both screens sees a contradiction
          → the evaluation surfaces it: a temporal blind spot
```

This is a product failure found by evaluation, not a coding bug: the scorer does exactly what it is written to do. [`FAILURES-GUARDRAILS.md`](FAILURES-GUARDRAILS.md) analyses its user impact, what the product correctly does not do when its layers disagree, and what a future guardrail would look like.

## Product decision

The failure is left visible on purpose. The synthetic telemetry was not retuned (that would make the table green without changing the product), the formula and the 0.22 threshold were not changed in reaction to one case, and rolling-window scoring is documented as the next step and **not built**. Keeping the failure is the point of having an evaluation.

## Verification that the engine matches the app

The React app still scores telemetry in TypeScript (`app/src/lib/derive.ts`) while the Python engine generates the data it reads. They are held together by parity tests that compare **exactly**, with no tolerances:

- The **original TypeScript telemetry generator** and the Python generator produce identical output, sample for sample (6 × 121 = 726 samples).
- The app's own scorer, run on the Python-generated telemetry, equals the Python scores for every link; the app's display status and overview figures equal the Python workflow's.
- The TypeScript and Python scorers agree on **900 arbitrary and boundary inputs** (both `healthy` and `attention` outcomes occur), and on `Math.round` semantics and the seeded random stream.
- Mutation checks confirmed these tests fail when a weight, the threshold or the RNG constant is changed.

## Limitations

- **Synthetic, designed scenarios.** The profiles were designed by the author of the rule, so strong agreement is partly by construction. Five scenarios is a sanity check that the rule does what its author intended, not evidence about real-world performance.
- **Not model accuracy.** No precision, recall, F1 or false-positive rate is reported or implied; there is no labelled real data to compute them on.
- **The resolvability split was a design decision** made by the author, with the earlier TypeScript result known (see Provenance).
- **Single-instant scoring.** The scorer takes one snapshot and a baseline and has no memory of earlier samples; the temporal blind spot above follows from that design.
- **Authored layer.** Severity, confidence, fault labels, incident content and engineer assignment are authored demonstration content. The audit measures their consistency with the live signal; it does not validate them as predictions.
- **Heuristic bands** used by the audit are evaluation-only.
- **No real-user or production evidence** of any kind is part of this evaluation.

## Next step (documented, not built)

Rolling-window / variance-aware scoring: use the recent pattern of samples, not only the latest, so intermittent instability is not invisible to the detector. This is a hypothesis the oscillation finding motivates. It is **not built**, and its value would need to be shown by a new pre-registered evaluation before it is claimed.

## Reproduce

```bash
cd engine
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"   # Windows; use .venv/bin/python on macOS/Linux
.venv/Scripts/python -m netsense evaluate          # prints the tables and rewrites docs/results/*.json
.venv/Scripts/python -m netsense check             # fails if generated app data or results drifted
.venv/Scripts/python -m pytest                     # unit, evaluation and spec tests
cd ../app && npm install                           # enables the TypeScript parity tests in pytest
```

The results file `drift_profile_eval.json` also carries a descriptive per-sample diagnostic for the oscillation profile; it is not used for any claim in this document.

Result files: [`results/drift_profile_eval.json`](results/drift_profile_eval.json), [`results/consistency_audit.json`](results/consistency_audit.json), [`results/workflow_cases.json`](results/workflow_cases.json) (per-link workflow output, with each field marked computed or authored).
