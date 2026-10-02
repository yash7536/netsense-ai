# NetSense AI — Real User Problem & Before → After

This document exists to answer two of the non-negotiable questions a product like this has to answer before anything else: **who has this problem, and what actually changes for them.** It's written as product thinking, not a feature list — see [README.md](../README.md) for what's built and [EVALUATION.md](EVALUATION.md) for whether the detection layer is any good.

## Who is the user?

The primary user is a **network operations (NOC) operator or network operations engineer** — someone responsible for the health of a set of network links or corridors, typically as part of a larger operations team. Without inventing a specific employer or internal workflow, that role generally involves:

- Monitoring multiple network links for abnormal behavior.
- Noticing when a metric (latency, packet loss, jitter, bandwidth) drifts from what's normal for that link.
- Investigating whether a drifting metric is a real, actionable problem or noise.
- Understanding what evidence supports treating something as a genuine signal.
- Deciding whether a signal warrants opening or escalating an incident.
- Determining who should own the investigation, and tracking it through to resolution.
- Prioritizing across many links and signals at once — not everything can be investigated first.

## What is their pain?

The pain here is **not** "there's too much data." It's that **going from "something changed" to "I know what it is, why it matters, and who owns it" takes too many steps and too many separate views** — telemetry dashboards, monitoring alerts, incident/ticketing records, and whatever context lives in someone's head or a chat thread, none of which are inherently connected to each other.

Concretely, an operator working this way has to answer several questions before they can act with any confidence, and today those answers usually live in different places:

- *What is going wrong?* — a metric or alert.
- *Which link does it affect, and how serious does it actually look?* — requires comparing several metrics against what's normal for that specific link.
- *What evidence supports this being real?* — requires pulling up the underlying telemetry, not just the alert.
- *Is there already an incident for this, or does one need to be opened?* — a separate lookup, often in a separate system.
- *Who is or should be investigating it?* — ownership/assignment context that may not be attached to the telemetry at all.

The cost of this fragmentation isn't just time — it's **decision confidence**. An operator can end up acting on a metric without its supporting evidence, or delaying a decision because assembling the full picture takes too long. This prototype is aimed specifically at that gap: not "more monitoring," but faster, more evidence-backed *investigation and decision-making* once something has already been flagged.

## Product Problem Statement

> Network operations engineers responsible for monitoring live corridors need to quickly understand *what* changed, *why it matters*, and *who should act*, whenever a link's telemetry drifts from baseline. Today, that understanding is assembled by hand across separate monitoring, alerting, and ticketing views, which slows down both investigation and prioritization. Solving this matters because the operator's actual job isn't watching dashboards — it's making a fast, well-evidenced decision about what to do next, and fragmented context works directly against that.

No claim is made here about the cost of network outages in general — that would need a verified source this project doesn't have. The problem is framed around decision-making friction, which is directly observable from the workflow itself, not a dollar figure.

## Product Hypothesis

> **Product hypothesis (not publicly validated — real-world testing was done in a confidential setting whose data, findings and feedback cannot be disclosed, so this document claims no measured result):** If we help network operations users notice abnormal link behavior early, and bring the relevant evidence, predictive signal, and incident context into one connected workflow, then we can reduce investigation friction and shorten time-to-context during network fault triage — i.e., how quickly and confidently an operator can go from "something changed" to "here's what it is, here's the evidence, here's who owns it."

This is a hypothesis the product's design is built around, not a result. Section "Why This Must Be Evaluated" below explains why connecting information together doesn't automatically make it trustworthy — and why that has to be checked, not assumed.

## Before → After

### Before — a typical fragmented workflow

The steps below describe **a workflow hypothesis informed by general exposure to network fault-management problems during an internship — not a measured reconstruction of any specific employer's internal process**, and not a claim that any named organization's engineers work exactly this way.

In a typical network operations workflow, an operator might:

1. Monitor telemetry and alerts, often across more than one dashboard or tool.
2. Notice an abnormal metric or alert on a specific link.
3. Pull up that link's telemetry to investigate further.
4. Manually compare several metrics (latency, loss, jitter, bandwidth) against what's normal for that link to judge whether the signal looks meaningful.
5. Decide whether it's worth opening — or already covered by — an incident.
6. Look up or create the corresponding incident record, frequently in a separate ticketing system from the telemetry itself.
7. Determine or confirm who is investigating it, which may require a separate roster or escalation step.
8. Continue monitoring and cross-referencing telemetry against the incident as investigation proceeds.

