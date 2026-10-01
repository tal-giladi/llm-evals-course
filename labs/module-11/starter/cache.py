"""Lab 3 — a judge cache that does not lie.

This cache is wrong. It keys on the item and the judge id and ignores
everything else, so it will happily return a verdict for a prompt you did
not run, a different model build, or a different answer order.

That is the worst kind of bug in this course: the numbers it produces are
plausible, reproducible, and completely wrong. Nobody questions a number
that repeats.

Fix the key. ``evallab.judge.cache_key`` is already correct — you are being
asked to understand why, not to avoid typing.
"""

from __future__ import annotations

import json
from pathlib import Path

from evallab.judge import cache_key


class JudgeCache:
    """A content-addressed cache of judge verdicts.

    The key must cover **every** input that can change a verdict (lesson
    5.3):

        item id, system variant, judge id, model build, prompt text,
        rubric, few-shot ids and order, answer order, decoding settings,
        sample index

    A key missing one of those is a cache that returns the wrong answer
    exactly when the thing that changed was the thing you were testing.
    """

    def __init__(self, path: str | Path = ".judge-cache.json"):
        self.path = Path(path)
        self.hits = 0
        self.misses = 0
        self._store: dict[str, int] = {}
        if self.path.exists():
            self._store = json.loads(self.path.read_text(encoding="utf-8"))

    # TODO 1: build the key from all of the above, not just item and judge.
    def key(self, item, variant: str, judge_id: str, **parts) -> str:
        return f"{item.id}|{variant}|{judge_id}"

    def get(self, item, variant: str, judge_id: str, **parts):
        k = self.key(item, variant, judge_id, **parts)
        if k in self._store:
            self.hits += 1
            return self._store[k]
        self.misses += 1
        return None

    def put(self, item, variant: str, judge_id: str, verdict, **parts) -> None:
        self._store[self.key(item, variant, judge_id, **parts)] = verdict

    def save(self) -> None:
        self.path.write_text(json.dumps(self._store, indent=1), encoding="utf-8")

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return 0.0 if total == 0 else self.hits / total

    def __len__(self) -> int:
        return len(self._store)
