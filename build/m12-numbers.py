# Print the tracing numbers the module 12 lessons quote, computed by running
# the shipped Python. Every figure in lessons 12.3 to 12.5 must appear here.
#
# Run:  py build/m12-numbers.py
import os
import re
import sys
from collections import Counter
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

print("\n=== lesson 12.3: the same 10% planted errors, naive exporter ===")
kept = record(data, n=20, split="dev", fail_rate=0.10, seed=1, keep_errors=True)
lost = record(data, n=20, split="dev", fail_rate=0.10, seed=1, keep_errors=False)
lost_store = show("10% planted errors, keep_errors=False", lost)
kept_ids = {t["trace_id"] for t in kept}
print(f"  traces missing entirely: {sorted(kept_ids - {t['trace_id'] for t in lost})}")
print(f"  cost      ${planted.total_cost():.8f} -> ${lost_store.total_cost():.8f}")
print(f"  tokens    {planted.total_tokens()} -> {lost_store.total_tokens()}")
print(f"  p50 e2e   {planted.latency()['p50_end_to_end']:.1f} ms -> "
      f"{lost_store.latency()['p50_end_to_end']:.1f} ms")
print(f"  p95 e2e   {planted.latency()['p95_end_to_end']:.1f} ms -> "
      f"{lost_store.latency()['p95_end_to_end']:.1f} ms")

print("\n=== lesson 12.3: sweep the planted failure rate ===")
for fr in (0.0, 0.10, 0.25, 0.50):
    k = TraceStore.from_traces(
        record(data, n=20, split="dev", fail_rate=fr, seed=1, keep_errors=True))
    l = TraceStore.from_traces(
        record(data, n=20, split="dev", fail_rate=fr, seed=1, keep_errors=False))
    kc = k.error_rate().get("chat", {"errors": 0, "spans": 0, "rate": 0.0})
    lc = l.error_rate().get("chat", {"errors": 0, "spans": 0, "rate": 0.0})
    print(f"  planted {fr:>4.0%}  kept {len(k):2d} traces  chat {kc['errors']:2d}/{kc['spans']:2d}"
          f" = {kc['rate']:5.1%}   lost {len(l):2d} traces  chat {lc['errors']:2d}/{lc['spans']:2d}"
          f" = {lc['rate']:5.1%}")
    print(f"                  tokens {k.total_tokens()['total']:4d} vs {l.total_tokens()['total']:4d}"
          f"   cost ${k.total_cost():.8f} vs ${l.total_cost():.8f}"
          f"   p50 {k.latency()['p50_end_to_end']:.1f} vs {l.latency()['p50_end_to_end']:.1f}"
          f"   p95 {k.latency()['p95_end_to_end']:.1f} vs {l.latency()['p95_end_to_end']:.1f}")

print("\n=== lesson 12.2: rename one attribute and read the panel again ===")


def rename(traces, key_from, key_to):
    out = []
    for t in traces:
        spans = []
        for s in t["spans"]:
            a = dict(s["attributes"])
            if key_from in a:
                a[key_to] = a.pop(key_from)
            spans.append({**s, "attributes": a})
        out.append({"trace_id": t["trace_id"], "spans": spans})
    return out


src = record(data, n=20, split="dev", fail_rate=0.10, seed=1)
rows = [("conventions (unchanged)", src)]
for old, new in (("gen_ai.usage.input_tokens", "prompt_tokens"),
                 ("gen_ai.usage.output_tokens", "completion_tokens"),
                 ("gen_ai.request.model", "model"),
                 ("error.type", "error")):
    rows.append((f"{old} -> {new}", rename(src, old, new)))
for label, tr in rows:
    st = TraceStore.from_traces(tr)
    tok = st.total_tokens()
    er = st.error_rate()
    print(f"  {label:44s} in {tok['input']:4d}  out {tok['output']:4d}"
          f"  ${st.total_cost():.8f}  chat err "
          f"{er.get('chat', {}).get('errors', 0)}  chain err "
          f"{er.get('chain', {}).get('errors', 0)}")
print(f"  cost_by_model under conventions: {base.cost_by_model()}")
print(f"  cost_by_model with model renamed: "
      f"{TraceStore.from_traces(rename(base.traces, 'gen_ai.request.model', 'model')).cost_by_model()}")

print("\n=== lesson 12.2: which attribute names the 20 planted traces carry ===")
census: Counter = Counter()
kinds: Counter = Counter()
for t in src:
    for s in t["spans"]:
        kinds[s["kind"]] += 1
        for k in s["attributes"]:
            census[k] += 1
print(f"  span kinds: {dict(kinds)}")
for k, v in sorted(census.items()):
    print(f"    {k:32s} {v}")

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
tree = base.tree(base.traces[0]["trace_id"]).splitlines()
ms = [float(re.findall(r"([\d.]+)ms", l)[0]) for l in tree]
print(f"  children sum {sum(ms[1:]):.3f} ms of a {ms[0]:.3f} ms root;"
      f" the chat span is {100 * ms[2] / ms[0]:.1f}% of it")
print(f"  p50 model call / p50 end-to-end = "
      f"{100 * base.latency()['p50_model_call'] / base.latency()['p50_end_to_end']:.1f}%")

print("\n=== a failed trace, as a span tree ===")
for tr in record(data, n=20, split="dev", fail_rate=0.10, seed=1):
    if tr["trace_id"] in ("tr_s02", "tr_s10"):
        print(TraceStore.from_traces([tr]).tree(tr["trace_id"]))

print("\n=== held-out read: the test split, 37 items, same 10% plant ===")
for split in ("dev", "test"):
    st = TraceStore.from_traces(
        record(data, n=37, split=split, fail_rate=0.10, seed=1))
    er = st.error_rate()
    lat = st.latency()
    print(f"  {split:5s} {len(st):2d} traces {len(st.spans()):3d} spans"
          f"  ${st.total_cost():.8f}  {st.total_tokens()['input']} in /"
          f" {st.total_tokens()['output']} out"
          f"  p50 {lat['p50_end_to_end']:.0f} p95 {lat['p95_end_to_end']:.0f}"
          f"  chat {er['chat']['errors']}/{er['chat']['spans']}"
          f"  chain {er['chain']['errors']}/{er['chain']['spans']}"
          f"  agent {er['agent']['errors']}/{er['agent']['spans']}")

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
