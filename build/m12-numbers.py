# Print the tracing numbers the module 12 lessons quote, computed by running
# the shipped Python. Every figure in lessons 12.3 to 12.5 must appear here.
#
# Run:  py build/m12-numbers.py
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "labs" / "common"))

from evallab import TraceStore, Redactor, export, load, record, token_cost  # noqa: E402
from evallab.observe import summary  # noqa: E402

data = load("support")


def show(title, traces):
    store = TraceStore.from_traces(traces)
    print(f"\n=== {title} ===")
    print(summary(store))
    errs = store.error_rate()
    for kind, v in errs.items():
        print(f"  {kind:14s} {v['errors']:3d}/{v['spans']:3d} = {v['rate']:.1%}")
    return store


base = show("20 dev traces, no planted errors",
            record(data, n=20, split="dev", seed=1))
planted = show("20 dev traces, 10% model-call errors planted",
               record(data, n=20, split="dev", fail_rate=0.10, seed=1))

print("\n=== per-model cost (20 traces, qwen3-1.7b) ===")
for m, c in base.cost_by_model().items():
    print(f"  {m:16s} ${c:.8f}")
tok = base.total_tokens()
print(f"  tokens {tok['input']} in / {tok['output']} out")

print("\n=== one price calculation you can check by hand ===")
one = [s for s in base.spans("chat")][0]
print(f"  {one.model}: {one.input_tokens} in, {one.output_tokens} out")
print(f"  = ({one.input_tokens}*0.03 + {one.output_tokens}*0.09) / 1e6 "
      f"= ${token_cost(one.model, one.input_tokens, one.output_tokens):.10f}")
print(f"  whole run: ${base.total_cost():.8f}")

print("\n=== latency percentiles ===")
print(" ", base.latency())

print("\n=== the padded variant costs the same tokens and more of them ===")
v1 = record(data, n=20, split="dev", variant="v1", seed=1)
pad = record(data, n=20, split="dev", variant="v1padded", seed=1)
for name, tr in (("v1", v1), ("v1padded", pad)):
    st = TraceStore.from_traces(tr)
    t = st.total_tokens()
    print(f"  {name:10s} {t['input']:5d} in / {t['output']:5d} out   ${st.total_cost():.8f}")

print("\n=== a full trace, as a span tree ===")
print(base.tree(base.traces[0]["trace_id"]))

print("\n=== redaction ===")
pii = record(data, n=20, split="dev", pii_rate=1.0, seed=1)
res = export(pii, ROOT / "build" / "lab-scratch" / "m12.jsonl", redactor=Redactor())
print(f"  {res['redactions']} personal-data value(s) redacted")
for skipped in res["skipped"]:
    print(f"  skipped {skipped}")

print("\n=== sampling ===")
for rate in (1.0, 0.5, 0.25):
    got = record(data, n=40, split="dev", sample_rate=rate, seed=1)
    print(f"  rate {rate:4.0%} -> {len(got):2d} of 40 traces")
