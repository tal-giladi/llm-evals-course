"""Lab 2 — the specification.

A regression suite that costs more than the product it protects does not get
optimised; it gets switched off, and a gate that is not there looks exactly
like a gate that is fine. Two things keep it alive: a cache keyed on all nine
components of lesson 5.3, and a ceiling the run is not allowed to go past.

Every field in the key gets changed one at a time and the key has to move
every time. A key that ignores a field reuses a verdict across exactly the
change you were trying to measure.
"""

from __future__ import annotations

import json

import pytest

from cost_lab import (
    DEFAULT_MAX_CALLS, JudgeCache, RunConfig, Suite, cost_per_call,
)
from evallab import Budget, cache_key, load

PRICE = 0.03794        # the recorded price of one c-rubric-3b verdict
ITEMS = 94
REPEATS = 3
CALLS = ITEMS * REPEATS       # 282


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture
def cfg():
    return RunConfig()


@pytest.fixture
def cache(tmp_path):
    return JudgeCache(tmp_path / "judge-cache.json")


@pytest.fixture
def suite(data, cfg, cache):
    return Suite(data=data, cfg=cfg, cache=cache)


# --------------------------------------------------------------------------
# 1. The run pays for itself the second time
# --------------------------------------------------------------------------


def test_a_first_run_pays_for_every_verdict(suite, cfg):
    """94 items, 3 repeats, 282 calls. This is the bill the gate runs on every
    pull request until the cache is doing its job."""
    report = suite.run()
    assert report.calls == CALLS == 282
    assert report.misses == CALLS
    assert report.hits == 0
    assert report.usd == pytest.approx(CALLS * PRICE)
    assert report.ok and report.exit_code == 0
    assert len(report.verdicts) == ITEMS


def test_the_second_run_of_the_same_suite_costs_nothing(data, cfg, cache):
    """The whole cost lever, in one line.

    Nothing about the judge changed, so every key matches and the run is a
    lookup. A suite keyed on all nine components can be re-run every night for
    the price of reading a file.
    """
    first = Suite(data=data, cfg=cfg, cache=cache).run()
    second = Suite(data=data, cfg=cfg, cache=cache).run()
    assert first.calls == CALLS
    assert second.calls == 0
    assert second.hits == CALLS
    assert second.usd == 0.0
    assert second.verdicts == first.verdicts, "the same suite, the same verdicts"
    assert second.hit_rate == 1.0, "a warm run should read as a pure lookup"


# --------------------------------------------------------------------------
# 2. The key
# --------------------------------------------------------------------------


def test_one_character_of_the_rubric_misses_every_key(data, cfg, cache):
    """Lesson 5.3, and the answer to "why not just cache on the item id".

    Not "most of them". All of them. The rubric is in every key, so a rubric
    edit is a different judge, and a verdict from the old one is not a result
    about the new one.
    """
    Suite(data=data, cfg=cfg, cache=cache).run()
    edited = RunConfig(prompt_hash=cfg.prompt_hash[:-1] + "d")
    report = Suite(data=data, cfg=edited, cache=cache).run()
    assert report.misses == CALLS
    assert report.calls == CALLS


@pytest.mark.parametrize("field,value", [
    ("model_build", "qwen3-1.7b-q8_0"),
    ("prompt_hash", "grade-the-answer-against-these-rules-9f2d"),
    ("fewshot", "s01,s02"),
    ("answer_order", "BA"),
    ("decoding", "temperature=0.7"),
])
def test_every_component_of_the_key_moves_it(cache, cfg, data, field, value):
    """One field at a time, and the key has to move every time.

    A key that ignores a field reuses a verdict across exactly the change you
    were trying to measure — and the numbers it produces are plausible,
    reproducible and wrong.
    """
    item = data.items[0]
    Suite(data=data, cfg=cfg, cache=cache).run(n=1)
    other = RunConfig(**{**cfg.parts(), **{field: value}})
    assert cache.get(item, other, 0) is None, \
        f"changing {field} must not reuse a verdict"


def test_the_variant_and_the_judge_are_in_the_key_too(cache, cfg, data):
    item = data.items[0]
    Suite(data=data, cfg=cfg, cache=cache).run(n=1)
    assert cache.get(item, RunConfig(variant="v2"), 0) is None
    assert cache.get(item, RunConfig(judge_id="c-plain-3b"), 0) is None


def test_each_repeat_is_its_own_key(cache, cfg, data):
    """The three samples of one question are three calls, and they are three
    different verdicts. A cache that collapsed them would be reporting one
    answer three times and calling it a majority."""
    item = data.items[0]
    Suite(data=data, cfg=cfg, cache=cache).run(n=1)
    assert cache.get(item, cfg, 0) is not None
    assert cache.get(item, cfg, 1) is not None
    assert cache.get(item, cfg, 2) is not None
    assert cache.get(item, cfg, 3) is None


def test_the_key_is_the_lesson_5_3_key(cache, cfg, data):
    """Once it is right, the lab and the package must agree — or CI caches for
    two different things under one name."""
    item = data.items[0]
    assert cache.key(item, cfg, 0) == cache_key(
        item=item, variant=cfg.variant, judge_id=cfg.judge_id,
        model_build=cfg.model_build, prompt_hash=cfg.prompt_hash,
        fewshot=cfg.fewshot, answer_order=cfg.answer_order,
        decoding=cfg.decoding, sample_index=0)


