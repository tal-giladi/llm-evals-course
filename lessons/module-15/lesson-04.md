---
id: "15.4"
module: 15
minutes: 25
practice_minutes: 60
prerequisites: ["15.3", "10.1"]
objectives:
  - Run a model migration end to end — two recorded variants, one judge, a paired comparison, a gate — and read the three numbers the gate reports as three different claims.
  - Decide whether a suite is large enough to resolve the difference its own tolerance is set at, from a bootstrap interval rather than from a rule of thumb.
  - Show that a migration invalidates the judge cache by construction, using the `cache_key` fields rather than by remembering to clear a cache.
  - Argue, from a slice table, why a single whole-suite number is the wrong artefact to put in a migration decision, and name the slice the decision actually turns on.
volatility: implementation
sources:
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
  - title: "Zheng et al. — Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"
    url: https://arxiv.org/abs/2306.05685
  - title: "Samuel Bowyer et al. — The Mythos of Model Evaluation"
    url: https://arxiv.org/abs/2411.19994
  - title: "Nathan Lambert et al. — RewardBench: Evaluating Reward Models for Language Modeling"
    url: https://arxiv.org/abs/2403.13787
last_verified: "2026-10-01"
---

# 15.4 · Evaluating a model migration

This is the lesson in the module worth doing if you do none of the others, because it is the production task you will actually have: a model vendor ships a new build, or your own team swaps the serving model, and somebody has to say whether the product got worse before the switch goes out. It is also entirely made of pieces this course has already taught — a paired comparison from [10.1](../module-10/lesson-01.md), a gate from [13.1](../module-13/lesson-01.md), a cache key from [05.3](../module-05/lesson-03.md), and two recorded variants to point them at.

## Why it matters

Here is the shape it actually takes, because the shape is the argument.

A vendor ships a new build on a Tuesday. The release note says the new build is better on reasoning benchmarks, costs less per million tokens, and is available in your region. Someone in a standup says "we should try it". By Wednesday there is a ticket, by Thursday a branch, and by Friday morning the new build is serving ten per cent of traffic behind a flag.

The eval number that gets read is this one: *pass rate on the suite, new build, 57 items.* It is 36.8%. The old build's number, written in the README three months ago and never refreshed, is 57.9%. Somebody puts both in the PR description and writes "21 points worse, not shipping", and the migration is cancelled by a subtraction between two numbers that were never measured on the same items by the same judge in the same week.

**Both of those numbers are real and the difference between them is not.** The 57.9% came from the old build's answers scored against the old build's human labels. The 36.8% came from the new build's answers scored against labels written for the new build's answers. Different items are not the problem here — it is the same 57 items — the problem is that nobody ran the comparison, they ran two evaluations and subtracted.

Now make it worse, because worse is the common case. The person writing the PR wants to be fair to the new build, so they compare generously: the old build on dev, the new build on the held-out test set, because "the test set is the honest one". That reads 57.9% against 16.2% and the case is closed at 41.7 points. The paired answer on the *same* 37 held-out items is 29.7 points. The number went up because they made the comparison unpaired, not because the model got worse.

And the last variant, the one that actually ships: the new build is judged by a judge that was recalibrated for the new build's answer style — longer, more hedged, more "I'd be happy to help". That judge's pass rate on the old build's answers was 52.6%, on the new build's 64.9%. A change that added two sentences per answer reads as an **18.9 point improvement** on the held-out set, interval +8.1 to +32.4, and the gate passes. Nothing is broken. The gate was asked a question about the judge and reported the answer as a fact about the model.

> [!IMPORTANT]
> Every number in this lesson is arithmetic over this repository's shipped dataset and its shipped recorded judge runs. **None of it is a measurement of a real model, a real product, or a real vendor.** The verdicts come from the educational model described in [12.5](../module-12/lesson-05.md); the prices come from an illustrative table in `datasets/support.json`. Read every figure below as *the number this procedure produces on this data*, which is the only thing it is evidence about.

## How it works

A migration, properly, is five things and nothing else:

