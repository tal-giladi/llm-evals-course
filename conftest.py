"""Pytest configuration for the course labs.

Two jobs:

1. Put the package on the import path, so ``py -m pytest`` works from the
   repository root with nothing installed.
2. Replace pytest's built-in ``tmp_path`` with a version that creates its
   directory in a place we can actually write.

The second one is not paranoia. Pytest's ``--basetemp`` deletes and
recreates its root on every run, and on some filesystems — a synced folder,
a sandbox, a locked-down CI image — the recreated directory comes back with
an ACL that immediately denies access. The symptom is a ``PermissionError``
inside a fixture, which reads as "your lab is broken" when nothing is wrong
with it.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent
# Only the package goes on the path here. Do NOT add starter/ or solution/:
# pytest already inserts each test file's own directory at the front, and
# adding them explicitly makes the starter's modules shadow the solution's,
# so the solution tests would silently import the unimplemented code.
for p in (REPO / "labs" / "common",):
    if p.is_dir() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

_SCRATCH = REPO / "build" / "lab-scratch"


def pytest_configure(config):
    _SCRATCH.mkdir(parents=True, exist_ok=True)


def pytest_unconfigure(config):
    shutil.rmtree(_SCRATCH, ignore_errors=True)


@pytest.fixture
def tmp_path(request, monkeypatch):
    """A fresh, writable directory per test.

    Named after the test, so a failure leaves a directory you can look in.
    """
    from uuid import uuid4
    path = _SCRATCH / f"{request.node.name[:40]}-{uuid4().hex[:8]}"
    path.mkdir(parents=True, exist_ok=True)
    yield path
    shutil.rmtree(path, ignore_errors=True)