### After — with NetSense

The same workflow, mapped to what the current prototype actually does — no step here claims an action the product doesn't really perform:

1. Open the Overview screen and see fleet-wide health and flagged corridors in one place.
2. Identify a corridor showing abnormal behavior (via Overview's corridor selector or the Network Links table's sortable health/latency/loss/load/jitter columns).
3. Open that link's detail page and inspect its live anomaly evidence — the telemetry chart, plus evidence tiles that emphasize the specific metric (latency, loss, jitter, bandwidth) behind the reading.
4. Review every prediction tied to that link, including its severity, confidence, and narrative.
5. Follow the link from a prediction to the incident it produced (if any) — a real, clickable relationship, not separate lookups in separate tools.
6. Review the incident's timeline and evidence, where selecting a timeline entry moves the telemetry chart's crosshair to that exact moment.
7. See who is assigned to the incident directly, with a real link to their profile — not a separate roster lookup.
8. **The operator decides what happens next.** Nothing above is an automated action — no incident is auto-created, no severity is auto-assigned, no remediation is triggered by the product itself.

### Before → After Table

| Workflow Stage | Before | With NetSense | Product Value |
|---|---|---|---|
| Detection | Notice a metric or alert, separately from any context about why it matters | See a corridor already flagged, with its live health/anomaly reading attached | Drift is surfaced attached to context, not as a bare number |
| Context gathering | Pull telemetry from one tool, ticket history from another | Telemetry, predictions, and incidents live on the same connected set of screens | Fewer tool switches to assemble the same picture |
| Evidence | Manually compare several raw metrics to judge significance | Evidence tiles and charts tied directly to the specific signal being reviewed | Evidence is one click from the claim, not a separate investigation |
| Prioritization | Judge severity metric-by-metric, link-by-link, by hand | Sortable/filterable tables across links, predictions, incidents, and engineers | Faster comparison across many signals at once |
| Incident investigation | Find or open a ticket in a separate system | Incident is already linked from its originating prediction, with timeline tied to telemetry | Investigation starts from context already assembled, not from zero |
| Human decision-making | Decision made after manually reassembling context | Decision made after reviewing evidence, prediction, and incident together | Same decision-maker, faster and better-informed starting point |

No numeric time savings are claimed anywhere in this table — none have been measured.

## The Product Transformation

The point of this product is not "a dashboard that shows network data." That undersells what's actually being attempted, and oversells what a dashboard alone would do.

The real transformation is:

> **From fragmented monitoring and investigation, toward a connected detection-to-investigation workflow — where the abnormal signal, its evidence, and its incident context can be reviewed together, before a human makes a decision.**

That's the product insight this prototype is built to test, and every screen in it exists to support one of the links in that chain (telemetry → evidence → prediction → incident → engineer → human decision), not to add a new destination screen.

## Why This Must Be Evaluated, Not Assumed

Connecting information together is only valuable if the information stays trustworthy and logically coherent once it's connected — a fast path to a wrong or contradictory conclusion isn't actually progress.

[EVALUATION.md](EVALUATION.md) tests exactly that. The rule-based detector matched the expected state in 5 of 5 resolvable designed scenarios, but it also surfaced a **temporal blind spot**: a healthy score (~0.16) beside an active high-severity incident (INC-395, Bengaluru–Hyderabad Core). In the "After" workflow above, the evidence step and the incident step would show a healthy corridor directly beside an active, high-severity incident — exactly the kind of contradiction that undermines the "review it together" promise this product is meant to deliver.

That failure is not fixed here. It's the reason the Before → After story above is a hypothesis about what *could* reduce friction, not a claim that it already reliably does — and it's why an evaluation layer has to exist alongside the product, not be assumed away.

## Domain Context

**Domain context:** The problem and workflow described above were informed by exposure to network fault-management workflows during a Product Management internship at Tata Teleservices Ltd. The public NetSense prototype uses synthetic telemetry and demonstration data throughout — proprietary company data and internal operational details are not disclosed or reproduced anywhere in this project. Nothing in this prototype processes, references, or is derived from Tata Teleservices production data, infrastructure, or customers.

Real-world testing of the prototype was done in a confidential network-operations setting with company data. The underlying data, organization-specific findings and detailed feedback are confidential and are not reproduced here; the public case study and this repository use synthetic/demo telemetry only. Nothing in this project reports participant numbers, quotes, company data, accuracy, MTTR, productivity, business outcomes or a production deployment.
