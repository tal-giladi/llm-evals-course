import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "labs" / "common"))

from evallab import Span, TraceStore, load, record  # noqa: E402

data = load("support")
traces = record(data, n=20, split="dev", fail_rate=0.10, seed=1)

print("=== one trace, verbatim (tr_s01) ===")
t = next(x for x in traces if x["trace_id"] == "tr_s01")
print(json.dumps(t, indent=2)[:4000])

print("\n=== the failing trace tr_s02, as a tree ===")
f = next(x for x in traces if x["trace_id"] == "tr_s02")
print(TraceStore.from_traces([f]).tree("tr_s02"))

print("\n=== the failing trace tr_s10, as a tree ===")
f10 = next(x for x in traces if x["trace_id"] == "tr_s10")
print(TraceStore.from_traces([f10]).tree("tr_s10"))

print("\n=== attribute names actually emitted, counted over 20 traces ===")
from collections import Counter
c = Counter()
kinds = Counter()
for t in traces:
    for s in t["spans"]:
        kinds[s["kind"]] += 1
        for k in s["attributes"]:
            c[k] += 1
print(" kinds:", dict(kinds))
for k, v in sorted(c.items()):
    print(f"   {k:34s} {v}")

print("\n=== what a reader sees if the names are our own ===")
def rename(key_from, key_to):
    out = []
    for t in traces:
        spans = []
        for s in t["spans"]:
            d = dict(s)
            a = dict(d["attributes"])
            if key_from in a:
                a[key_to] = a.pop(key_from)
            spans.append({**d, "attributes": a})
        out.append({"trace_id": t["trace_id"], "spans": spans})
    return out

good = TraceStore.from_traces(traces)
renamed = TraceStore.from_traces(rename("gen_ai.usage.input_tokens", "prompt_tokens"))
renamed2 = TraceStore.from_traces(rename("gen_ai.usage.output_tokens", "completion_tokens"))
renamed3 = TraceStore.from_traces(rename("gen_ai.request.model", "model"))
print(" conventions   :", good.total_tokens(), f"${good.total_cost():.8f}")
print(" prompt_tokens :", renamed.total_tokens(), f"${renamed.total_cost():.8f}")
print(" completion    :", renamed2.total_tokens(), f"${renamed2.total_cost():.8f}")
print(" model         :", f"{good.total_tokens()}", f"${renamed3.total_cost():.8f}",
      "by model:", renamed3.cost_by_model())

print("\n=== error.type renamed to 'error' ===")
r4 = TraceStore.from_traces(rename("error.type", "error"))
print(" error_rate conventions:", {k: v for k, v in good.error_rate().items()})
print(" error_rate renamed   :", {k: v for k, v in r4.error_rate().items()})

print("\n=== errors kept vs lost, side by side ===")
kept = record(data, n=20, split="dev", fail_rate=0.10, seed=1, keep_errors=True)
lost = record(data, n=20, split="dev", fail_rate=0.10, seed=1, keep_errors=False)
ks, ls = TraceStore.from_traces(kept), TraceStore.from_traces(lost)
print(f" traces {len(ks)} -> {len(ls)}   spans {len(ks.spans())} -> {len(ls.spans())}")
print(f" tokens {ks.total_tokens()} -> {ls.total_tokens()}")
print(f" cost ${ks.total_cost():.8f} -> ${ls.total_cost():.8f}")
print(f" latency {ks.latency()} -> {ls.latency()}")
print(f" error_rate kept: {{k: v['errors'] for k, v in ks.error_rate().items()}}")
print(f" error_rate lost: {{k: v['errors'] for k, v in ls.error_rate().items()}}")
print(f" sessions kept: {ks.sessions()}")
print(f" sessions lost: {ls.sessions()}")

print("\n=== fail-rate sweep, kept vs lost ===")
for fr in (0.0, 0.10, 0.25, 0.50):
    k = record(data, n=20, split="dev", fail_rate=fr, seed=1, keep_errors=True)
    l = record(data, n=20, split="dev", fail_rate=fr, seed=1, keep_errors=False)
    kk = TraceStore.from_traces(k).error_rate().get("chat", {"rate": 0.0, "errors": 0})
    ll = TraceStore.from_traces(l).error_rate().get("chat", {"rate": 0.0, "errors": 0})
    print(f" fail_rate {fr:4.0%}: kept {len(k):2d} traces chat {kk['errors']}/{kk['spans']} = {kk['rate']:5.1%}"
          f"   lost {len(l):2d} traces chat {ll['errors']}/{ll['spans']} = {ll['rate']:5.1%}")