1. **Two recorded variants of the same system.** One is what is in production; one is what you want in production. In this repository they are `v1` (handbook-tuned prompt, retrieval on) and `v2` (generic prompt, no retrieval). Same questions, same judge, same items — so the only thing that moves is the thing you are evaluating.
2. **One judge, used for both sides.** Not the better judge, not a better judge for the new build. [06.2](../module-06/lesson-02.md) is why: a judge validated against one answer distribution is validated *on that distribution*.
3. **A paired comparison**, because both systems answered the same items.
4. **A gate**, which turns the comparison into a decision with an owner.
5. **A cache invalidation**, which is not a step you remember, it is a property of the key.

That is the whole procedure. Everything else — the dashboard, the PR template, the cost spreadsheet — is a presentation of it.

### Step one: two variants, one judge, the same items

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, wilson; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); [print(' ',v,'dev',wilson(sum(1 for it in d.items_for('dev') if j.verdict(it,v)),57),' test',wilson(sum(1 for it in d.items_for('test') if j.verdict(it,v)),37)) for v in ('v1','v2')]"
  v1 dev 57.9% (45.0%–69.8%)  test 45.9% (31.0%–61.6%)
  v2 dev 36.8% (25.5%–49.8%)  test 16.2% (7.7%–31.1%)
```

Those are two pass rates with two intervals, and on their own they say almost nothing: the dev intervals overlap between 45.0% and 49.8%, and a reader who stops here will conclude "they're within noise", which is not what the data says and not what the gate will say. **Two pass rates are not a comparison.** You need the pairing, because pairing cancels item difficulty — an item the old build found easy and the new build found hard contributes zero, and it is exactly the hard items that would otherwise drown the result in variance.

### Step two: the paired comparison, and the argument order

`paired_comparison(candidate_pairs, baseline_pairs)` returns `delta = A - B`, so **the candidate goes first**:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, paired_comparison; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); p=lambda v,s:[(it.label(v),j.verdict(it,v)) for it in d.items_for(s)]; c=paired_comparison(p('v2','dev'),p('v1','dev'),resamples=1000,seed=1); print('delta',round(c.delta,4),'ci',round(c.ci.lo,4),round(c.ci.hi,4),'fixed',c.fixed,'broke',c.broke,'ties',c.ties,'p',round(c.p_value,4))"
delta -0.2105 ci -0.3684 -0.0351 fixed 19 broke 7 ties 31 p 0.029
```

Read it left to right and it is the whole finding: on 57 items the new build is **21.1 points worse**, the paired 95% interval is −36.8 to −3.5 points and does not contain zero, 19 items the old build passed and the new build did not, 7 the other way, and 31 unchanged.

Now swap the arguments, which is the single most expensive mistake available in this course:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, paired_comparison; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); p=lambda v,s:[(it.label(v),j.verdict(it,v)) for it in d.items_for(s)]; b,c=p('v1','dev'),p('v2','dev'); f=paired_comparison(c,b,resamples=1000,seed=1); r=paired_comparison(b,c,resamples=1000,seed=1); print('candidate first: delta',round(f.delta,4),'fixed',f.fixed,'broke',f.broke); print('baseline  first: delta',round(r.delta,4),'fixed',r.fixed,'broke',r.broke)"
candidate first: delta -0.2105 fixed 19 broke 7
baseline  first: delta 0.2105 fixed 7 broke 19
```

**Same data, same function, opposite verdict.** The `fixed` and `broke` columns are counted relative to argument A: `fixed` is "B passed and A did not", so when A is the candidate, `fixed = 19` means *the migration broke nineteen items*. Pass the baseline first and the same 19 becomes `broke`, and `broke = 7` becomes `fixed` — a report that says **this migration fixed 19 items and broke 7**, on the worst run in the whole dataset, with a positive delta that reads as an improvement.

[`evallab/gate.py`](../../labs/common/evallab/gate.py) carries a scar from exactly this bug; its docstring says an earlier version passed baseline first "which inverted every branch". The names `fixed` and `broke` are the trap and the scar is the evidence. When you write this into your own migration script, do not read `fixed` and `broke` at all — recompute them from the two verdict lists yourself, where the sign of the item is visible.

### Step three: the gate, and the three things it reports

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, run_gate; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); p=lambda v,s:[(it.label(v),j.verdict(it,v)) for it in d.items_for(s)]; print(run_gate(p('v1','dev'),p('v2','dev'),tolerance=0.05,repeats=5,cost_per_call=d.cost['c-rubric-3b']['cost_usd']).to_json())"
{
  "blocked": true,
  "reason": "blocked: candidate is 21.1 points below the current build, over the 5-point tolerance; paired 95% interval -36.8 to -3.5 points (half-width +16.7)",
  "delta_points": -21.05,
  "ci": [
    -36.84,
    -3.51
  ],
  "calls": 285,
  "usd": 10.8129,
  "quarantined": []
}
```

