---
id: "15.3"
module: 15
minutes: 20
practice_minutes: 45
prerequisites: ["15.2", "06.1"]
objectives:
  - Explain why labelling is the one part of the eval loop that does not parallelise, using the sample-size arithmetic from 04.4 rather than an appeal to effort.
  - Show, on measured numbers, that agreement between label sources is a property of the instructions rather than of the sources, holding the model and the items fixed.
  - Compute the review-queue size that a given disagreement rate implies at your own eval-set size, and state it as a cost in a decision.
  - Design a labelling round that measures agreement as a side effect, rather than one that assumes it and discovers otherwise.
volatility: implementation
sources:
  - title: "Wikipedia — Cohen's kappa"
    url: https://en.wikipedia.org/wiki/Cohen%27s_kappa
  - title: "Brown, Cai & DasGupta — Interval estimation for a binomial proportion"
    url: https://doi.org/10.1214/ss/1009213286
  - title: "Yinhan EvalGen — Who Validates the Validators?"
    url: https://arxiv.org/abs/2404.12272
  - title: "LLM-as-a-Judge: A Survey"
    url: https://arxiv.org/abs/2411.15594
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 15.3 · Annotation at scale, and inter-annotator agreement

Every other step in this loop is arithmetic or a model call, and both of those get cheaper when you need more of them. Labelling does not: a person reads an answer, decides, and types. It is the one step that scales linearly with the number of items and does not get cheaper, and the lesson is what to do when the volume is too large for the care that made [06.1](../module-06/lesson-01.md) correct — without pretending the trade is free.

## Why it matters

[06.1](../module-06/lesson-01.md) said something that this module is built on, and it is worth repeating exactly: **agreement is a property of your instructions, not of your annotators.** A team that follows it labels carefully, reads a sample back, finds kappa 0.89, and concludes the method works. That is correct, and it works at 57 items because one engineer with domain knowledge and unlimited time is the instrument.

Then two things happen, both ordinary.

The eval set needs to grow. [04.4](../module-04/lesson-04.md)'s arithmetic says the half-width on a proportion at 75% pass is 10.9 points at 57 items, 4.9 at 300, and 3.5 at 600 — and a team that wants to resolve a five-point difference, which is what [10.3](../module-10/lesson-03.md)'s tolerance asks for, needs to be in the hundreds. So the 57 becomes 600.

And the queue does not. Three annotators are hired, or a contractor is engaged, or the same engineer is asked to label between other work — and throughput goes up threefold or tenfold. The queue drains. The dashboard fills with labelled items. Everything the team measures gets better.

**And the labels get worse, silently, in a direction nobody measures.** There is no event. No error is raised. The pass rate moves by a point or two, the gate still blocks, the pull requests still carry a number. Six months later somebody re-reads a sample and finds a category that was applied inconsistently for four months, and the fix is to re-label, and re-labelling 600 items is the thing that was supposed to be unnecessary.

The sentence to take from this lesson is the one the arithmetic supports:

> **You can buy throughput, and the price is agreement, and the price is paid silently unless you measure it on every round.**

"Unless you measure it" is the whole lesson. Not "unless you measure it once". Every round, every instruction change, every new annotator, every new slice.

## How it works

### The arithmetic that forces the decision

Two numbers, and they come from different places. The first is measured here; the second is yours.

