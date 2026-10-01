"""Lesson 12.3's central claim, measured.

The naive exporter (`keep_errors=False`) does not merely under-count. It
changes nothing a dashboard shows except the error number, and it reports
0.0% at every failure rate. This is the sweep the lesson quotes.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "labs" / "common"))

from evallab import TraceStore, load, record  # noqa: E402

data = load("support")
print("planted   exporter    traces   chat errors   tokens   cost          p95")
for rate in (0.0, 0.10, 0.25, 0.50):
    for keep in (True, False):
        tr = record(data, n=20, split="dev", fail_rate=rate, seed=1,
                    keep_errors=keep)
        st = TraceStore.from_traces(tr)
        chat = st.error_rate().get("chat", {})
        tok = st.total_tokens()
        name = "naive    " if not keep else "shipped  "
        print(f"{rate:5.0%}    {name}  {len(tr):5d}      "
              f"{chat.get('errors', 0):2d}/{chat.get('spans', 0):<3d}"
              f"{chat.get('rate', 0):6.1%}   {tok['total']:5d}   "
              f"${st.total_cost():.8f}  {st.latency()['p95_end_to_end']:7.1f}")
    print()

kept = record(data, n=20, split="dev", fail_rate=0.10, seed=1, keep_errors=True)
lost = record(data, n=20, split="dev", fail_rate=0.10, seed=1, keep_errors=False)
missing = ({t["trace_id"] for t in kept} - {t["trace_id"] for t in lost})
print("traces the naive exporter loses at a 10% planted rate:", sorted(missing))
for t in lost:
    if t["trace_id"] in missing:
        print(f"  {t['trace_id']} spans that DID survive: "
              f"{[s['kind'] for s in t['spans']]}")
