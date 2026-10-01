"""The judge interfaces, and the caching key from lesson 5.3.

Two implementations ship. :class:`RecordedJudge` replays runs recorded at build
time and costs nothing — it is the default everywhere in this course. A live
local model is an *optional* extra (lesson 11.3), so the labs never require an
API key and never require a download to complete.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .dataset import Item
from .stats import hash_seed, majority_vote, threshold_verdict


class Judge(Protocol):
    """Anything that can say pass or fail about one answer."""

    id: str
    label: str

    def samples(self, item: Item, variant: str) -> list[int]:
        """The recorded samples for one item, oldest question asked first."""
        ...


@dataclass
class RecordedJudge:
    """Replays a judge run recorded at build time.

    The verdicts come from the educational model described in the labs, not
    from a real LLM — but every statistic computed from them is computed for
    real, and that distinction is the one the whole course keeps making.
    """

    dataset: object
    id: str

    @property
    def label(self) -> str:
        return self.dataset.judge(self.id)["label"]

    def samples(self, item: Item, variant: str) -> list[int]:
        if not self.dataset.runs or self.id not in self.dataset.runs:
            raise KeyError(f"dataset {self.dataset.name} has no runs for {self.id}")
        return self.dataset.runs[self.id].get(f"{item.id}|{variant}", [0])


@dataclass
class MajorityJudge:
    """Adds the repeats and threshold knobs from the lab.

    Lessons 7.5 and 6.4 in one small class: the same recorded samples, scored
    greedily, by majority, or against a probability-weighted threshold.
    """

    inner: Judge
    repeats: int = 1
    threshold: float = 0.5
    use_threshold: bool = False

    @property
    def id(self) -> str:
        return self.inner.id

    @property
    def label(self) -> str:
        if self.use_threshold:
            return f"{self.inner.label} · threshold {self.threshold:.2f}"
        if self.repeats > 1:
            return f"{self.inner.label} · {self.repeats} repeats"
        return self.inner.label

    def samples(self, item: Item, variant: str) -> list[int]:
        return self.inner.samples(item, variant)

    def verdict(self, item: Item, variant: str) -> int:
        used = self.inner.samples(item, variant)[: self.repeats] or [0]
        if self.use_threshold:
            return int(threshold_verdict(used, self.threshold) or 0)
        if self.repeats == 1:
            return used[0]
        return int(majority_vote(used) or 0)


def cache_key(item: Item, variant: str, judge_id: str, sample_index: int = 0,
              model_build: str = "", prompt_hash: str = "",
              decoding: str = "", fewshot: str = "", answer_order: str = "") -> str:
    """The lesson 5.3 key, as a function you can call.

    A judge verdict is only reusable when *every one* of these matches. This is
    the rule that makes caching safe in CI (lesson 13.2), and getting it wrong
    is how a suite reports numbers from a judge it never ran. Change one
    character of the prompt and ``prompt_hash`` changes, which is the entire
    point: a result for a prompt you did not run is not a result.
    """
    parts = [item.id, variant, judge_id, model_build, prompt_hash, decoding,
             fewshot, answer_order, str(sample_index)]
    return f"{hash_seed('|'.join(parts)):08x}"
