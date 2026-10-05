from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures() -> Path:
    """Folder with the real sample files (report, ClaimForm, invoice, saved claim page)."""
    return FIXTURES


@pytest.fixture
def app_home(tmp_path, monkeypatch) -> Path:
    """Point the app at an empty temporary folder so tests never touch the real data folder."""
    monkeypatch.setenv("AUTO_SPIFFER_HOME", str(tmp_path))
    return tmp_path