def test_the_cache_survives_a_save_and_a_reload(tmp_path, cfg, data):
    """This is the round trip ``actions/cache`` performs between two runs. If
    it does not work, the restore in the workflow restores nothing."""
    a = JudgeCache(tmp_path / "c.json")
    Suite(data=data, cfg=cfg, cache=a).run()
    a.save()
    assert (tmp_path / "c.json").exists()

    b = JudgeCache(tmp_path / "c.json")
    report = Suite(data=data, cfg=cfg, cache=b).run()
    assert report.calls == 0 and report.hits == CALLS


def test_a_cache_that_always_hits_is_a_cache_whose_key_is_too_loose(cache, cfg, data):
    """Hit rate is worth logging, because it is the only place a loose key shows
    up. 100% hit rate on a suite whose judge you changed last week is not a
    success story."""
    Suite(data=data, cfg=cfg, cache=cache).run()
    loose = RunConfig(model_build="qwen3-1.7b-q8_0")
    Suite(data=data, cfg=loose, cache=cache).run()
    assert cache.hit_rate < 1.0, "a changed model build is a different judge"


# --------------------------------------------------------------------------
# 3. The ceiling
# --------------------------------------------------------------------------


def test_a_budget_stops_the_run_before_it_overspends(suite):
    """The refusal has to happen *before* the call, not after it.

    A run that checks its budget at the end has already spent the money; it has
    only decided not to admit it. The call it refuses to make is the first one
    past the ceiling, which is the one it does not make.
    """
    report = suite.run(budget=Budget(max_calls=40, max_usd=PRICE * CALLS))
    assert report.calls == 40
    assert report.usd == pytest.approx(40 * PRICE)
    assert len(report.verdicts) < ITEMS, "it stopped, so it did not score everything"


def test_a_run_that_hit_the_ceiling_is_not_a_result(suite):
    """It has no number, so it must not report one and must not go green.

    This is the whole reason the budget is code rather than a comment: the
    only thing that stops somebody raising the ceiling by hand in a pull
    request is that the job goes red when they do.
    """
    report = suite.run(budget=Budget(max_calls=40, max_usd=PRICE * CALLS))
    assert report.ok is False
    assert report.exit_code == 1
    assert "ceiling" in report.stop_reason
    payload = json.loads(report.to_json())
    assert payload["ok"] is False and payload["stopped_early"] is True
    assert payload["stop_reason"]


def test_a_cache_hit_is_free_and_does_not_count_against_the_ceiling(data, cfg, cache):
    """The mistake people make on the way to fixing the cost.

    A budget that counts cache lookups against the call ceiling fails every
    warm run — so the fix is to delete the cache, and the suite goes back to
    costing 282 calls a night. A hit is a lookup. It is free, and it must stay
    free however small the ceiling gets.
    """
    Suite(data=data, cfg=cfg, cache=cache).run()
    report = Suite(data=data, cfg=cfg, cache=cache).run(
        budget=Budget(max_calls=0, max_usd=0.0))
    assert report.ok is True
    assert report.calls == 0
    assert report.hits == CALLS
    assert len(report.verdicts) == ITEMS


def test_the_shipped_ceiling_is_the_size_of_the_shipped_suite():
    """The default budget is exactly what the default suite costs.

    A ceiling with slack in it is a ceiling nobody has thought about. Set it
    to the number, and when somebody adds a repeat without raising it, the job
    goes red and the pull request says why.
    """
    assert DEFAULT_MAX_CALLS == CALLS == 282
    assert DEFAULT_MAX_CALLS * PRICE == pytest.approx(10.69908, abs=1e-4)


# --------------------------------------------------------------------------
# 4. The report the pull request reads
# --------------------------------------------------------------------------


def test_a_run_reports_its_own_cost_and_says_what_it_scored(suite):
    report = suite.run()
    payload = json.loads(report.to_json())
    assert payload["calls"] == CALLS
    assert payload["cost_per_call"] == PRICE
    assert payload["usd"] == pytest.approx(CALLS * PRICE)
    assert payload["verdicts_scored"] == ITEMS
    assert payload["config"]["suite_key"] == RunConfig().suite_key()
    assert f"${report.usd:.4f}" in str(report)


def test_the_price_sheet_is_the_courses_own_and_nothing_else(data, cfg):
    """There is no bill here. The number exists so the budget line is non-zero,
    and quoting it as a provider price is how a lab becomes a business case."""
    assert cost_per_call(data, cfg) == PRICE
    assert cost_per_call(data, RunConfig(judge_id="not-a-judge")) == 0.0


def test_the_suite_cache_key_names_the_whole_configuration(cfg):
    """This string is what ``evals.yml`` stores the cache under.

    A cache keyed on anything weaker — the commit, the branch, the date — will
    happily serve verdicts from a prompt nobody ran, and it will do it
    silently, because the numbers will look exactly right.
    """
    base = cfg.suite_key()
    assert base == RunConfig().suite_key(), "the same configuration, the same name"
    for field, value in [("model_build", "qwen3-1.7b-q8_0"),
                         ("prompt_hash", cfg.prompt_hash + "d"),
                         ("fewshot", "s01,s02"), ("answer_order", "BA"),
                         ("decoding", "temperature=0.7"),
                         ("judge_id", "c-plain-3b"), ("variant", "v2"),
                         ("dataset", "rag")]:
        assert RunConfig(**{field: value}).suite_key() != base, \
            f"{field} must change the cache name"
    assert RunConfig(repeats=5).suite_key() == base, \
        "repeats are more calls of the same judge, not a different judge"