The first: how much agreement costs you. Measured disagreement rate over the 57 dev items, with the model held fixed at `llama-3.2-3b` and the answers held fixed at `v1`, varying **only the instructions**:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion; d=load('support'); f=lambda jid: confusion([(i.label('v1'), MajorityJudge(RecordedJudge(d,jid),repeats=5).verdict(i,'v1')) for i in d.items_for('dev')]); [print('  %-18s model %-14s prompt %-14s shots %d  kappa %.3f  disagree %2d of %2d (%.1f%%)'%(j['id'],j['model'],j['prompt_variant'],j['fewshot'],f(j['id']).kappa,f(j['id']).fp+f(j['id']).fn,f(j['id']).n,100*(f(j['id']).fp+f(j['id']).fn)/f(j['id']).n)) for j in d.judge_menu if j['model']=='llama-3.2-3b']"
  c-plain-3b         model llama-3.2-3b   prompt plain          shots 0  kappa 0.568  disagree 12 of 57 (21.1%)
  c-rubric-3b        model llama-3.2-3b   prompt rubric         shots 0  kappa 0.894  disagree  3 of 57 (5.3%)
  c-step-3b          model llama-3.2-3b   prompt stepwise       shots 2  kappa 1.000  disagree  0 of 57 (0.0%)
  c-crit-3b          model llama-3.2-3b   prompt critique_first shots 2  kappa 1.000  disagree  0 of 57 (0.0%)
  c-rubric-3b-fs3    model llama-3.2-3b   prompt rubric         shots 3  kappa 1.000  disagree  0 of 57 (0.0%)
  c-rubric-3b-verb   model llama-3.2-3b   prompt rubric         shots 0  kappa 0.930  disagree  2 of 57 (3.5%)
```

Same model. Same 57 items. Same answers. Five sets of instructions, and the disagreement rate runs from **0.0% to 21.1%**. One of those rows is `plain` — "You are grading an answer. Is it good? Reply PASS or FAIL" — and it produces four times the disagreement of the rubric prompt. Nothing else changed.

> [!NOTE]
> This repository ships **no multi-annotator data**. The only two label sources over the same items are the human labels and the recorded judge verdicts, so every agreement figure below is a property of this course's shipped recording and not evidence about any real annotator or any real model. What the table demonstrates is the *procedure* — hold the items and the model fixed, change only the instructions, watch the disagreement rate — and that procedure is what you run on your own annotators.

The second number is the review queue. Disagreement is not free: every disagreement is an item somebody has to adjudicate before the label can be used. At the two measured rates:

| disagreement rate | 57 items | 300 items | 600 items | 1200 items |
|---|---|---|---|---|
| 5.3% (the rubric prompt) | 3 | 16 | 32 | 63 |
| 21.1% (the plain prompt) | 12 | 63 | 126 | 253 |

Same set, same size, same reviewers' time — **four times the adjudication queue** from one line of instructions. This is the number that belongs in a planning conversation, and it is usually the first time anybody has written it down.

And the labelling hours, at a rate you supply:

| items | at 60 an hour | at 200 an hour |
|---|---|---|
| 94 (this dataset, dev + test) | 1.6 h | 0.5 h |
| 300 | 5.0 h | 1.5 h |
| 600 | 10.0 h | 3.0 h |
| 1200 | 20.0 h | 6.0 h |

60 and 200 are illustrative rates you replace with your own; the shape is the point. **Throughput scales, the queue does not shrink, and the review is done by the most expensive person on the team** — because the person who can adjudicate is the person who wrote the instructions.

### Agreement is not a number you report once

The second thing [06.1](../module-06/lesson-01.md) implies and this module makes expensive is that kappa on 57 items is not a stable number:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, judge_metrics; d=load('support'); p=lambda jid,v,s:[(i.label(v), MajorityJudge(RecordedJudge(d,jid),repeats=5).verdict(i,v)) for i in d.items_for(s)]; [print('  %-14s %-3s kappa %.3f  95%% interval [%.3f, %.3f]  half-width %.3f'%(a,v,judge_metrics(p(a,v,s),resamples=1000,seed=12345).kappa,judge_metrics(p(a,v,s),resamples=1000,seed=12345).ci_of('kappa').lo,judge_metrics(p(a,v,s),resamples=1000,seed=12345).ci_of('kappa').hi,judge_metrics(p(a,v,s),resamples=1000,seed=12345).ci_of('kappa').hi-judge_metrics(p(a,v,s),resamples=1000,seed=12345).ci_of('kappa').lo)) for a in ('c-rubric-3b','c-plain-3b') for v in ('v1','v2') for s in ('dev',)]"
  c-rubric-3b    v1  kappa 0.894  95% interval [0.787, 1.000]  half-width 0.213
  c-rubric-3b    v2  kappa 0.962  95% interval [0.872, 1.000]  half-width 0.128
  c-plain-3b     v1  kappa 0.568  95% interval [0.382, 0.750]  half-width 0.368
  c-plain-3b     v2  kappa 0.399  95% interval [0.229, 0.591]  half-width 0.362
```