Three numbers, and they are three different claims — which is why [10.3](../module-10/lesson-03.md) says the decision is a point estimate and the interval is *reported next to* it:

| field | what it claims | what it cannot claim |
|---|---|---|
| `blocked: true`, `delta_points: -21.05` | the candidate's pass rate is more than 5 points below the baseline's, on these items | that the true difference is 21.05 points |
| `ci: [-36.84, -3.51]` | the difference is plausibly between 37 and 4 points worse, and zero is not in there | that the interval's endpoints are the range of outcomes |
| `calls: 285`, `usd: 10.8129` | this decision cost 57 items × 5 repeats of judge calls at the shipped per-call price | anything about the real price of any real model |

The gate fires on the point estimate, and the interval is there so a human can see how much to trust it. `285` is `n × repeats`, and at `datasets/support.json`'s illustrative `$0.03794` per judge call the whole dev migration run is **$10.81**; dev plus test, both systems, five repeats, is **$17.83**. That is a real number for a fake price, and the arithmetic is the part that transfers.

### Step four: the cache invalidates itself

The thing people forget is that a migration invalidates every cached judge verdict, because the verdicts were produced by a model that no longer exists. [`cache_key`](../../labs/common/evallab/judge.py) makes that structural rather than a thing to remember:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, cache_key; d=load('support'); it=d.items_for('dev')[0]; kw=dict(variant='v2',judge_id='c-rubric-3b',prompt_hash='a1b2c3',decoding='temp=0',fewshot='0',answer_order='A,B'); a=cache_key(it,model_build='llama-3.2-3b-q4',**kw); b=cache_key(it,model_build='llama-3.2-3b-q5',**kw); c=cache_key(it,model_build='llama-3.2-3b-q4',**kw); print('item',it.id,'build q4 ->',a,' build q5 ->',b,' build q4 again ->',c); print('same build repeats:',a==c,' different build differs:',a!=b)"
item s01 build q4 -> d1a0e515  build q5 -> 1ded99fa  build q4 again -> d1a0e515
same build repeats: True  different build differs: True
```

`model_build` is one of nine fields in the key. Change the quantisation — `q4` to `q5` is the same weights and a different model — and the key changes, so the cache misses, so the run re-judges, so nobody can accidentally gate a migration on verdicts the old build produced. Over the 57 dev items and two builds that is 114 distinct keys out of 114.

The failure this prevents is the one [13.2](../module-13/lesson-02.md) is about, and in a migration it is silent in a specific way: the cache hits, the run costs nothing, the numbers come back in four seconds, and they are the *old* build's verdicts. A migration gate that completes in four seconds is a gate that read a cache.

### Step five: what the traces say, and what they cannot

The eval answers "did it get better". The traces answer "what does it cost", and `record` with a `variant=` is how you get the second system onto the same items:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, record, TraceStore; d=load('support'); [print(' ',v,'on',m,'cost $%.6f'%TraceStore.from_traces(record(d,n=57,split='dev',variant=v,model=m)).total_cost()) for v,m in (('v1','qwen3-1.7b'),('v2','qwen3-1.7b'),('v3','qwen3-0.6b'))]"
  v1 on qwen3-1.7b cost $0.000192
  v2 on qwen3-1.7b cost $0.000196
  v3 on qwen3-0.6b cost $0.000116
```

Moving from `v1` to `v2` costs 2% more per item (2 055 in / 1 448 out tokens versus 2 082 in / 1 480 out), because the new answers are marginally longer. Moving to the small model `v3` costs 40% less, at a cost in pass rate of 49 points on dev.

**And here is the honesty note that belongs in every migration write-up.** The same `TraceStore` reports `p50_end_to_end` of `1584.724 ms` for `v1` and for `v3` — identical to three decimal places, across two different models. That is not a coincidence and it is not a finding: `Tracer._sim_ms` seeds its durations from the trace id, so the same items always get the same simulated latency. **The latency panel in this repository cannot answer the migration's latency question**, and the only way to know that is to run both sides and notice that a number which must change did not.

