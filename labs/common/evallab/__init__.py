"""evallab — the evaluation toolkit for the production path.

Modules 1-10 do this work in the browser. This package is the same work in
Python, so that a suite you can read, run and put in CI is the same suite the
course measured by hand.

The statistics here are a port of ``simulations/common/stats.js``. They are
not an independent reimplementation: lesson 11.2 makes the two agree as an
exercise, and ``tests/test_parity.py`` checks they still do. If you change a
formula here, change it there, or the lesson stops being true.
"""

from .dataset import Dataset, Item, load
from .stats import (
    Confusion,
    Interval,
    accuracy,
    cohens_kappa,
    confusion,
    corrected_pass_rate,
    hash_seed,
    judge_metrics,
    majority_vote,
    mulberry32,
    paired_comparison,
    pct,
    sample_items,
    simulate_gate,
    threshold_verdict,
    tnr,
    tpr,
    wilson,
)
from .judge import Judge, MajorityJudge, RecordedJudge, cache_key
from .suite import SuiteResult, SliceScore, compare, run_suite
from .tracing import (
    ERROR_TYPE, GEN_AI_CONVERSATION_ID, GEN_AI_INPUT_TOKENS, GEN_AI_OPERATION,
    GEN_AI_OUTPUT_MESSAGES, GEN_AI_OUTPUT_TOKENS, GEN_AI_REQUEST_MODEL,
    GEN_AI_RESPONSE_MODEL, GEN_AI_SYSTEM, GEN_AI_TOOL_NAME,
    GEN_AI_TOOL_CALL_ID, Redactor, Span, Tracer, backend_status, export,
    model_price, should_sample, token_cost,
)
from .observe import TraceStore, instrumented_run, record, summary
from .gate import Budget, GateResult, Quarantine, run_gate
from .online import (
    Band, Regression, mix, psi, regressions_from, sample_for_review, sample_queries,
)

__version__ = "1.1.0"

__all__ = [
    "Dataset", "Item", "load",
    "Confusion", "Interval",
    "confusion", "tpr", "tnr", "accuracy", "cohens_kappa", "wilson", "pct",
    "judge_metrics", "corrected_pass_rate", "paired_comparison", "sample_items",
    "majority_vote", "threshold_verdict", "simulate_gate",
    "hash_seed", "mulberry32",
    "Judge", "RecordedJudge", "MajorityJudge", "cache_key",
    "SuiteResult", "SliceScore", "run_suite", "compare",
    # tracing, module 12
    "Span", "Tracer", "Redactor", "export", "backend_status",
    "token_cost", "model_price", "should_sample",
    "GEN_AI_SYSTEM", "GEN_AI_OPERATION", "GEN_AI_REQUEST_MODEL",
    "GEN_AI_CONVERSATION_ID", "GEN_AI_INPUT_TOKENS", "GEN_AI_OUTPUT_MESSAGES",
    "GEN_AI_OUTPUT_TOKENS", "GEN_AI_TOOL_NAME",
    "GEN_AI_RESPONSE_MODEL", "GEN_AI_TOOL_CALL_ID",
    "ERROR_TYPE",
    "TraceStore", "instrumented_run", "record", "summary",
    # release gate, module 13
    "run_gate", "GateResult", "Budget", "Quarantine",
    # online evals, module 14
    "Band", "psi", "mix", "sample_queries", "sample_for_review",
    "Regression", "regressions_from",
]



