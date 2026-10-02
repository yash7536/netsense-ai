import copy
from dataclasses import replace

from netsense.seed import load_seed, validate_seed


def case(run, link_id):
    return next(c for c in run.cases if c.link_id == link_id)


# ---- workflow ----------------------------------------------------------------------------------


def test_overview_figures_match_what_the_app_shows(run):
    assert run.overview == {
        "networkBaselinePct": 91.4,
        "activeSignals": 7,
        "openIncidents": 5,
        "corridorsFlagged": 4,
        "corridorsTotal": 6,
    }


def test_display_status_is_the_worse_of_live_state_and_authored_severity(run):
    # attention because the live signal says so
    assert (case(run, "mumbai-delhi-core").display_status, case(run, "mumbai-delhi-core").display_status_source) == (
        "attention",
        "live-signal",
    )
    # healthy live signal, but an open high-severity incident elevates the display status
    hyd = case(run, "bengaluru-hyderabad-core")
    assert hyd.vitals.status == "healthy"
    assert (hyd.display_status, hyd.display_status_source) == ("attention", "authored-severity")
    assert hyd.flags == ["authored_severity_without_live_signal"]


def test_only_the_hyderabad_corridor_is_flagged_for_authored_severity_without_a_live_signal(run):
    flagged = {c.link_id for c in run.cases if "authored_severity_without_live_signal" in c.flags}
    assert flagged == {"bengaluru-hyderabad-core"}


def test_every_signal_is_labelled_computed_and_every_record_authored(run):
    for c in run.cases:
        j = c.to_json()
        assert j["signal"]["origin"] == "computed"
        assert all(p["origin"] == "authored" for p in j["predictions"])
        assert all(i["origin"] == "authored" for i in j["incidents"])


def test_engineer_assignment_is_reported_as_context_not_decided(run):
    for c in run.cases:
        for inc in c.incidents:
            ctx = inc["engineerContext"]
            assert set(ctx) == {"engineerId", "name", "dutyStatus", "city", "specialisation", "cityIsLinkEndpoint"}
    assert case(run, "mumbai-delhi-core").incidents[0]["engineerContext"]["name"] == "A. Sharma"


def test_signal_evidence_names_the_dominant_term(run):
    sat = case(run, "delhi-bengaluru-core").to_json()["signal"]
    assert sat["dominantTerm"] in sat["contributions"]
    assert sat["contributions"][sat["dominantTerm"]] == max(sat["contributions"].values())
    assert case(run, "bengaluru-chennai-core").to_json()["signal"]["dominantTerm"] is None  # nothing deviates


def test_engine_has_no_function_that_acts():
    """The workflow reads and joins records; nothing creates, resolves, assigns or remediates."""
    import netsense

    import pkgutil
    import importlib

    verbs = ("create", "resolve", "assign", "remediate", "escalate", "close_incident", "open_incident")
    for mod in pkgutil.iter_modules(netsense.__path__):
        m = importlib.import_module(f"netsense.{mod.name}")
        for name in dir(m):
            if name.startswith("_") or not callable(getattr(m, name)):
                continue
            assert not any(v in name.lower() for v in verbs), f"{mod.name}.{name} looks like an action"


# ---- seed validation ---------------------------------------------------------------------------


def test_the_authored_seed_is_valid_and_its_known_asymmetries_are_reported_as_notes():
    errors, notes = validate_seed(load_seed())
    assert errors == []
    assert "INC-391 has no originating prediction" in notes
    assert any("PRD-103" in n and "INC-388" in n for n in notes)
    assert any("PRD-101" in n and "INC-385" in n for n in notes)


def test_broken_references_are_errors():
    seed = load_seed()
    bad = copy.deepcopy(seed.incidents)
    bad[0]["engineerId"] = "nobody"
    bad[1]["linkId"] = "no-such-link"
    errors, _ = validate_seed(replace(seed, incidents=bad))
    assert any("unknown engineer nobody" in e for e in errors)
    assert any("unknown link no-such-link" in e for e in errors)


def test_prediction_and_incident_must_agree_about_their_link():
    seed = load_seed()
    preds = copy.deepcopy(seed.predictions)
    next(p for p in preds if p["id"] == "PRD-104")["linkId"] = "chennai-pune-core"
    errors, _ = validate_seed(replace(seed, predictions=preds))
    assert any("different link" in e for e in errors)


def test_duplicate_ids_are_errors():
    seed = load_seed()
    dup = seed.engineers + [copy.deepcopy(seed.engineers[0])]
    errors, _ = validate_seed(replace(seed, engineers=dup))
    assert any("duplicate ids" in e for e in errors)