`0.894` with a 95% interval of `[0.787, 1.000]`. On 57 items your agreement figure has an uncertainty of about ±0.11 — which means **"our annotators agree at 0.89" and "our annotators agree at 0.78" are not distinguishable**, and a round that reports `0.89` has learned very little about whether the round was good.

Two artefacts to notice while you are reading it. The interval's top is exactly `1.000` on two of the four rows, and that is not a real bound: kappa cannot exceed 1, so a percentile bootstrap piles resamples up against the ceiling and the top of the interval is a property of the arithmetic rather than of the data. And the two rows for the same judge, `v1` and `v2`, differ by more than one half-width — **the same instructions, the same annotators, the same model, a different set of answers, and a different agreement figure.** If the answer distribution changes, agreement changes, and it is not a property of the people.

And the granularity:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion, cohens_kappa; d=load('support'); j=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); pairs=[(i.label('v1'), j.verdict(i,'v1')) for i in d.items_for('dev')]; base=list(pairs); k0=cohens_kappa(confusion(base)); print('  as labelled: kappa %.3f'%k0); [ (base.__setitem__(j2,(base[j2][0],1-base[j2][1])), print('  after %d flipped label(s): kappa %.3f'%(i+1,cohens_kappa(confusion(base))))) for i in range(4) for j2 in [next(x for x,(h,_) in enumerate(base) if h==0)]]"
  as labelled: kappa 0.894
  after 1 flipped label(s): kappa 0.858
  after 2 flipped label(s): kappa 0.894
  after 3 flipped label(s): kappa 0.858
  after 4 flipped label(s): kappa 0.894
