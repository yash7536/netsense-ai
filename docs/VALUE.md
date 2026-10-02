# NetSense AI — Business & User Value

This is the seventh and final documented AI PM requirement, building directly on [PROBLEM.md](PROBLEM.md) (who has the problem, and the product hypothesis), [EVALUATION.md](EVALUATION.md) (whether the detection layer actually works), and [FAILURES-GUARDRAILS.md](FAILURES-GUARDRAILS.md) (where it doesn't, and what the product does about that).

**The central distinction this entire document rests on: everything below is a value hypothesis, not a measured result.** The public record contains no user-testing results: real-world testing was done in a confidential network-operations setting, and its data, findings and feedback cannot be disclosed. Where a number would normally go, there is a mechanism and a way it could eventually be measured instead — never an invented figure.

## The Core Value Hypothesis

This is the same product hypothesis introduced in [PROBLEM.md](PROBLEM.md), examined here specifically for its value implications:

> **Hypothesis:** By connecting an abnormal signal to its evidence, its prediction context, and its incident/ownership context in one workflow, NetSense can reduce investigation friction and shorten time-to-context for network operations users — helping them move from "something changed" to "here's what it is, here's the evidence, here's who owns it" with fewer fragmented steps.

Not: "the dashboard looks better." The claim is specifically about reducing the number of separate places an operator has to look before they can act with confidence — see the Before → After table in `PROBLEM.md` for exactly which steps this targets.

## Part 1 — User Value

### 1. Time-to-context
**Hypothesis:** because telemetry, evidence, predictions, and incidents are cross-referenced and reachable from one connected set of screens (verified real navigation — link ↔ prediction ↔ incident ↔ engineer, not decorative text), an operator should need to visit fewer separate tools to assemble the same picture they'd otherwise build by hand. No time figure is claimed — only the mechanism (fewer required lookups) that would need to be tested to know if it actually shortens anything.

### 2. Investigation friction
**Hypothesis:** the connected workflow *should* reduce the need to manually reassemble context across separate views, because the relationships (link → prediction → incident → engineer) already exist as real, clickable references rather than something the operator has to reconstruct themselves. Whether this actually reduces friction in practice — versus just relocating the same effort into more scrolling and clicking — is not demonstrated anywhere in the public record.

### 3. Prioritization
**Hypothesis, explicitly bounded by the evaluation:** sortable, filterable tables across links, predictions, incidents, and engineers give an operator a real mechanism to compare signals across the whole fleet at once, rather than one at a time. **This is not a claim that NetSense always prioritizes correctly.** `EVALUATION.md` and `FAILURES-GUARDRAILS.md` already show authored severity can understate a strong live signal (PRD-102) or, in the INC-395 case, actively contradict it. Any prioritization value this product offers is conditional on the layers underneath it agreeing — which they don't always do today.

### 4. Decision confidence
**Hypothesis:** presenting evidence (telemetry charts, evidence tiles, incident timelines) alongside a claim, instead of the claim alone, could help an operator decide with more confidence than a severity label by itself would. This is plausible by design, not demonstrated in the public record.

## Part 2 — Business Value

Each item below is framed strictly as **potential value → mechanism → how it could eventually be measured** — never as a claimed outcome.

| Potential Value | Mechanism | How It Could Eventually Be Measured |
|---|---|---|
| Faster triage | Fewer tool switches to reach the same context (telemetry + evidence + incident + owner in one flow) | Time from "signal appears" to "operator has enough context to act," observed in a task-based user test |
| Reduced investigation effort | Relationships (link↔prediction↔incident↔engineer) are pre-built rather than manually reconstructed each time | Number of distinct views/lookups an operator uses per investigation, compared across workflows |
| Reduced context-switching | One connected product surface instead of separate monitoring/ticketing/roster tools | Count of tool or screen switches per investigation task |
| Improved operational efficiency | Sortable/filterable views across the whole fleet, not link-by-link inspection | Time to identify which of several signals to work first, in a multi-signal test scenario |
| Earlier identification of potentially important issues | Live anomaly scoring surfaces drift without waiting for a manual check | Detection agreement against designed scenarios — already partially measured in `EVALUATION.md` (5/5 resolvable cases), with a known gap (oscillation) |
| Better use of engineering attention | Severity/evidence surfaced together, reducing time spent on low-context triage | Proportion of investigation time spent gathering context vs. actually resolving the issue |
| Reduced risk of missing meaningful instability | Deterministic, threshold-based detection runs consistently, without depending on a human noticing a chart | False-negative rate against designed instability scenarios — again, `EVALUATION.md` already shows this is *not* fully achieved today (the oscillation case) |

No monetary values, percentages, or savings figures appear anywhere in this table, and none should be added until they come from an actual measurement.

## Part 3 — Value Tree

Each chain below uses only capabilities that actually exist in the current product.

```
Connected detection + evidence (Link Detail evidence tiles, telemetry charts)
  → operator spends less effort manually assembling supporting metrics
    → potentially faster time-to-context
      → potentially lower investigation effort

Real, clickable link ↔ prediction ↔ incident ↔ engineer relationships
  → operator follows one connected trail instead of separate lookups
    → potentially fewer tool/screen switches per investigation
      → potentially faster triage

Sortable/filterable tables across links, predictions, incidents, engineers
  → operator can compare signals across the whole fleet at once
    → potentially better allocation of attention across many open signals
      → potentially better use of engineering time
        (bounded: only as reliable as the authored severity data — see Part 5)

Incident timeline linked to the telemetry chart's crosshair
  → operator correlates a narrative event to the exact telemetry moment without switching tools
    → potentially fewer manual data-reconciliation steps
      → potentially higher confidence in the incident's own narrative
```

## Part 4 — Metrics (What We Would Measure, Not What We Have Measured)

### Product/UX metrics (would require real users)
- Time to identify which corridor/link needs attention.
- Time to locate the specific evidence supporting a signal.
- Number of distinct screens/views visited per investigation task.
- Task completion rate on a defined investigation scenario.
- Operator-reported confidence in their decision (e.g., a simple self-rated scale).
- Investigation task success — did the operator correctly identify the right link/incident/owner.

### AI/detection metrics (already partially measured — from `EVALUATION.md`, not invented here)
- **Rule-based detection agreement against designed scenarios:** 5/5 resolvable cases (not "accuracy" — a deterministic rule, not a trained model).
- **False-negative scenario, objectively defined:** the `oscillation` profile — designed to represent instability, scored healthy at the sampled instant. This is the one concrete false-negative case identified; no false-positive case was found in this evaluation round.
- **Consistency between computed signal and downstream content:** 10 of 13 authored predictions/incidents were consistent with the live detector; 2 flagged, 1 not comparable (`EVALUATION.md` Part 2).
- **Temporal instability coverage:** an explicitly known, unresolved limitation (`FAILURES-GUARDRAILS.md`, Failure Mode A) — not silently treated as solved.

### Business/operational metrics (future, entirely hypothetical until tested)
- Investigation time per incident.
- Time-to-context (signal appearance → operator has sufficient context to act).
- Triage duration across multiple concurrent signals.
- Escalation quality (did the right incident get escalated to the right owner).
- Proportion of incidents requiring additional, out-of-product investigation.
- Operator effort (self-reported or observed).

None of these have been measured. They are listed because defining what *would* be measured is itself part of demonstrating product judgment — a metrics plan without data is not the same as a claimed result.

## Part 5 — Value Is Conditional on Trustworthy Detection

This is the connective insight between this document and `EVALUATION.md`, and it should not be softened:

**The entire value hypothesis above depends on the product's layers agreeing with each other.** If they don't, the product doesn't just fail to help — it can actively work against its own purpose.

INC-395 is the concrete case: the incident record says **high severity, still investigating**; the corridor's live telemetry says **healthy**. An operator who trusts the "connected workflow" premise now has an extra problem the fragmented, old-fashioned workflow didn't create for them — deciding *which of the product's own two answers to believe*, on top of the original investigation. In that specific instance, **the product's own contradiction adds a step rather than removing one.**

```
Evaluation failure (oscillation / INC-395)
  → detector and incident record disagree
    → user trust risk: which signal does the operator believe?
      → potential value erosion: the product can add friction instead of removing it,
        in exactly the cases it was built to make easier
```

This is why the temporal-detection gap in `FAILURES-GUARDRAILS.md` is treated as a product priority rather than a footnote: it isn't just a detection quality issue, it's a direct threat to the value hypothesis this entire document is built on.

## Part 6 — Value Prioritization

| Value Opportunity | User Outcome | Business Relevance | Evidence Today | Priority |
|---|---|---|---|---|
| Reduced investigation friction (core hypothesis) | Fewer fragmented steps to reach context | Faster triage, better use of engineering time | Qualitative — supported by the Before→After workflow mapping in `PROBLEM.md`; not measured | **P0** |
| Faster time-to-context | Quicker "what changed / why it matters / who owns it" | Faster triage | Same as above — design-level support, no measurement | **P0** |
| Better prioritization across signals | Operator can scan/sort/filter the whole fleet at once | Better allocation of engineering attention | Real feature (sortable/filterable tables) — but evaluation shows the underlying severity data isn't always reliable (PRD-102, INC-395) | **P1** (feature exists; trust is bounded) |
| Increased decision confidence via visible evidence | Evidence is one click away, not just asserted | Fewer under/over-reactions to a signal | Design-level support (evidence tiles, timeline-to-chart linking); not measured | **P1** |
| Reduced risk of missing meaningful instability | Earlier flag of drifting corridors | Catching issues before they escalate | Partially supported (5/5 sustained-drift scenarios caught) and partially contradicted (oscillating instability missed) by `EVALUATION.md` | **P2** — gated on the temporal-scoring fix already logged in `FAILURES-GUARDRAILS.md` |

Priority is ranked by proximity to the core user problem in `PROBLEM.md`, not by which claim sounds most compelling — which is why "reduced risk of missing instability" ranks below the friction/context items despite sounding like the more dramatic claim: it's the one the evaluation has already shown the most limits on.

## Part 7 — What Is Established Publicly vs. What Is Not

**Established in the public record:**
- The prototype implements a genuinely connected detection-to-investigation workflow (link ↔ prediction ↔ incident ↔ engineer are real navigable relationships, not decorative text).
- The deterministic detector matched 5 of 5 resolvable designed drift scenarios (`EVALUATION.md`).
- The evaluation surfaced a temporal blind spot: a healthy score (~0.16) beside an active high-severity incident (INC-395).
- INC-395 demonstrates a real, user-facing consistency/credibility problem, not a hypothetical one.
- Human review remains necessary everywhere — no automated action exists in the product to fail unsafely.

**Not shown by the public record** (any results from the confidential real-world testing are not disclosed here):
- How much time, if any, a real operator would actually save using this workflow.
- Whether operators would prefer this to their existing tools.
- Whether it measurably reduces investigation effort.
- Whether it improves the quality of an operator's decisions, not just the speed.
- Whether it would reduce escalation time in practice.
- Whether any of this translates into measurable business savings.

Every item in the second list would need evidence from real users doing real tasks; none of it can be answered from the codebase or this evaluation, and no such evidence is published here.

## Part 8 — How These Hypotheses Could Be Validated

This defines a comparison; it does not report one. No user-testing results are published in this project (the confidential real-world testing is not disclosed).

**Manual-workflow condition:** give a participant a network investigation scenario using only the kind of separate tools this product is meant to replace (a telemetry view, a separate incident/ticket record, a separate roster) and observe: time to identify the affected link, the steps/screens they use, what information they go looking for and in what order, and their stated confidence in the decision they reach.

**NetSense-workflow condition:** give an equivalent scenario using this product, and observe the same measures.

**Then compare** — honestly. The outcome might show a clear improvement, no meaningful difference, or NetSense performing worse (e.g., if the connected-but-inconsistent workflow identified in Part 5 actually costs more time resolving contradictions than the fragmented baseline saves). **Whichever result comes back is the one that should drive the next product decision** — this document does not assume the answer in advance.

## Part 9 — Portfolio Statement

> NetSense's business value is currently a hypothesis, not a claimed result. The product is designed to reduce investigation friction and shorten time-to-context for network operations users by connecting a signal to its evidence, its prediction context, and its incident ownership in one workflow. Evaluation work has already shown that this value is conditional, not automatic — it depends on the detection layer being both accurate and temporally aware, and the oscillation failure behind INC-395 is treated as a product priority precisely because it shows the product can add friction instead of removing it if that condition isn't met. No user-testing results are published here (real-world testing was confidential); the metrics and comparison defined here are what such evidence would need to answer before any value claim could move from hypothesis to publicly documented evidence.

---

*No user counts, time savings, accuracy percentages, or business outcomes are claimed anywhere above — every number that appears is either a real evaluation result already recorded in `EVALUATION.md`, or explicitly labeled as a measurement that is not published here.*
