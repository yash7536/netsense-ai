"""The pre-registered spec (docs/PROFILE_SPEC.md) and the code (profiles.py) must never disagree."""

import re

from netsense.profiles import LINK_PROFILES, PROFILE_BY_NAME, PROFILE_SPECS, resolvable_specs


def _spec_rows(repo_root):
    text = (repo_root / "docs" / "PROFILE_SPEC.md").read_text(encoding="utf-8")
    rows = []
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 7 and cells[0].startswith("`") and cells[0].endswith("`"):
            rows.append(
                {
                    "profile": cells[0].strip("`"),
                    "link": cells[1],
                    "expected": cells[4].replace("*", "").strip(),
                    "resolvable": cells[5].replace("*", "").strip(),
                }
            )
    return text, rows


def test_spec_table_matches_the_code(repo_root, run):
    _, rows = _spec_rows(repo_root)
    assert [r["profile"] for r in rows] == [s.profile for s in PROFILE_SPECS]
    link_names = {link["id"]: link["name"] for link in run.seed.links}
    for r in rows:
        spec = PROFILE_BY_NAME[r["profile"]]
        assert r["link"] == link_names[spec.link_id]
        assert r["resolvable"] == ("yes" if spec.resolvable else "no")
        assert r["expected"] == (spec.expected_state or "none asserted")


def test_spec_counts_are_the_pre_registered_ones(repo_root):
    text, _ = _spec_rows(repo_root)
    assert "**6 profiles, 5 resolvable, 1 unresolvable.**" in text
    assert len(PROFILE_SPECS) == 6 and len(resolvable_specs()) == 5


def test_only_the_oscillation_profile_is_unresolvable():
    assert [s.profile for s in PROFILE_SPECS if not s.resolvable] == ["oscillation"]
    assert PROFILE_BY_NAME["oscillation"].expected_state is None
    assert LINK_PROFILES["bengaluru-hyderabad-core"] == "oscillation"


def test_expectations_for_resolvable_profiles_are_stated_before_results():
    assert {s.profile: s.expected_state for s in resolvable_specs()} == {
        "stable": "healthy",
        "recovering": "healthy",
        "bifurcation": "attention",
        "loss-degradation": "attention",
        "saturation": "attention",
    }


def test_spec_documents_that_evidence_layers_are_not_merged(repo_root):
    text, _ = _spec_rows(repo_root)
    assert re.search(r"never added together", text)