```

**One label out of 57 moves kappa by 0.036**, which is a third of the interval's half-width, and the movement oscillates as the same pattern is applied repeatedly. A single annotator's disagreement with the consensus is worth more than a third of the uncertainty in the consensus.

That sensitivity is a share-of-the-set effect: one label is `1/57` of the set here and `1/600` of a larger one, a factor of about 10.5 — so in a 600-item set the same single disagreement moves the figure roughly a tenth as much. *That is proportional reasoning from the measured `0.036`, not a measurement*; this 57-item set cannot tell you the figure at 600. What it does tell you is the shape of the trade, and the shape is the point of the paragraph that follows.

### What to do instead of "be more careful"

Four moves, in the order they should be tried.

1. **Make the rule decidable, and then automate it.** [15.2](../module-15/lesson-02.md) is the lesson: if a failure has a property a program can decide, it does not need an annotator at all, and the disagreement rate for that category is exactly zero and stays zero. Across the 94 items and three variants in this dataset there are 282 human-labelled cells, and **78 of them carry the `no_citation` category** — a single regex decides all of them. **Removing a category from the queue is worth more than any amount of training on it.**

2. **Write the instructions as examples, not as adjectives.** The five prompts above differ in exactly this way: `plain` says "is it good", `rubric` says "PASS only if all three hold", `stepwise` asks three yes/no questions. The disagreement rate tracks that, 21.1% → 5.3% → 0.0%. Fewer than three annotators are needed per item once the rule is written as a decision procedure.

3. **Overlap-sample every round, and treat the agreement number as a release criterion.** Not a report, not a dashboard tile — a criterion, with a floor, that the round has to clear before its labels go into the suite. "kappa below 0.7 on the overlap sample" is a stopping condition. "Our annotators are careful" is not.

4. **Treat any instruction change as a new round.** Adding a category, rewording a rule, adding few-shot examples — every one of these is a `prompt_hash` change in [05.3](../module-05/lesson-03.md)'s key, so it invalidates the judge cache, and it invalidates your agreement measurement in exactly the same way. Re-measure, do not extrapolate.

### The trade, stated honestly

There is a version of this lesson that says "annotation at scale is solved by better tooling", and it is not true, and the useful thing is being able to say why in one paragraph:

> You can buy throughput three ways. **More annotators** multiplies disagreements and multiplies the adjudication queue proportionally. **Faster annotators** — less context, more examples, less time — reduces agreement by an amount you cannot predict and must measure. **Fewer, better items** — stratifying instead of sampling widely, so every item is in a slice that matters — reduces the number of labels needed without reducing what you know. Only the third is free, and it is available first, before anybody is hired.

## Show me

Everything runs from the repo root with Python and no network. There is no annotation queue in this repository, no annotator accounts and no multi-annotator data; what ships is one human label set and one recorded judge per configuration, which is enough to run the *comparison* the lesson is about and not enough to be evidence about people.

The measurement that carries the lesson, in one command:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion; d=load('support'); f=lambda jid: confusion([(i.label('v1'), MajorityJudge(RecordedJudge(d,jid),repeats=5).verdict(i,'v1')) for i in d.items_for('dev')]); [print('  %-18s model %-14s prompt %-14s shots %d  kappa %.3f  disagree %2d of %2d (%.1f%%)'%(j['id'],j['model'],j['prompt_variant'],j['fewshot'],f(j['id']).kappa,f(j['id']).fp+f(j['id']).fn,f(j['id']).n,100*(f(j['id']).fp+f(j['id']).fn)/f(j['id']).n)) for j in d.judge_menu if j['model']=='llama-3.2-3b']"
  c-plain-3b         model llama-3.2-3b   prompt plain          shots 0  kappa 0.568  disagree 12 of 57 (21.1%)
  c-rubric-3b        model llama-3.2-3b   prompt rubric         shots 0  kappa 0.894  disagree  3 of 57 (5.3%)
  c-step-3b          model llama-3.2-3b   prompt stepwise       shots 2  kappa 1.000  disagree  0 of 57 (0.0%)
  c-crit-3b          model llama-3.2-3b   prompt critique_first shots 2  kappa 1.000  disagree  0 of 57 (0.0%)
  c-rubric-3b-fs3    model llama-3.2-3b   prompt rubric         shots 3  kappa 1.000  disagree  0 of 57 (0.0%)
  c-rubric-3b-verb   model llama-3.2-3b   prompt rubric         shots 0  kappa 0.930  disagree  2 of 57 (3.5%)
```

Six configurations, one model, one item set, one answer set, `0.0%` to `21.1%`. Whatever else you take from this module, take the shape of that table: **when you want to know why agreement is what it is, hold everything else still and change the instructions.**

The review queue it implies, at your own set size:

```console
$ py -c "print('  rate     n=57   n=300  n=600  n=1200'); [print('  %4.1f%%  %5.0f  %5.0f  %5.0f  %5.0f'%(100*r,57*r,300*r,600*r,1200*r)) for r in (3/57, 12/57)]"
  rate     n=57   n=300  n=600  n=1200
   5.3%      3     16     32     63
  21.1%     12     63    126    253
```

Those two rates are measured above — `3 of 57` and `12 of 57`. The rest of each row is arithmetic. That is the honest shape of any cost estimate: **one measured number and four multiplications.**

## Try it

**Predict first**, on paper:

1. Five instruction sets, one model, 57 items. Predict which one produces the most disagreement and by roughly how much, before you run it. Then say what in the prompt text you expected to cause it.
2. Your disagreement rate is 5.3% and you are moving from 57 items to 600. Predict the size of the adjudication queue at each size, and predict whether it grows linearly.
3. Kappa is 0.894 with a 95% interval of `[0.787, 1.000]`. Predict the largest honest claim you can make about your annotators from that one number.
4. You flip one label in a set of 57 and kappa moves by 0.036. Predict what the same single flip does in a set of 600, and say what that tells you about what a bigger set actually buys.

[Lab: evallab package](../../labs/common/)

