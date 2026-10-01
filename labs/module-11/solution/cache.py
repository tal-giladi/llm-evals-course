"""Lab 3 — solution.

The key covers every input that can change a verdict. The one-line change
from the starter looks small and is the whole lab: with a loose key, every
test that changes one field and expects a miss returns a *hit* instead,
and the suite happily reports a verdict from a prompt you never ran.
"""

from __future__ import annotations

import json
from pathlib import Path

from evallab.judge import cache_key


class JudgeCache:
    """A content-addressed cache of judge verdicts."""

    def __init__(self, path: str | Path = ".judge-cache.json"):
        self.path = Path(path)
        self.hits = 0
        self.misses = 0
        self._store: dict = {}
        if self.path.exists():
            self._store = json.loads(self.path.read_text(encoding="utf-8"))

    def key(self, item, variant: str, judge_id: str,
            model_build: str = "", prompt_hash: str = "", fewshot: str = "",
            answer_order: str = "", decoding: str = "",
            sample_index: int = 0) -> str:
        return cache_key(
            item=item, variant=variant, judge_id=judge_id,
            model_build=model_build, prompt_hash=prompt_hash,
            fewshot=fewshot, answer_order=answer_order, decoding=decoding,
            sample_index=sample_index,
        )

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
        """Worth logging. A cache that always hits is a cache whose key is
        too loose, and this is the only place that shows up."""
        total = self.hits + self.misses
        return 0.0 if total == 0 else self.hits / total

    def __len__(self) -> int:
        return len(self._store)
