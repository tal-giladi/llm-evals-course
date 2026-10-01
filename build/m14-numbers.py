"""What the module 14 lessons quote, computed by running the shipped code.

A PSI sweep over a genuine mix shift, and the band arithmetic showing why a
band picked by feel fires on noise.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "labs" / "common"))

from evallab import Band, TraceStore, load, record  # noqa: E402
from evallab.online import mix, psi, regressions_from  # noqa: E402

data = load("support")
dev = data.items_for("dev")
test = data.items_for("test")

print("=== PSI: the production mix moving away from dev ===")
base = mix(dev, lambda it: (it.slice or {}).get("intent", "unknown"))
print(f"baseline mix: {{{', '.join(f'{k}: {v:.3f}' for k, v in sorted(base.items()))}}}")
print()
print("window                       psi     reading")
cases = [
    ("the same mix, re-sampled", lambda: mix(dev, lambda it: (it.slice or {}).get("intent", "unknown"))),
    ("held-out test split", lambda: mix(test, lambda it: (it.slice or {}).get("intent", "unknown"))),
    ("one category thinned by half",
     lambda: {k: (v / 2 if k == "policy_fact" else v * 1.18) for k, v in base.items()}),
    ("a new category appears at 10%",
     lambda: {**{k: v * 0.9 for k, v in base.items()}, "new_intent": 0.10}),
    ("everything collapses onto one category",
     lambda: {k: (0.70 if k == "policy_fact" else 0.30 / (len(base) - 1)) for k in base}),
]
for label, fn in cases:
    v = psi(base, fn())
    reading = "stable" if v < 0.1 else ("worth a look" if v < 0.25 else "assume something moved")
    print(f"{label:29s} {v:6.3f}   {reading}")

print("\n=== the band, and why it must come from an interval ===")
print("n     baseline  wilson 95%      half-width  sens 0.05   fires on 0.85?  on 0.95?")
for n in (20, 50, 100, 200, 500):
    b = Band("pass rate", 0.90, n)
    w = b.interval
    print(f"{n:4d}  {b.baseline:.3f}     {w.lo:.3f}-{w.hi:.3f}      {b.half_width:.3f}"
          f"      {b.sensitivity:.2f}      "
          f"{'yes' if b.fires(0.85) else 'no ':>12}  {'yes' if b.fires(0.95) else 'no':>8}")
b20 = Band("pass rate", 0.90, 20)
print()
print("n=20, baseline 0.90, sensitivity 0.05:")
print(" ", b20.explain(0.87))
b200 = Band("pass rate", 0.90, 200)
print("n=200, same baseline and sensitivity:")
print(" ", b200.explain(0.87))

print("\n=== sampling production traffic, errors always kept ===")
for rate in (1.0, 0.25, 0.05):
    got = record(data, n=57, split="dev", fail_rate=0.10, sample_rate=rate, seed=1)
    st = TraceStore.from_traces(got)
    chat = st.error_rate().get("chat", {})
    print(f"  rate {rate:5.0%} -> {len(got):3d} of 57 traces, chat errors {chat.get('errors', 0)}"
          f" ({chat.get('rate', 0):.1%})")

print("\n=== the loop: production failures that could become test cases ===")
traces = record(data, n=57, split="dev", fail_rate=0.15, seed=1)
regs = regressions_from(traces)
print(f"  {len(regs)} failing trace(s) of {len(traces)}")
for r in regs[:4]:
    print(f"    {r.item_id}  {r.category:28s} {r.question[:52]}")
if regs:
    tc = regs[0].as_test_case(human_label=0, judge_verdict=1)
    print("\n  the first one as a test case:")
    print(f"    id={tc['id']}  label={tc['human']['v1']['label']}  "
          f"category={tc['human']['v1']['category']}")
