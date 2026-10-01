"""Loading the datasets.

The judge is the one thing in this package allowed to be a model. Everything
else is arithmetic you can read, which is the point of the division: lesson
11.1 runs a whole suite with no model anywhere in it.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

_HERE = Path(__file__).resolve()


def _find_datasets() -> Path:
    """Locate ``datasets/`` whether installed as a package or run from a lab.

    The module zip has ``datasets/`` and ``labs/common/`` as siblings, so a
    learner who downloads one module can still run it.
    """
    for up in range(0, 6):
        candidate = _HERE.parents[up] / "datasets"
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(
        "datasets/ not found. Run from a module folder, or copy datasets/ next "
        "to the labs — the module zip already includes it."
    )


@dataclass
class Item:
    id: str
    outputs: dict = field(default_factory=dict)
    human: dict = field(default_factory=dict)   # variant -> {label, category, critique}
    slice: dict | None = None
    question: str = ""

    def label(self, variant: str) -> int:
        h = self.human.get(variant)
        return int(h["label"]) if h else 0

    def category(self, variant: str) -> str:
        h = self.human.get(variant)
        return h["category"] if h else "unknown"

    def output(self, variant: str) -> str:
        return self.outputs.get(variant, "")


@dataclass
class Dataset:
    name: str
    title: str
    items: list = field(default_factory=list)      # list[Item]
    dev_ids: list = field(default_factory=list)
    test_ids: list = field(default_factory=list)
    variants: list = field(default_factory=list)
    judge_menu: list | None = None
    runs: dict | None = None
    repeats: int = 5
    cost: dict | None = None

    def by_id(self, item_id: str) -> Item:
        return next(i for i in self.items if i.id == item_id)

    def ids(self, split: str = "dev") -> list:
        return list(self.dev_ids if split == "dev" else self.test_ids)

    def items_for(self, split: str = "dev") -> list:
        wanted = set(self.ids(split))
        return [i for i in self.items if i.id in wanted]

    def judge(self, judge_id: str) -> dict:
        if not self.judge_menu:
            raise KeyError(f"{self.name} has no judge menu")
        return next(j for j in self.judge_menu if j["id"] == judge_id)

    def __len__(self) -> int:
        return len(self.items)


def load(name: str, root: Path | None = None) -> Dataset:
    """Load a shipped dataset by name, e.g. ``load("support")``."""
    path = (root or _find_datasets()) / f"{name}.json"
    with path.open(encoding="utf-8") as fh:
        raw = json.load(fh)
    return Dataset(
        name=raw.get("dataset", name),
        title=raw.get("title", name),
        items=[Item(id=i["id"], outputs=i.get("outputs", {}), human=i.get("human", {}),
                    slice=i.get("slice"), question=i.get("question", ""))
               for i in raw["items"]],
        dev_ids=raw.get("dev_ids", []),
        test_ids=raw.get("test_ids", []),
        variants=raw.get("variants", []),
        judge_menu=raw.get("judge_menu"),
        runs=raw.get("runs"),
        repeats=raw.get("repeats", 5),
        cost=raw.get("cost"),
    )
