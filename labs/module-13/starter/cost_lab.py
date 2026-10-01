"""Lab 2 — keep the suite affordable.

The failure this lab exists to fix: the suite costs more to run than the
product it protects, so somebody turns it off. A gate nobody runs protects
nothing, and the two levers that fix it are the two things lesson 5.3 already
taught:

* **key the judge-call cache on the full key**, so the second run of an
  unchanged suite is a lookup rather than 282 verdicts, and
* **put a ceiling on one run**, so the bill goes up loudly instead of quietly.

The first is the single biggest cost lever in the whole course, and it is not
a new idea. Lesson [5.3] wrote the rule; this is it applied to a job that runs
on every pull request.

A third thing is here because it is the one people get wrong on the way: **a
cache hit is free, and a budget that counts hits against the ceiling will turn
the cache off on exactly the runs where it is saving you the most.**

Two things are missing below, and they are the two halves of the fix: the cache
key is too loose, and the run accepts a budget and then ignores it.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]                      # the course root
for _p in (REPO / "labs" / "common", HERE):
    if _p.is_dir() and str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from evallab import cache_key, load                        # noqa: E402
from evallab.gate import Budget                            # noqa: E402
from evallab.stats import hash_seed                        # noqa: E402

DEFAULT_CACHE = ".judge-cache.json"

# The ceiling the shipped configuration is measured against. It is the number
# lesson 13.4 is about: a per-run limit somebody agreed to, not a limit the
# last person to add a repeat forgot to update.
DEFAULT_MAX_CALLS = 282
DEFAULT_MAX_USD = 10.70


@dataclass
class RunConfig:
    """Everything about a judge call except which question was asked.

    These eight fields plus the item id are the lesson 5.3 key, and every one
    of them changes the answer. ``repeats`` is not in the key — it is the
    number of keys, because each repeat is a separate call.
    """

    judge_id: str = "c-rubric-3b"
    variant: str = "v1"
    model_build: str = "qwen3-1.7b-q4_K_M"
    prompt_hash: str = "grade-the-answer-against-these-rules-9f2c"
    fewshot: str = "none"
    answer_order: str = "AB"
    decoding: str = "temperature=0.0"
    repeats: int = 3
    dataset: str = "support"

    def parts(self) -> dict:
        return {
            "model_build": self.model_build,
            "prompt_hash": self.prompt_hash,
            "fewshot": self.fewshot,
            "answer_order": self.answer_order,
            "decoding": self.decoding,
        }

    def suite_key(self) -> str:
        """One name for this whole judge configuration.

        This is the string a CI cache is stored under, and it is the reason the
        restore is safe: a verdict filed under a different prompt, a different
        model build or a different decoding is not a verdict this configuration
        produced, so it must not come back under this name. Anything weaker —
        the commit, the branch, the date — will serve a pull request verdicts
        from a prompt nobody ran, and it will do it silently, because the
        numbers will look exactly right.
        """
        text = "|".join([
            self.dataset, self.judge_id, self.variant, self.model_build,
            self.prompt_hash, self.fewshot, self.answer_order, self.decoding,
        ])
        return f"{hash_seed(text):08x}"

    def to_json(self) -> dict:
        return {"repeats": self.repeats, "suite_key": self.suite_key(), **self.parts(),
                "judge_id": self.judge_id, "variant": self.variant, "dataset": self.dataset}


# --------------------------------------------------------------------------
# 1. The cache
# --------------------------------------------------------------------------


class JudgeCache:
    """A content-addressed cache of judge verdicts.

    This key is wrong. It covers the item, the variant, the judge id and the
    repeat number, and nothing else — so the same questions come back with the
    same answers no matter what you changed about the judge in between. The run
    looks free, and that is the exact shape of a cost bug nobody notices.
    """

    def __init__(self, path: str | Path = DEFAULT_CACHE):
        self.path = Path(path)
        self.hits = 0
        self.misses = 0
        self._store: dict = {}
        if self.path.exists():
            self._store = json.loads(self.path.read_text(encoding="utf-8"))

    # TODO 1: key on the whole of lesson 5.3 — item id, variant, judge id,
    #         model build, prompt text, rubric, few-shot ids and order, answer
    #         order, decoding settings and the sample index. `evallab.cache_key`
    #         is already correct; you are being asked to understand why, not to
    #         avoid typing. A key missing one of those reuses a verdict across
    #         exactly the change you were trying to measure, and the numbers it
    #         produces are plausible, reproducible and wrong.
    def key(self, item, cfg: RunConfig, sample_index: int) -> str:
        return f"{item.id}|{cfg.variant}|{cfg.judge_id}|{sample_index}"

    def get(self, item, cfg: RunConfig, sample_index: int):
        k = self.key(item, cfg, sample_index)
        if k in self._store:
            self.hits += 1
            return self._store[k]
        self.misses += 1
        return None

    def put(self, item, cfg: RunConfig, sample_index: int, verdict) -> None:
        self._store[self.key(item, cfg, sample_index)] = verdict

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self._store, indent=1, sort_keys=True),
                             encoding="utf-8")

    @property
    def hit_rate(self) -> float:
        """Worth logging. A cache that always hits is a cache whose key is too
        loose, and this is the only place that shows up."""
        total = self.hits + self.misses
        return 0.0 if total == 0 else self.hits / total

    def __len__(self) -> int:
        return len(self._store)


# --------------------------------------------------------------------------
# 2. A run that reports what it cost
# --------------------------------------------------------------------------


@dataclass
class CostReport:
    """What one run of the suite cost, and whether it was allowed to finish."""

    cfg: RunConfig
    items: int
    repeats: int
    calls: int = 0
    hits: int = 0
    misses: int = 0
    cost_per_call: float = 0.0
    stopped_early: bool = False
    stop_reason: str = ""
    verdicts: dict = field(default_factory=dict)

    @property
    def usd(self) -> float:
        return self.calls * self.cost_per_call

    @property
    def hit_rate(self) -> float:
        """This run's, not the cache's lifetime. A warm run should read 1.0."""
        looked_up = self.hits + self.misses
        return 0.0 if looked_up == 0 else self.hits / looked_up

    @property
    def ok(self) -> bool:
        """Did the run finish inside its ceiling?

        A run that hit the ceiling did not produce a measurement, so it must
        not report one. ``ok`` is what CI branches on.
        """
        return not self.stopped_early

    @property
    def exit_code(self) -> int:
        return 0 if self.ok else 1

    def to_json(self) -> str:
        return json.dumps({
            "ok": self.ok,
            "items": self.items, "repeats": self.repeats,
            "calls": self.calls, "hits": self.hits, "misses": self.misses,
            "hit_rate": round(self.hit_rate, 4),
            "cost_per_call": self.cost_per_call,
            "usd": round(self.usd, 6),
            "stopped_early": self.stopped_early,
            "stop_reason": self.stop_reason,
            "verdicts_scored": len(self.verdicts),
            "config": self.cfg.to_json(),
        }, indent=2)

    def __str__(self) -> str:
        head = (f"{self.items} items x {self.repeats} repeats: {self.calls} judge "
                f"call(s), {self.hits} cache hit(s), ${self.usd:.4f}")
        return head if self.ok else \
            f"{head}  STOPPED: {self.stop_reason}"


def cost_per_call(data, cfg: RunConfig) -> float:
    """The lab's price sheet for one verdict of this judge.

    The recorded judge costs nothing, so this number exists to make the budget
    line non-zero. It is the course's recorded price for its educational model
    — not a bill from a provider, and not a number to put in a business case.
    """
    return float((data.cost or {}).get(cfg.judge_id, {}).get("cost_usd", 0.0))


class Suite:
    """The eval suite, as a thing a CI job runs every time somebody pushes."""

    def __init__(self, data=None, cfg: RunConfig = None, cache: JudgeCache = None):
        self.data = data or load("support")
        self.cfg = cfg or RunConfig()
        # `cache or JudgeCache()` looks right and is not: JudgeCache defines
        # __len__, so an *empty* cache is falsy and the one you passed in gets
        # thrown away in favour of the default file. The symptom is a run that
        # reports hundreds of cache hits against a cache you never gave it.
        self.cache = cache if cache is not None else JudgeCache()

    def items(self, n: int | None = None) -> list:
        """The frozen set, in a fixed order. Same list every run, or the cache
        is a cache of different questions."""
        return list(self.data.items)[: (n or len(self.data.items))]

    def ask(self, item, sample_index: int) -> int:
        """One judge call. The recorded judge, so this costs no money and no
        time — which is exactly why the cache key is the only thing standing
        between this lab and a suite that bills you 282 times a night."""
        table = self.data.runs[self.cfg.judge_id]
        return table[f"{item.id}|{self.cfg.variant}"][sample_index]

    def run(self, n: int | None = None, budget: Budget = None) -> CostReport:
        """Score the suite and report what it cost.

        TODO 2: this accepts a ``budget`` and then ignores it, which is how a
                suite ends up costing more than the product it protects — and
                how it gets switched off without anybody deciding to switch it
                off. The ceiling has to be checked *before* each call, not
                after the run: a run that checks at the end has already spent
                the money and has only decided not to admit it. And the cache
                is already asked above, so a hit never reaches the check — a
                lookup is free, and a budget that charges for one fails every
                warm run, at which point somebody deletes the cache.
        """
        items = self.items(n)
        price = cost_per_call(self.data, self.cfg)
        report = CostReport(cfg=self.cfg, items=len(items), repeats=self.cfg.repeats,
                            cost_per_call=price)
        # The cache's counters are its whole lifetime; the report is about this
        # run, so take the difference.
        hits0, misses0 = self.cache.hits, self.cache.misses

        def finish() -> CostReport:
            report.hits = self.cache.hits - hits0
            report.misses = self.cache.misses - misses0
            return report

        for item in items:
            for s in range(self.cfg.repeats):
                cached = self.cache.get(item, self.cfg, s)
                if cached is None:
                    cached = self.ask(item, s)
                    self.cache.put(item, self.cfg, s, cached)
                    report.calls += 1
                report.verdicts[item.id] = cached

        return finish()


# --------------------------------------------------------------------------
# The run a CI job makes
# --------------------------------------------------------------------------


def main(argv=None) -> int:
    import argparse
    p = argparse.ArgumentParser(description="Run the suite and report what it cost.")
    p.add_argument("--cache", default=DEFAULT_CACHE)
    p.add_argument("--items", type=int, default=None)
    p.add_argument("--repeats", type=int, default=None)
    p.add_argument("--max-calls", type=int, default=DEFAULT_MAX_CALLS)
    p.add_argument("--max-usd", type=float, default=DEFAULT_MAX_USD)
    p.add_argument("--out", default="cost.json")
    p.add_argument("--no-budget", action="store_true",
                   help="run to the end whatever it costs - the thing that turns "
                        "the suite off in a month")
    p.add_argument("key", nargs="?", choices=["key"],
                   help="print the suite cache key and exit")
    args = p.parse_args(argv)

    cfg = RunConfig(repeats=args.repeats) if args.repeats else RunConfig()
    if args.key == "key":
        print(cfg.suite_key())
        return 0

    suite = Suite(cfg=cfg, cache=JudgeCache(args.cache))
    budget = None if args.no_budget else Budget(max_calls=args.max_calls,
                                                max_usd=args.max_usd)
    report = suite.run(n=args.items, budget=budget)
    suite.cache.save()

    print(report)
    print(f"  suite cache key: {cfg.suite_key()}   (cache file: {args.cache})")
    Path(args.out).write_text(report.to_json(), encoding="utf-8")
    print(f"wrote {args.out}")
    return report.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
