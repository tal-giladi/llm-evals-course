"""Lab 3 — the specification.

Every field gets changed one at a time, and the key has to move every time.
A key that ignores a field is a cache that reuses a verdict across exactly
the change you were trying to measure.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from cache import JudgeCache
from evallab import cache_key, load

BASE_PARTS = {
    "model_build": "qwen3-1.7b-q4_K_M",
    "prompt_hash": "a1b2c3d4",
    "fewshot": "none",
    "answer_order": "AB",
    "decoding": "greedy",
    "sample_index": 0,
}


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture
def item(data):
    return data.items_for("dev")[0]


@pytest.fixture
def cache(tmp_path):
    return JudgeCache(tmp_path / "c.json")


def test_same_inputs_hit_the_cache(cache, item):
    cache.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    assert cache.get(item, "v1", "c-rubric-3b", **BASE_PARTS) == 1
    assert cache.misses == 0 and cache.hits == 1


def test_a_different_prompt_never_hits(cache, item):
    """Lesson 5.3. One character is enough — the hash is the guard."""
    cache.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    assert cache.get(item, "v1", "c-rubric-3b", **{**BASE_PARTS, "prompt_hash": "a1b2c3d5"}) is None


@pytest.mark.parametrize("field,value", [
    ("model_build", "qwen3-1.7b-q8_0"),
    ("fewshot", "s01,s02"),
    ("answer_order", "BA"),
    ("decoding", "temperature=0.7"),
    ("sample_index", 3),
])
def test_every_component_changes_the_key(cache, item, field, value):
    cache.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    assert cache.get(item, "v1", "c-rubric-3b", **{**BASE_PARTS, field: value}) is None, \
        f"changing {field} must not reuse a verdict"


def test_variant_and_judge_change_the_key(cache, item):
    cache.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    assert cache.get(item, "v2", "c-rubric-3b", **BASE_PARTS) is None
    assert cache.get(item, "v1", "c-rubric-7b", **BASE_PARTS) is None


def test_a_different_item_never_hits(cache, data):
    a, b = data.items_for("dev")[:2]
    cache.put(a, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    assert cache.get(b, "v1", "c-rubric-3b", **BASE_PARTS) is None


def test_misses_are_counted_so_a_too_loose_key_is_visible(cache, item):
    """A cache that always hits is a cache whose key is too loose."""
    cache.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    for i in range(3):
        cache.get(item, "v1", "c-rubric-3b", **{**BASE_PARTS, "sample_index": i + 1})
    assert cache.misses == 3
    assert cache.hit_rate == 0.0


def test_survives_a_save_and_reload(tmp_path, item):
    a = JudgeCache(tmp_path / "c.json")
    a.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    a.save()
    b = JudgeCache(tmp_path / "c.json")
    assert b.get(item, "v1", "c-rubric-3b", **BASE_PARTS) == 1


def test_the_key_matches_the_package_helper(cache, item):
    """Once fixed, the cache and evallab must agree — or CI caches for two
    different things under one name."""
    cache.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
    expected = cache_key(
        item=item, variant="v1", judge_id="c-rubric-3b",
        model_build=BASE_PARTS["model_build"],
        prompt_hash=BASE_PARTS["prompt_hash"],
        decoding=BASE_PARTS["decoding"],
        fewshot=BASE_PARTS["fewshot"],
        answer_order=BASE_PARTS["answer_order"],
        sample_index=BASE_PARTS["sample_index"],
    )
    assert cache.key(item, "v1", "c-rubric-3b", **BASE_PARTS) == expected