### Step six: the slice table, which is where the decision actually lives

The whole-suite number is −21.1 points and it is the least useful number in the migration. Broken by slice:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, paired_comparison; from collections import defaultdict; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); s=defaultdict(list); [s[(it.slice or {}).get('intent','?')].append(it) for it in d.items_for('dev')]; [print('  %-14s n=%3d  delta %+6.1f pts  ci [%+6.1f,%+6.1f]  p=%.4f'%(k,len(v),100*paired_comparison([(i.label('v2'),j.verdict(i,'v2')) for i in v],[(i.label('v1'),j.verdict(i,'v1')) for i in v],resamples=1000,seed=1).delta,100*paired_comparison([(i.label('v2'),j.verdict(i,'v2')) for i in v],[(i.label('v1'),j.verdict(i,'v1')) for i in v],resamples=1000,seed=1).ci.lo,100*paired_comparison([(i.label('v2'),j.verdict(i,'v2')) for i in v],[(i.label('v1'),j.verdict(i,'v1')) for i in v],resamples=1000,seed=1).ci.hi,paired_comparison([(i.label('v2'),j.verdict(i,'v2')) for i in v],[(i.label('v1'),j.verdict(i,'v1')) for i in v],resamples=1000,seed=1).p_value)) for k,v in sorted(s.items())]"
  boundary       n= 16  delta  -25.0 pts  ci [ -56.2,  +6.2]  p=0.2891
  exception      n=  3  delta  +33.3 pts  ci [  +0.0,+100.0]  p=1.0000
  how_to         n=  9  delta  -55.6 pts  ci [ -88.9, -22.2]  p=0.0625
  out_of_scope   n=  5  delta  -40.0 pts  ci [-100.0, +40.0]  p=0.6250
  policy_fact    n= 24  delta   -8.3 pts  ci [ -29.2, +12.5]  p=0.7266
```

The `exception` slice *improves*, by 33.3 points, on three items, with an interval from zero to one hundred. That is one item. If you put that row in a PR description next to a green checkmark you have shipped a claim that "the new build handles edge cases better", and the claim rests on one flipped item out of three.

`how_to` is the row that matters: **−55.6 points on 9 items, interval −88.9 to −22.2, and zero is not in it.** That is the only slice on this data where the whole-suite verdict can be located in a specific place, and it is a place with a mechanism — the new variant has no retrieval step, so "how do I do X" questions are answered from parametric memory instead of the handbook. That is a sentence you can put in the PR, argue about, and act on. The −21.1 is not; it is an average over a thing that got much worse and a thing that got slightly better.

## Show me

From this repository, with no model, no API key and no network. The migration is `v1` → `v2`, the judge is `c-rubric-3b` (the rubric judge from [06.2](../module-06/lesson-02.md)) at five repeats, majority.

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, paired_comparison; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); p=lambda v,s:[(it.label(v),j.verdict(it,v)) for it in d.items_for(s)]; c=paired_comparison(p('v2','dev'),p('v1','dev'),resamples=1000,seed=1); print('delta',round(c.delta,4),'ci',round(c.ci.lo,4),round(c.ci.hi,4),'fixed',c.fixed,'broke',c.broke,'ties',c.ties,'p',round(c.p_value,4))"
delta -0.2105 ci -0.3684 -0.0351 fixed 19 broke 7 ties 31 p 0.029
```

