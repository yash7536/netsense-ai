"""The rule-based anomaly-to-incident workflow.

    signal  ->  severity/confidence  ->  prediction  ->  linked incident  ->  engineer context

Each stage is labelled below as **computed** (derived by a rule from the telemetry
or from other records) or **authored** (fixed demonstration content that the engine
only reads and joins). Nothing in this workflow is machine learning, and nothing
in it acts: there is no function that creates, resolves or reassigns an incident.
A human reads the assembled case and decides.

| Stage                       | Computed or authored?                                        |
|-----------------------------|--------------------------------------------------------------|
| Signal (state, score, why)  | **Computed** from telemetry by ``scoring.py``                |
| Severity / confidence       | **Authored** on each prediction/incident record              |
| Prediction record           | **Authored**; *linked* to its corridor by id                 |
| Incident record             | **Authored**; *linked* to prediction and corridor by id      |
| Engineer assignment         | **Authored**; the engine only reports context about it       |
| Display status              | **Computed**: the worse of live state and authored severity  |
| Consistency flags           | **Computed** by comparing the authored layer to the signal   |

The display-status rule is a port of ``app/src/lib/aggregate.ts``: a corridor shows
``attention`` if its live signal says so *or* if it carries an active high/critical
prediction or an open high/critical incident. That keeps the Network Links table
consistent with the Predictions and Incidents pages — and it also means an authored
severity can make a corridor look flagged when its live signal is healthy, which is
exactly the situation flagged below as ``authored_severity_without_live_signal``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .jsmath import js_round
from .scoring import ANOMALY_ATTENTION_THRESHOLD, Vitals, contributions
from .seed import Seed

SEVERE = ("high", "critical")


@dataclass
class LinkCase:
    link_id: str
    link_name: str
    profile: str
    vitals: Vitals
    predictions: list[dict] = field(default_factory=list)
    incidents: list[dict] = field(default_factory=list)
    display_status: str = "healthy"
    display_status_source: str = "none"  # live-signal | authored-severity | none
    flags: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        weighted = contributions(self.vitals)
        dominant = max(weighted, key=weighted.get) if self.vitals.raw_anomaly_score > 0 else None
        return {
            "linkId": self.link_id,
            "linkName": self.link_name,
            "profile": self.profile,
            "signal": {
                "state": self.vitals.status,
                "anomalyScore": self.vitals.anomaly_score,
                "healthScore": self.vitals.health_score,
                "threshold": ANOMALY_ATTENTION_THRESHOLD,
                "terms": self.vitals.terms,
                "contributions": weighted,
                "dominantTerm": dominant,
                "origin": "computed",
            },
            "predictions": self.predictions,
            "incidents": self.incidents,
            "displayStatus": self.display_status,
            "displayStatusSource": self.display_status_source,
            "flags": self.flags,
        }


def _prediction_view(p: dict) -> dict:
    return {
        "id": p["id"],
        "status": p["status"],
        "active": p["status"] != "monitored",
        "faultLabel": p["faultLabel"],
        "severity": p["severity"],
        "confidencePct": p["confidencePct"],
        "relatedIncidentId": p.get("relatedIncidentId"),
        "origin": "authored",
    }


def _incident_view(inc: dict, link: dict, engineers: dict[str, dict]) -> dict:
    engineer = engineers[inc["engineerId"]]
    endpoints = {link["endpoints"]["from"], link["endpoints"]["to"]}
    return {
        "id": inc["id"],
        "status": inc["status"],
        "open": inc["status"] != "resolved",
        "faultLabel": inc["faultLabel"],
        "severity": inc["severity"],
        "originatingPredictionId": inc.get("originatingPredictionId"),
        "origin": "authored",
        "engineerContext": {
            # The assignment itself is authored. These are facts *about* it, not a recommendation.
            "engineerId": engineer["id"],
            "name": engineer["name"],
            "dutyStatus": engineer["status"],
            "city": engineer["city"],
            "specialisation": engineer["specialisation"],
            "cityIsLinkEndpoint": engineer["city"] in endpoints,
        },
    }


def build_link_cases(seed: Seed, vitals_by_link: dict[str, Vitals], profiles: dict[str, str]) -> list[LinkCase]:
    engineers = {e["id"]: e for e in seed.engineers}
    cases: list[LinkCase] = []
    for link in seed.links:
        vitals = vitals_by_link[link["id"]]
        predictions = [_prediction_view(p) for p in seed.predictions if p["linkId"] == link["id"]]
        incidents = [_incident_view(i, link, engineers) for i in seed.incidents if i["linkId"] == link["id"]]

        active_predictions = [p for p in predictions if p["active"]]
        open_incidents = [i for i in incidents if i["open"]]
        has_severe_record = any(p["severity"] in SEVERE for p in active_predictions) or any(
            i["severity"] in SEVERE for i in open_incidents
        )

        if vitals.status == "attention":
            display_status, source = "attention", "live-signal"
        elif has_severe_record:
            display_status, source = "attention", "authored-severity"
        else:
            display_status, source = "healthy", "none"

        flags: list[str] = []
        if vitals.status == "healthy" and has_severe_record:
            flags.append("authored_severity_without_live_signal")
        if vitals.status == "attention" and not active_predictions and not open_incidents:
            flags.append("live_signal_without_linked_record")

        cases.append(
            LinkCase(
                link_id=link["id"],
                link_name=link["name"],
                profile=profiles[link["id"]],
                vitals=vitals,
                predictions=predictions,
                incidents=incidents,
                display_status=display_status,
                display_status_source=source,
                flags=flags,
            )
        )
    return cases


def overview(seed: Seed, cases: list[LinkCase]) -> dict:
    """Fleet-level figures shown on the Overview screen (port of ``overviewStats``)."""
    total = 0
    for c in cases:
        total += c.vitals.health_score
    return {
        "networkBaselinePct": js_round(total / len(cases) * 10) / 10,
        "activeSignals": len(seed.predictions),
        "openIncidents": sum(1 for i in seed.incidents if i["status"] != "resolved"),
        "corridorsFlagged": sum(1 for c in cases if c.display_status == "attention"),
        "corridorsTotal": len(cases),
    }
