"""Shared pytest configuration for the module 11 labs.

Puts the starter and the package on the path so a learner can run
``py -m pytest labs/module-11/starter`` from the repo root without
installing anything.
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]          # the course root
COMMON = REPO / "labs" / "common"

for p in (COMMON, HERE / "starter"):
    if p.is_dir() and str(p) not in sys.path:
        sys.path.insert(0, str(p))
