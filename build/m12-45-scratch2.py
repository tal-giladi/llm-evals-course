# Throwaway for lessons 12.4 / 12.5, part 2. Deleted when the lessons are done.
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "labs" / "common"))

from evallab import TraceStore, load, record  # noqa: E402

data = load("support")

print("=== error_rate, n=20 dev, 10% planted, no sampling ===")
print(TraceStore.from_traces(record(data, n=20, split="dev", fail_rate=0.10, seed=1)).error_rate())
print("=== error_rate, n=20 dev, 10% planted, 25% sampling ===")
print(TraceStore.from_traces(
    record(data, n=20, split="dev", fail_rate=0.10, sample_rate=0.25, seed=1)).error_rate())
print("=== kept trace ids at 25% ===")
print([t["trace_id"] for t in record(data, n=20, split="dev", fail_rate=0.10, sample_rate=0.25, seed=1)])

print("=== error_rate, n=57 dev, no planted errors ===")
st57 = TraceStore.from_traces(record(data, n=57, split="dev", seed=1))
print(st57.error_rate())
print("tokens:", st57.total_tokens(), "cost:", st57.total_cost())
print("latency:", st57.latency())
print("=== the five out_of_scope traces ===")
for t in record(data, n=57, split="dev", seed=1):
    for s in t["spans"]:
        if s["attributes"].get("retrieved") == 0:
            print(st57.tree(t["trace_id"]))
            break

print("=== padded variant: the same five items ===")
pad = TraceStore.from_traces(record(data, n=20, split="dev", variant="v1padded", seed=1))
print("cost", pad.total_cost(), pad.total_tokens())
print("latency", pad.latency())
print("error_rate", pad.error_rate())
print(pad.tree(pad.traces[0]["trace_id"]))