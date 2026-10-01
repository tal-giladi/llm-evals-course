"""Throwaway: timing + per-cell mean drop, on the configuration the lab will ship."""
import sys, time
sys.path.insert(0, "labs/common")
import evallab.stats as S
S.percentile_ci = S._percentile_ci
import evallab.gate as G
from evallab import load, RecordedJudge, mulberry32
from evallab.stats import paired_comparison

d = load("support")
J = RecordedJudge(d, "c-rubric-3b")
items = list(d.items)
TRIALS = 400


def majority(s):
    return 1 if sum(s) * 2 > len(s) else 0


def run(its, repeats, seed, drop=()):
    rng = mulberry32(seed)
    out = []
    for it in its:
        s = J.samples(it, "v1")
        v = majority([s[rng.randrange(len(s))] for _ in range(repeats)])
        if it.id in drop:
            v = 0
        out.append((0, v))
    return out


print(f"{'items':>6} {'repeats':>8} {'block':>6} {'mean drop':>10} {'fa':>7} {'missed':>7}")
for size in (20, 40, 94):
    its = items[:size]
    for repeats in (1, 3, 5):
        broken = tuple(x.id for x in its[:max(1, round(size * 0.1))])
        fa = miss = 0
        tot = 0.0
        for t in range(TRIALS):
            base = run(its, repeats, 7000 + t)
            cand = run(its, repeats, 7500 + t)
            bc = run(its, repeats, 7500 + t, drop=broken)
            if paired_comparison(base, cand, resamples=0).delta > 0.05:
                fa += 1
            drop = paired_comparison(base, bc, resamples=0).delta
            tot += drop
            if drop <= 0.05:
                miss += 1
        print(f"{size:>6} {repeats:>8} {len(broken):>6} {tot/TRIALS*100:>9.2f}p "
              f"{fa/TRIALS*100:>6.1f}% {miss/TRIALS*100:>6.1f}%")

t0 = time.time()
for _ in range(20):
    G.run_gate(run(items, 3, 1), run(items, 3, 2), tolerance=0.05, repeats=3)
print("\nrun_gate on 94 items: %.0f ms a call" % ((time.time() - t0) / 20 * 1000))
