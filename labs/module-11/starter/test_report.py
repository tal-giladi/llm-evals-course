"""Lab 1 — the specification.

These four tests are what "done" means. They do not check your formatting,
they check that the report answers the questions a gate has to answer.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from report import build_report, summarise

sys.path.insert(0, str(Path(__file__).parent))


@pytest.fixture(scope="module")
def report():
    return build_report()


def test_report_has_the_headline_numbers(report):
    assert report["n"] == 57, "the dev split is 57 items"
    assert 0.0 <= report["pass_rate"] <= 1.0
    lo, hi = report["pass_ci"]
    assert lo <= report["pass_rate"] <= hi, "the interval has to contain the point estimate"


def test_report_states_agreement_with_a_sample_size(report):
    """Lesson 6.2. A rate without n next to it is not a measurement."""
    a = report["agreement"]
    for key in ("tpr", "tnr", "kappa", "n"):
        assert key in a, f"agreement is missing {key}"
    assert a["n"] == report["n"]


def test_report_lists_disagreements_grouped_by_category(report):
    """Lesson 6.3. The number says the judge is off; the list says how."""
    d = report["disagreements"]
    assert len(d) == sum(report["disagreements_by_category"].values())
    assert d, "the plain judge disagrees with the humans on plenty of items"
    for row in d:
        assert row["human"] != row["judge"], "a disagreement where both agree is not one"
        assert row["category"]


def test_report_names_the_slices_it_cannot_measure(report):
    """Lesson 4.3, in production form.

    This is the test that matters. A slice with no failing items contributes
    nothing to the true-negative rate, so the judge looks better than it is on
    exactly the population you care about. A report that omits those slices is
    not a shorter report — it is a misleading one.
    """
    assert "unmeasurable_slices" in report
    assert isinstance(report["unmeasurable_slices"], list)
    # The plain judge on the dev split genuinely has such slices; if your run
    # reports none, you are reporting the slices that *have* failures.
    assert report["unmeasurable_slices"] == sorted(report["unmeasurable_slices"])


def test_summary_is_two_lines_and_names_the_judge(report):
    s = summarise(report)
    lines = [ln for ln in s.splitlines() if ln.strip()]
    assert 1 <= len(lines) <= 2, f"the summary is {len(lines)} lines; it is for a PR comment"
    assert report["judge"].split("·")[0].strip()[:12] in s or str(report["n"]) in s


def test_cli_writes_a_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    # The child needs evallab on its path, exactly as a learner would set up.
    env = dict(os.environ)
    env["PYTHONPATH"] = str(Path(__file__).parents[2] / "common")
    rc = subprocess.call([sys.executable, str(Path(__file__).parent / "report.py")],
                         stdout=subprocess.DEVNULL, env=env)
    assert rc == 0
    written = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))
    assert written["n"] == 57

