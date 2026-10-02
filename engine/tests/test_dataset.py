"""The app consumes committed generated data; it must never drift from what the engine produces."""

import json

from netsense.dataset import app_files, check_app_data
from netsense.evaluation import build_results


def test_committed_app_data_is_exactly_what_the_engine_generates(run):
    assert check_app_data(run) == []


def test_committed_results_are_exactly_what_the_engine_produces(run, repo_root):
    for name, payload in build_results(run).items():
        committed = json.loads((repo_root / "docs" / "results" / name).read_text(encoding="utf-8"))
        assert committed == payload, f"docs/results/{name} is stale; run `python -m netsense evaluate`"


def test_generated_telemetry_has_121_samples_for_each_of_the_six_links(run, repo_root):
    telemetry = json.loads((repo_root / "app" / "src" / "data" / "generated" / "telemetry.json").read_text(encoding="utf-8"))
    assert len(telemetry) == 6
    assert all(len(points) == 121 for points in telemetry.values())
    assert all(points[0]["t"] == -48 and points[-1]["t"] == 12 for points in telemetry.values())


def test_seed_content_reaches_the_app_unchanged(run, repo_root):
    gen = repo_root / "app" / "src" / "data" / "generated"
    for name in ("links", "predictions", "incidents", "engineers"):
        seed = json.loads((repo_root / "engine" / "seed" / f"{name}.json").read_text(encoding="utf-8"))
        assert json.loads((gen / f"{name}.json").read_text(encoding="utf-8")) == seed


def test_generated_readme_says_do_not_edit(run):
    assert "do not edit by hand" in app_files(run)["README.md"].lower()


def test_check_detects_drift(run, tmp_path):
    from netsense.dataset import write_app_data

    write_app_data(run, tmp_path)
    assert check_app_data(run, tmp_path) == []
    (tmp_path / "links.json").write_text("[]", encoding="utf-8")
    assert check_app_data(run, tmp_path) == ["links.json: differs from what the engine generates"]
    (tmp_path / "telemetry.json").unlink()
    assert "telemetry.json: missing" in check_app_data(run, tmp_path)
