"""The authored seed data and its integrity checks.

``engine/seed/*.json`` holds the **authored demonstration content**: link metadata
and baselines, predictions, incidents and engineers. This is deliberately *not*
generated — prediction severity/confidence/fault labels, incident narratives and
engineer assignments are written by hand to represent what a rule engine might
surface. The engine validates that this content is internally well-formed and
joins it to the computed signal; it never presents it as model output.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .profiles import LINK_PROFILES

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"
COLLECTIONS = ("links", "predictions", "incidents", "engineers")


@dataclass(frozen=True)
class Seed:
    links: list[dict]
    predictions: list[dict]
    incidents: list[dict]
    engineers: list[dict]

    def link(self, link_id: str) -> dict:
        return next(link for link in self.links if link["id"] == link_id)


def load_seed(seed_dir: Path | None = None) -> Seed:
    base = seed_dir or SEED_DIR
    data = {name: json.loads((base / f"{name}.json").read_text(encoding="utf-8")) for name in COLLECTIONS}
    return Seed(**data)


def validate_seed(seed: Seed) -> tuple[list[str], list[str]]:
    """Return ``(errors, notes)``.

    *Errors* are broken references (an id that points at nothing, or a pair of
    records that disagree about which link they belong to). *Notes* are
    asymmetries in the authored cross-references that are not wrong, but that a
    reader relying on "every prediction links forward to its incident" should know about.
    """
    errors: list[str] = []
    notes: list[str] = []

    for name in COLLECTIONS:
        ids = [r["id"] for r in getattr(seed, name)]
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            errors.append(f"{name}: duplicate ids {sorted(dupes)}")

    links = {r["id"]: r for r in seed.links}
    predictions = {r["id"]: r for r in seed.predictions}
    incidents = {r["id"]: r for r in seed.incidents}
    engineers = {r["id"]: r for r in seed.engineers}

    for link_id in links:
        if link_id not in LINK_PROFILES:
            errors.append(f"link {link_id}: no designed drift profile assigned")
    for link_id in LINK_PROFILES:
        if link_id not in links:
            errors.append(f"profile assignment refers to unknown link {link_id}")

    for p in seed.predictions:
        if p["linkId"] not in links:
            errors.append(f"prediction {p['id']}: unknown link {p['linkId']}")
        rel = p.get("relatedIncidentId")
        if rel:
            if rel not in incidents:
                errors.append(f"prediction {p['id']}: related incident {rel} does not exist")
            elif incidents[rel]["linkId"] != p["linkId"]:
                errors.append(f"prediction {p['id']}: related incident {rel} is on a different link")

    for i in seed.incidents:
        if i["linkId"] not in links:
            errors.append(f"incident {i['id']}: unknown link {i['linkId']}")
        if i["engineerId"] not in engineers:
            errors.append(f"incident {i['id']}: unknown engineer {i['engineerId']}")
        orig = i.get("originatingPredictionId")
        if orig:
            if orig not in predictions:
                errors.append(f"incident {i['id']}: originating prediction {orig} does not exist")
            elif predictions[orig]["linkId"] != i["linkId"]:
                errors.append(f"incident {i['id']}: originating prediction {orig} is on a different link")
            elif predictions[orig].get("relatedIncidentId") != i["id"]:
                notes.append(
                    f"{orig} is named as the originating prediction of {i['id']}, "
                    f"but {orig} has no forward link to {i['id']}"
                )
        else:
            notes.append(f"{i['id']} has no originating prediction")

    for e in seed.engineers:
        if e.get("assignedLinkId") and e["assignedLinkId"] not in links:
            errors.append(f"engineer {e['id']}: unknown assigned link {e['assignedLinkId']}")
        inc_id = e.get("assignedIncidentId")
        if inc_id:
            if inc_id not in incidents:
                errors.append(f"engineer {e['id']}: assigned incident {inc_id} does not exist")
            elif incidents[inc_id]["engineerId"] != e["id"]:
                errors.append(f"engineer {e['id']}: assigned {inc_id}, but that incident names a different engineer")

    return errors, sorted(set(notes))