The same comparison on 20 random dev items instead of all 57, three times:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, sample_items, paired_comparison; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); items=d.items_for('dev'); p=lambda sub,v:[(it.label(v),j.verdict(it,v)) for it in sub]; [print('  n=%3d seed=%d  delta %+6.1f pts  ci [%+6.1f,%+6.1f]  p=%.4f'%(size,seed,100*paired_comparison(p(sub,'v2'),p(sub,'v1'),resamples=1000,seed=1).delta,100*paired_comparison(p(sub,'v2'),p(sub,'v1'),resamples=1000,seed=1).ci.lo,100*paired_comparison(p(sub,'v2'),p(sub,'v1'),resamples=1000,seed=1).ci.hi,paired_comparison(p(sub,'v2'),p(sub,'v1'),resamples=1000,seed=1).p_value)) for size in (20,30,40,57) for seed in (1,2,3) for sub in [[items[k] for k in sample_items(items,size,strategy='random',seed=seed)]]]"
  n= 20 seed=1  delta  -10.0 pts  ci [ -45.0, +25.0]  p=0.7744
  n= 20 seed=2  delta  -15.0 pts  ci [ -40.0, +15.0]  p=0.5078
  n= 20 seed=3  delta  -25.0 pts  ci [ -50.0,  +5.0]  p=0.1797
  n= 30 seed=1  delta  -20.0 pts  ci [ -46.7,  +6.7]  p=0.2101
  n= 30 seed=2  delta  -20.0 pts  ci [ -40.0,  +3.3]  p=0.1796
  n= 30 seed=3  delta  -23.3 pts  ci [ -46.7,  +0.0]  p=0.1185
  n= 40 seed=1  delta  -17.5 pts  ci [ -37.5,  +5.0]  p=0.1671
  n= 40 seed=2  delta  -20.0 pts  ci [ -40.0,  -2.5]  p=0.0963
  n= 40 seed=3  delta  -22.5 pts  ci [ -45.0,  -2.5]  p=0.0784
  n= 57 seed=1  delta  -21.1 pts  ci [ -36.8,  -3.5]  p=0.0290
  n= 57 seed=2  delta  -21.1 pts  ci [ -36.8,  -3.5]  p=0.0290
  n= 57 seed=3  delta  -21.1 pts  ci [ -36.8,  -3.5]  p=0.0290
```

Read the top third of that table again. **At n = 20 the same migration produces drops of 10, 15 and 25 points from the same 57-item suite, and every interval contains zero.** The gate, which fires on the point estimate, blocks all three. It is not wrong to block — something did get worse — but a run that blocks on a 10-point drop with an interval from −45 to +25 is a gate that will block again next week for the same reason, and [13.3](../module-13/lesson-03.md) is about what happens to a gate after that happens three times.

### The same gate, on a change that adds two sentences

`v1padded` is the `v1` answers with two extra sentences and nothing else changed. The human label for `v1padded` is `v1`'s — `instrumented_run` maps it, and the dataset carries no separate labels because there is nothing to label separately.

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, run_gate; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); p=lambda v,s:[(it.label(v),j.verdict(it,v)) for it in d.items_for(s)]; [print(' ',s,run_gate(p('v1',s),p('v1padded',s),tolerance=0.05,repeats=5).reason) for s in ('dev','test')]"
  dev blocked: candidate is 5.3 points below the current build, over the 5-point tolerance; paired 95% interval -12.3 to +0.0 points (half-width +6.1)
  test passes: 2.7 points better; paired 95% interval +0.0 to +8.1 points (half-width +4.1)
```

**The same change, on the same judge, gives two opposite decisions.** On dev it blocks at 5.3 points against a 5-point tolerance, with an interval whose upper end is exactly zero. On test it passes at 2.7 points better. Neither number is a bug. What they say together is that a 5-point tolerance on a 57-item set is tighter than the set can measure, and a gate set tighter than its own resolution rate becomes a coin that lands the wrong way twice.

### The judge, on the new answers

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); [print(' ',v,s,confusion([(it.label(v),j.verdict(it,v)) for it in d.items_for(s)])) for v in ('v1','v2') for s in ('dev','test')]"
  v1 dev tp=30 fp=3 fn=0 tn=24 TPR=100.0% TNR=88.9% kappa=0.89
  v2 dev tp=20 fp=1 fn=0 tn=36 TPR=100.0% TNR=97.3% kappa=0.96
  v1 test tp=17 fp=0 fn=0 tn=20 TPR=100.0% TNR=100.0% kappa=1.00
  v2 test tp=6 fp=0 fn=0 tn=31 TPR=100.0% TNR=100.0% kappa=1.00
