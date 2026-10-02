from pathlib import Path

import pytest

from netsense.pipeline import run_engine

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def run():
    return run_engine()
