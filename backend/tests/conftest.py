import sys
import os
import pytest

# Ensure project root is in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from database.seed.seed_data import seed_database

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Seeds a fresh test database with deterministic data before testing."""
    seed_database()
