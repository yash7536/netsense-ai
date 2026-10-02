"""docs/EVALUATION.md must report exactly what the committed results say — no hand-edited numbers."""

import json

import pytest

RESULT_LABEL = {"consistent": "consistent", "review": "**review**", "not-comparable": "not comparable"}


@pytest.fixture(scope="module")
def doc(repo_root):
    return (repo_root / "docs" / "EVALUATION.md").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def results(repo_root):
    base = repo_root / "docs" / "results"
    return (
        json.loads((base / "drift_profile_eval.json").read_text(encoding="utf-8")),
        json.loads((base / "consistency_audit.json").read_text(encoding="utf-8")),
    )


def _table_rows(doc: str, first_cell_ok) -> list[list[str]]:
    rows = []
    for line in doc.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if line.startswith("|") and first_cell_ok(cells[0]):
            rows.append(cells)
    return rows


def test_drift_table_matches_results(doc, results):
    drift, _ = results
    rows = _table_rows(doc, lambda c: c.startswith("`") and c.endswith("`"))
    assert len(rows) == 6
    for cells, r in zip(rows, drift["rows"]):
        assert cells[0] == f"`{r['profile']}`" and cells[1] == r["linkName"]
        assert cells[3] == f"{r['anomalyScore']:.2f}" and cells[4] == f"{r['healthScore']:.1f}"
        assert cells[5] == r["state"]


def test_audit_table_matches_results(doc, results):
    _, audit = results
    rows = _table_rows(doc, lambda c: c[:4] in ("PRD-", "INC-"))
    assert len(rows) == 13
    for cells, r in zip(rows, audit["rows"]):
        assert cells[0] == r["record"] and cells[2] == r["linkName"]
        assert cells[3] == f"{r['liveAnomalyScore']:.2f}" and cells[4] == r["liveState"]
        assert cells[5] == r["authoredSeverity"] and cells[6] == r["authoredStatus"]
        assert cells[7] == RESULT_LABEL[r["result"]]


def test_headline_numbers_match_results(doc, results):
    drift, audit = results
    s, a = drift["summary"], audit["summary"]
    assert f"**{s['agreement']}** resolvable profiles matched" in doc
    assert f"**{a['consistent']}** consistent, **{a['review']}** flagged, **{a['notComparable']}** not comparable" in doc
    diag = next(r for r in drift["rows"] if r["profile"] == "oscillation")["diagnostic"]
    assert f"**{diag['flaggedSamples']}/{diag['samples']}**" in doc
    assert str(diag["maxSingleSampleScoreUnrounded"]) in doc


def test_doc_states_what_it_is_not(doc):
    for phrase in ("not a trained model", "Not** model accuracy", "not built", "synthetic"):
        assert phrase in doc
    assert "rolling-window" in doc.lower()