1. **Write the labelling instructions twice** — once as adjectives ("a good answer is accurate and complete") and once as a decision procedure (the three numbered rules in `c-rubric-3b`'s rubric, with the same few-shot examples). Score both as label sources against the same human labels on the same 57 dev items, and write down the disagreement rate for each. This is the experiment above, run on your own text.
2. **Build the review-queue calculator.** A function that takes a measured disagreement rate and a target `n` and returns the queue size, the hours at your rate, and who has to do it. Run it for `n` in 57, 300, 600 and 1200, and paste the four rows into whatever planning document your team uses.
3. **Find the largest decidable category in your own taxonomy.** Take the shipped `human[*].category` values, and for each ask whether a program could decide it from the answer plus the reference. Report how many of the 282 labelled cells a perfect verifier would remove from the queue. This is the [15.2](../module-15/lesson-02.md) exercise seen from the queue's side.
4. **Measure the interval on your own agreement figure** with `judge_metrics`, and plot it at `n` = 57, 200, 600, 1200 by bootstrapping your own set down. Then write the floor you would set for a round, as a number, and the action you take when the round misses it.
5. **Change one instruction and re-measure.** Add one category or reword one rule, print `cache_key` before and after to show the hash moved, then re-run the disagreement rate and write the delta. The delta is the price of the change, and it should be in the pull request that makes the change.

## Break it

**Hire more annotators and treat throughput as throughput.** Three annotators instead of one, three times the items per week, three times the adjudication queue. The lie: **you have bought three times the volume and one third of the care per item**, and the pass rate has moved by a point or two in a direction nobody is measuring.

**Measure agreement once, at the start, and never again.** `kappa = 0.894` in week one. The lie: **an agreement figure is a property of an instruction set and an item set, both of which change**, and a stale figure is worse than none because it is quoted as evidence.

**Treat a small agreement figure as an annotator problem.** "The new contractors don't understand the task" and the fix is more training. The lie: **the same annotators on the same items agree much better under the rubric prompt**, so the variable you changed was the instructions, and the training you bought was for the wrong variable.

**Report kappa with three decimals and no interval.** `0.894`. The lie: **a number presented at a precision the data cannot support reads as a fact about the annotators rather than as an estimate about a round**, and one label moves it by 0.036.

**Scale the item count and assume the agreement scales too.** 57 items at kappa 0.89 → 600 items at kappa 0.89, asserted without measuring. The lie: **a larger set gives a better *estimate* of agreement, not better agreement** — the single-label sensitivity drops from 0.036 to about 0.003 and nothing about the labelling got more careful.

**Keep adjudicating with the most expensive person, forever.** Every disagreement goes to the person who wrote the instructions. The lie: **the adjudication queue grows with the item count and so does the bill for your best engineer**, and the queue is the thing nobody budgeted.

**Adjudicate without recording what was decided.** The labels settle; the reason does not. The lie: **the next round's instructions are written from the labels alone**, so the disagreement that was resolved by a person becomes an undocumented exception, and the exception is repeated until somebody notices.

## Fix it

1. **Remove decidable categories from the queue first.** Before adding annotators, ask [15.2](../module-15/lesson-02.md)'s question per category and write a check for every answer that is yes. This is the only throughput you can buy for free.
2. **Write the instructions as a decision procedure.** Numbered rules, explicit conditions, a worked example per rule — the `stepwise` and `rubric` rows above, not the `plain` row. Measure the disagreement rate after every rewrite, because the rewrite is the thing that changed.
3. **Overlap-sample every round and make agreement a gate, not a report.** A fixed overlap fraction on every batch, a stated floor, and a written action when the round misses it.
4. **Report the interval, not the point.** `0.894 (0.787–1.000)` on 57 items. If the floor you need cannot be resolved at your current `n`, either raise `n` or fix the instructions — those are the only two answers.
5. **Re-measure after every instruction change, and treat it as a prompt change.** It invalidates the judge cache by the same mechanism, so put both in the same pull request and the same regression test.
6. **Stratify before you scale.** Every item lands in a slice somebody cares about, from [04.3](../module-04/lesson-03.md). A smaller set that is entirely in-slices beats a larger one that is mostly `policy_fact`, and it is the same number of labels.
7. **Budget the queue, not the labels.** Disagreement rate × item count = adjudication items, adjudicated by your most expensive reviewer. Write that line in the planning doc; it is the number that changes people's minds.
8. **Keep the decision, not just the label.** What was in dispute, who decided, and the sentence that will make the next annotator agree. That record *is* the improved instructions.

## How do I know it works?

**Challenge, on dev**, with the 57 dev items and `c-rubric-3b`:

- **Your instructions are written as a decision procedure**, with at least one worked example per rule, and the rewrite was measured rather than assumed.
- **Every category in your taxonomy has a decidability verdict** written next to it, and every decidable one has a check. The queue this round contains no decidable category.
- **The overlap sample's disagreement rate is a number with a queue size beside it** — `5.3%`, 3 items at 57, 32 at 600 — and the floor is written down.
- **Agreement is reported with its interval**, and you can say the largest claim the interval supports. `0.894 (0.787–1.000)` supports "agreement is high", not "agreement is 0.89".
- **Every instruction change in the last three months has a re-measurement** attached to it, and `cache_key`'s `prompt_hash` moved in the same commit.
- **The adjudication queue has an owner and a turnaround time**, and the owner is not the person who wrote the instructions unless the queue is very small.

**Then one held-out validation**, on the **37 test items**, with the same instructions and no re-writing:

| | dev, 57 | held-out, 37 |
|---|---|---|
| Rubric prompt, disagreement | 3 of 57 (5.3%) | 0 of 37 (0.0%) |
| Rubric prompt, kappa | 0.894 | 1.000 |
| Rubric prompt, kappa 95% interval | 0.787 – 1.000 | — |
| Plain prompt, disagreement | 12 of 57 (21.1%) | 12 of 37 (32.4%) |
| Plain prompt, kappa | 0.568 | 0.380 |
| Stepwise prompt, disagreement | 0 of 57 (0.0%) | 0 of 37 (0.0%) |
| Stepwise prompt, kappa | 1.000 | 1.000 |
| Same instructions, different answers (`v1` → `v2`) | 0.894 → 0.962 | — |

Four things in that table are the check.

- **The ranking of the instructions transfers.** Rubric above plain on dev and on test, stepwise at the top on both, with the same model and the same held-out items. The claim that the instructions drive agreement is not an artefact of the 57 items it was measured on.
- **The two disagreement rates moved in opposite directions, and neither dev figure predicted its own held-out value.** The rubric prompt went from `3 of 57 (5.3%)` to `0 of 37 (0.0%)`; the plain prompt went from `12 of 57 (21.1%)` to **`12 of 37 (32.4%)`** — the same number of disagreements over two thirds as many items. A round that reported `21.1%` and stopped would have understated its own held-out rate by a third. **This is the single most important line in the lesson**: a disagreement rate is an estimate about a batch, and the batch it was estimated on is not the batch it will be used on.
- **The rubric's held-out kappa went *up*, from 0.894 to 1.000.** Read that carefully, because it is the same fact from the other side: the instructions that produced 3 disagreements on dev produced 0 on test. Either the round was better than reported, or the held-out 37 items happen to be ones this judge handles cleanly — and **you cannot tell which from the number**, which is why the interval on dev (`±0.11`) and the raw disagreement count are the things you report rather than the kappa.
- **The same instructions on a different set of answers moved kappa by 0.068** — `0.894` on `v1` to `0.962` on `v2`, same model, same annotators, same prompt. Agreement is a property of the instructions *and* the items. A round's figure is a fact about a round, and the sentence that keeps it honest is: *this is what these instructions achieved on these items, measured once.*

## Use / don't use

**Do automate the decidable categories before you hire anybody.** 78 of the 282 labelled cells in this dataset carry the `no_citation` category, and a three-line regex decides all of them, deterministically and for free. Every category you can remove is a category that cannot disagree.

**Do write instructions as decision procedures.** Numbered rules, explicit conditions, an example per rule. Measured on this data: 21.1% disagreement down to 5.3% down to 0.0% as the prompt goes from "is it good" to "three rules" to "three questions and a verdict".

**Do overlap-sample every batch and set a floor.** Agreement is a release criterion. A round that misses the floor gets its instructions fixed before its labels are used, not after.

**Do report the interval and the queue size.** `0.894 (0.787–1.000)` and "3 items to adjudicate at 57, 32 at 600". Both are more useful than the point estimate and neither costs anything to produce.

**Do re-measure after every instruction change.** Adding a category is a new round. It changes the judge cache's `prompt_hash` and your agreement in the same commit, so measure both.

**Do stratify instead of scaling.** [04.3](../module-04/lesson-03.md)'s sampler gives you the mix without the volume. It is the one throughput that is free.

**Do keep the adjudication record.** What was disputed, who decided, the sentence that settles it next time. That record is the next version of the instructions.

**Don't hire for throughput without buying agreement at the same time.** More annotators multiplies the queue; faster annotators reduces agreement by an amount you cannot predict. Either one without a measurement is a purchase you cannot evaluate.

**Don't treat a single kappa as a durable property.** It is a property of an instruction set and an item set, both of which change, and on 57 items its uncertainty is about ±0.11.

**Don't assume a bigger set agrees better.** It agrees *more precisely*. The sensitivity of the figure to one label falls; the care per label is unchanged.

**Don't let the adjudication queue run on your best engineer indefinitely.** It scales with the item count and it is invisible on the dashboard, which is why it is the first thing to go when the quarter gets tight — and the first thing whose loss shows up as "the numbers are off lately".

What teams actually do: a labelling round is a batch of items, a fixed overlap fraction, a decision procedure in a versioned document, a measured agreement with an interval, a queue size in items and hours, and a floor that has to be cleared before the batch enters the suite. The batch that misses the floor goes back to its instructions, not to its annotators. And once a quarter somebody reads 30 random labels against the decision procedure and updates the document — which is the whole mechanism, and which is why the figure is stable rather than decaying.

## Reflect

1. Your disagreement rate moves from 5.3% to 12% after you add two annotators and double the volume. Compute the queue at 57 and at 600 items before and after, and write the three sentences that would go in a retrospective explaining what was bought.
2. The overlap sample gives kappa 0.78 with an interval of `[0.62, 0.91]`, and your floor is 0.85. Write the decision you make, in three sentences, and say what you would have to change to make the decision easier.
3. Someone proposes relabelling all 600 items after a category is added. Write the argument against it that is not "it's expensive", using the single-label sensitivity number from this lesson.
4. Your adjudication queue is 63 items a round and the owner is the person who wrote the instructions. Write the restructure you would propose, and say what it costs and what it buys.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the source of the
  claim this module rests on: annotation quality is a property of the instructions, so the leverage is in the instructions and in how many labels you need, not in how hard you push the people doing the labelling.
- [Cohen's kappa](https://en.wikipedia.org/wiki/Cohen%27s_kappa) — the plain-language
  treatment, including the two critiques that matter at scale: kappa depends on prevalence, so a set where almost everything passes reports a low kappa for the same underlying care, and a kappa on `n` items is an estimate with an interval rather than a property of a set of people.
- Brown, Cai & DasGupta, [Interval estimation for a binomial
  proportion](https://doi.org/10.1214/ss/1009213286) (2001) — why every rate in this module is quoted with an interval, and the arithmetic behind the 10.9-point half-width at 57 items that forces the set to grow in the first place.
- Yinhan, [EvalGen — Who Validates the Validators?](https://arxiv.org/abs/2404.12272) — criteria
  drift: what happens to an eval set when the standard moves underneath it, which is the failure mode of a labelling round whose instructions are revised without a re-measurement.
- [LLM-as-a-Judge: A Survey](https://arxiv.org/abs/2411.15594) — the taxonomy of judge designs,
  and the background for treating a judge as one more label source with an agreement rate rather than as an oracle.