```

On this shipped data the judge looks **better** on the new build's answers than on the old one's — TNR 97.3% against 88.9% on dev. That is not a general result and you should not quote it as one; it is a property of a recorded run that was generated from the labels with an error pattern, and 59 of the 64 judge × variant × split cells in this dataset have `fn = 0`, so `TPR` is pinned at 100% nearly everywhere and the only real signal is in the `TNR` column.

The procedure is the point, not the value: **re-measure the judge on the new build's answers before you trust the delta**, because a judge validated on the old distribution is a claim about the old distribution. Had the table come out the other way — TNR 60% on the new build's answers — the correct response would be identical, and the migration would be waiting on a judge problem, not a model problem.

> [!NOTE]
> There is no `labs/module-15/` in this repository, and there is nothing to install. Every command above runs against [`labs/common/`](../../labs/common/) and `datasets/support.json`, both of which ship, using Python only. If you are following the course from a module zip, those two directories are the zip's contents.

## Try it

**Predict first**, on paper:

1. You compare the old build on dev (57.9%) against the new build on test (16.2%). Predict the number the PR will quote, predict the paired answer on those same 37 held-out items, and say which of the two you would defend in a review.
2. You call `paired_comparison(baseline, candidate)` instead of the other way round. Predict the sign of `delta`, the value of `fixed`, and the sentence a reader writes into the PR description from those numbers.
3. The migration is blocked. Predict the slice the damage is in, its size, and whether its interval contains zero.
4. The migration gate finishes in four seconds. Predict what that means, and which field in `cache_key` is responsible.
5. `p50_end_to_end` is identical for both builds. Predict the value, then say what a reader would conclude from the trace dashboard.

[Lab: evallab package](../../labs/common/)

1. **Write the migration script before you read another number.** Five functions — `load`, build both verdict lists, `paired_comparison`, `run_gate`, `cache_key` — and one print per result. Then put it in a file and run it twice; the second run must produce the same numbers, because every seed in the path is fixed. Write down which of the four numbers you would put in a PR title and which would be a lie.
2. **Break the argument order on purpose.** Swap the two `paired_comparison` calls and print `fixed` and `broke`. Then find the sentence in [`evallab/gate.py`](../../labs/common/evallab/gate.py)'s `run_gate` docstring that says this bug already happened once, and add a test to your own script that fails if `delta` comes back positive while your candidate's raw pass rate is lower than the baseline's.
3. **Build the slice table.** For each of the five `intent` values, the paired delta, the interval and `n`. Then pick the one slice that would block the migration on its own and write the two sentences that explain it in terms of what the change actually did to the system — not in terms of the number.
4. **Run the tolerance sweep.** `run_gate` for `tolerance` in 0, 2, 5, 10, 15, 20, 25 points, and mark where the decision flips for `v1` → `v2` and for `v1` → `v1padded`. Write the number you would set and the sentence explaining why it is not the number the gate "should" have.
5. **Prove the cache invalidates.** Over the 57 dev items, count distinct `cache_key` values for two `model_build` strings, and again with one character of `prompt_hash` changed. Then write the assertion that fails if your migration runner ever gates on a cache entry produced by the old build, and say what it costs when that assertion is absent.

## Break it

**Pass the baseline first to `paired_comparison`.** Same function, same data, `fixed = 7`, `broke = 19`, `delta = +0.2105`. The lie: **a migration report whose sign is a property of the argument list**, and the fixed/broke columns — the two numbers a reviewer actually reads, because they say "19 items got better" in words — point the other way.

**Subtract two pass rates from different splits.** 57.9% on dev against 16.2% on test reads as 41.7 points; the paired answer on the same held-out items is 29.7. The lie: **two evaluations subtracted is not a comparison**, and the difference between them is item difficulty, which is the largest term in the error.

**Re-validate the judge on the new build's answers and keep the old number if it looks worse.** The gate stays green, the number stays comfortable, and nobody notices that the measuring instrument changed. The lie: **a judge is calibrated on a distribution, and a migration moves the distribution** — so the migration's first task is re-running [06.3](../module-06/lesson-03.md), not shipping.

**Report the whole-suite delta and nothing else.** −21.1 points, one line, no mechanism. The lie: **an average of a thing that got much worse and a thing that got one item better is a number with no address**, and a reviewer cannot act on it, so the migration stalls in review instead of being fixed.

**Trust the latency panel.** `p50_end_to_end` is `1584.724 ms` for a 1.7B model and for a 0.6B model. The lie: **a number that cannot change is not a measurement**, and it is on the same dashboard as the cost column, which does change, which is what makes it credible.

**Run the migration on 20 items because it is quicker.** Drops of 10, 15 and 25 points from three seeds, every interval through zero, gate blocked every time. The lie: **the gate fires on a point estimate, so a small suite converts noise into a blocking verdict**, and a gate that blocks three times on noise gets switched off — which is [13.3](../module-13/lesson-03.md)'s ending and not a good place for your migration programme to arrive.

## Fix it

1. **Fix the comparison before you fix anything.** Candidate first, baseline second, and a test that the sign of `delta` matches the sign of the raw pass-rate difference. That assertion is three lines and it catches the most expensive bug in this lesson.
2. **Recompute `fixed` and `broke` from the two verdict lists**, where the sign of each item is visible, and print the item ids with them. Nineteen named items is a bug report; the number 19 is a statistic.
3. **Re-run the judge's confusion matrix on the new build's answers** before the delta is read, and put both rows in the PR. If the judge changed, the delta is not yet a fact about the model.
4. **Put the slice table in the report, not the whole-suite number.** The table is what names the mechanism; the average is what the dashboard already shows.
5. **Write the tolerance you set next to the resolution your suite has.** At 75% pass, 57 items give a half-width of 10.9 points and 300 items give 4.9 — [04.4](../module-04/lesson-04.md)'s arithmetic. A tolerance of 5 points on 57 items is a claim about five-point differences that the suite cannot make.
6. **Let the cache key do the invalidation.** Include the model build, the quantisation, the prompt hash and the judge id. If the run is fast, check that it re-judged rather than congratulating yourself.
7. **Say what the latency number is.** In a real system it comes from a real clock; in this repository it is seeded from the trace id and identical across models. A migration write-up that does not distinguish the two is a write-up that will be quoted.

## How do I know it works?

**Challenge, on dev**, with the 57 dev items, judge `c-rubric-3b`, five repeats, tolerance 5 points:

- **The comparison is paired and the argument order is tested.** `delta = -0.2105`, interval `[-0.3684, -0.0351]`, zero not in it, and an assertion that fails if the sign ever disagrees with the raw pass rates.
- **`fixed` and `broke` are recomputed and printed with item ids.** 19 and 7, named. You can read `s02`, `s03`, `s08`, `s30` and know they are the `how_to` and `boundary` items that lost retrieval.
- **The slice table is in the report, and one slice carries the decision.** `how_to`, n = 9, −55.6 points, interval `[-88.9, -22.2]`, with a mechanism in a sentence that does not mention the number.
- **The judge's confusion matrix appears twice**, once per build's answers, and you can say which direction it moved and what you would do in the other direction.
- **The cost of the decision is stated in model calls and in currency**, 285 calls on dev and 185 on test, at the shipped illustrative per-call price, with the price labelled illustrative.
- **The cache key is shown changing with `model_build`**, 114 distinct keys over 57 items and two builds, and the fast-run check is written down.

**Then one held-out validation**, on the **37 test items**, with the script unchanged and nothing re-tuned:

| | dev, 57 | held-out, 37 |
|---|---|---|
| Baseline pass rate | 57.9% (45.0%–69.8%) | 45.9% (31.0%–61.6%) |
| Candidate pass rate | 36.8% (25.5%–49.8%) | 16.2% (7.7%–31.1%) |
| Paired delta | **−21.1 points** | **−29.7 points** |
| Paired 95% interval | −36.8 to −3.5 | −54.1 to −8.1 |
| Items lost / gained | 19 / 7 | 15 / 4 |
| Unchanged | 31 | 18 |
| Sign-test p | 0.029 | 0.019 |
| Gate | blocked | blocked |

Four things in that table are the check, and the first is the one that matters.

- **The direction transfers and the size does not.** −21.1 on dev becomes −29.7 on the held-out split, an 8.6-point move in the estimate from 20 fewer items. The verdict — do not ship — is the same; the number in the PR is not. **Quote the held-out number and the dev number together, or quote neither.**
- **The paired interval excludes zero on both splits** (−3.5 and −8.1 as the near end), so this is evidence rather than a point estimate with a large error bar, which at n = 57 is exactly what you do not yet have.
- **The lost-to-gained ratio transfers.** 19 : 7 on dev is 2.7 to 1; 15 : 4 on test is 3.75 to 1. A migration that breaks four times what it fixes will break four times what it fixes on your users too, and the held-out run is the first evidence of your own rather than a borrowed one.
- **The gate blocks on the held-out split without ever having been tuned to it.** No tolerance was changed, no item was added, no slice was dropped. That is the whole of the 04.2 rule and the reason this table is worth more than the dev one.

## Use / don't use

**Do write the migration as a script with a fixed seed, not as a dashboard reading.** Every number above is reproducible from the repo root with the commands in this lesson. A migration decision that cannot be re-run in four minutes is a decision that cannot be reviewed, and one that cannot be reviewed is one somebody will re-litigate next quarter.

**Do compare on the same items with the same judge, always.** The pairing is what makes the interval mean something; the same judge on both sides is what makes the difference about the model rather than about the instrument.

**Do re-validate the judge on the new build's answers.** It is one extra confusion matrix and it is the difference between "the migration is bad" and "we are holding the ruler differently".

**Do put the slice table and the item ids in the report.** Nineteen named items is actionable on Monday. −21.1 points is a number somebody has to interpret, and the person who interprets it is not the person who fixed it.

**Do state the tolerance and the resolution together.** "5-point tolerance, 57 items, half-width 10.9 points at this pass rate" is one sentence and it inoculates the whole report against the question "is that a real difference?"

**Do keep the migration and the everyday PR gate separate.** A migration is a planned, one-off, expensive, whole-suite event with a human reading the slice table. A CI gate from [13.1](../module-13/lesson-01.md) is a daily, cheap, automated check on a slice. Mixing them produces either a migration that gets blocked by a flaky tolerance or a daily gate with a migration's budget.

**Don't compare across splits, or across weeks, or across labels.** The old build's number in the README was measured against labels written for the old build's answers. It is a historical fact and not a baseline.

**Don't trust `fixed` and `broke` as named.** Recompute them. The names describe the function's own A-versus-B convention and they invert the moment you swap the arguments.

**Don't gate a migration on a cached verdict.** The model build is in the key, so if you have done it properly this cannot happen — and if you skipped it, a four-second gate is the symptom.

**Don't put the whole-suite delta in the title.** Put the slice in the title. The whole-suite delta is the number the dashboard already has.

What teams actually do: a migration branch that runs both variants over the whole dev set, produces a fixed three-table report — pass rates with intervals, the paired delta with its interval and the item ids, and the slice table — and a `cache_key` sweep that forces every judge call to re-run. A human reads the slice table and writes the decision. The held-out split is run once, at the end, with nothing tuned, and if the two disagree the *split* is what gets investigated, because that is the one thing the team controls.

## Reflect

1. The migration is blocked at 21.1 points on dev and 29.7 on the held-out split. Write the three lines for the ticket that closes the migration, including the one number you refuse to quote and why.
2. You pass the baseline first by accident, and `fixed = 7`, `broke = 19`. Write the test that catches it, and the sentence you would put in the PR review that explains to the author why the number they are about to publish is the opposite of the truth.
3. The judge is re-validated on the new build's answers and its TNR drops from 88.9% to 60%. Write what the migration's status is now, what you would run next, and which of the two numbers in the table above you would keep in the report while you do it.
4. `p50_end_to_end` is identical across two model builds. Write the line you would put in a migration report to stop anybody reading the latency column as evidence, and say what you would need instrumented to replace it.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the argument that a model comparison is only worth what its eval set is, which is the reason this lesson fixes the set, the judge and the pairing before it looks at any number.
- Liang Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) — the source of the position, verbosity and self-preference biases. The `v1padded` run in this lesson is the verbosity probe from [07.3](../module-07/lesson-03.md) turned into a migration: the judge whose pass rate is higher on longer answers will tell you a padding change is an improvement, and it will be right about its own behaviour and wrong about the model.
- Samuel Bowyer et al., [The Mythos of Model
  Evaluation](https://arxiv.org/abs/2411.19994) (2024) — why the number in the README decays rather than stays true, which is the unpaired-comparison failure above in its general form: a score recorded at one moment, against one set of labels, read at another.
- Nathan Lambert et al., [RewardBench: Evaluating Reward Models for Language
  Modeling](https://arxiv.org/abs/2403.13787) (2024) — the reason a migration report states which instrument produced each number. RewardBench exists because reward models were being compared without being measured, and the same is true of a judge that gets swapped mid-migration.
