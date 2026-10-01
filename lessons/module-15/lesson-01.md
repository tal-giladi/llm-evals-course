---
id: "15.1"
module: 15
minutes: 18
practice_minutes: 40
prerequisites: ["04.4", "02.3"]
objectives:
  - State what a public benchmark measures and what it structurally cannot measure about a product with more than one kind of question.
  - Detect the contamination analogue you can run yourself — selecting on the set you report on — and produce the held-out number for the same selection.
  - Run the overlap check on a local eval set in one line, and explain why no equivalent check exists for a public benchmark.
  - Decide, for a given decision, whether a benchmark score is admissible evidence, and write the sentence that says which set the decision must be made on.
volatility: implementation
sources:
  - title: "MT-Bench human judgments (lmsys) — CC-BY-4.0"
    url: https://huggingface.co/datasets/lmsys/mt_bench_human_judgments
  - title: "HelpSteer2 (nvidia) — CC-BY-4.0"
    url: https://huggingface.co/datasets/nvidia/HelpSteer2
  - title: "JudgeBench (ScalerLab) — MIT"
    url: https://huggingface.co/datasets/ScalerLab/JudgeBench
  - title: "Cheng Xu et al. — Benchmark Data Contamination of Large Language Models: A Survey"
    url: https://arxiv.org/abs/2406.04244
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 15.1 · Public benchmarks and contamination

Benchmarks are the most quoted and least inspected numbers in this field, and the two facts that follow from that are the whole lesson: a benchmark measures one distribution, and it is measured by people who can be helped by the number. This lesson is about what a public score is good for, what it is structurally unable to tell you, and the one contamination check you can run on your own set in one line — which you cannot run on a benchmark, because the benchmark's test items are public.

## Why it matters

Here is how it actually goes.

A vendor's model card says it beats the previous version on a public multi-turn benchmark. Somebody forwards the link into your team's channel. Somebody else, who is doing you a favour, does the arithmetic and posts a message: *"we're 4 points behind on the thing their marketing is built on."* The reply is that you are "probably fine" — and the argument stops there, because the next question is the one nobody can answer: **4 points behind on what, measured how, against which questions?**

You cannot answer it. That is not reluctance; it is structure. A published benchmark score arrives as one number, with a protocol you did not choose, over a question mix you did not write, sometimes with the answer key available on the internet. You cannot re-run it on your items, you cannot cut it by slice, you cannot compute an interval around it, and — this is the part that matters — **you cannot check whether the model has seen the questions.** Every model and every fine-tune built after the benchmark's publication is a candidate for having memorised some of them, and the benchmark gives you no way to tell which ones.

Now the part that actually costs money. Your product is not one distribution. This repository's eval set has five kinds of question in it, and they are not interchangeable:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load; from collections import Counter; d=load('support'); [print(' ',s,dict(sorted(Counter((it.slice or {}).get('intent','?') for it in d.items_for(s)).items()))) for s in ('dev','test')]"
  dev {'boundary': 16, 'exception': 3, 'how_to': 9, 'out_of_scope': 5, 'policy_fact': 24}
  test {'boundary': 15, 'how_to': 10, 'out_of_scope': 2, 'policy_fact': 10}
```

`policy_fact` is 24 of 57 dev items. A single number over your set is, to within a rounding error, a number about `policy_fact`. **A benchmark score has one distribution and yours has five, so a benchmark number is a statement about a distribution you do not have** — and on the held-out split the smallest slice here is two items, which is not a slice you can say anything about and is the reason [10.4](../module-10/lesson-04.md) exists.

> [!CAUTION]
> **Nothing in this course is a published benchmark result, and no benchmark was run to produce any number in it.** The judge verdicts come from this repository's shipped educational model, not from a real LLM. The dataset is generated and original. Where a real public result is named below it is attributed to the source that published it and marked as theirs. If you carry a number out of this repository and quote it, quote it as *this course's arithmetic on this course's data* — never as a benchmark score, a model comparison, or a result about any named system.

## How it works

### What a benchmark actually measures

Three things, and only three things:

1. **A fixed question set**, released publicly, with the answers or reference answers released too.
2. **A fixed protocol**: what the system is shown, how many turns, how answers are scored, and by what.
3. **A published aggregate** over that set, so two submissions from two labs are comparable.

That third property is the entire value, and it is real. It is the reason nobody has to build an eval suite to compare two models, and it is why the numbers in a model card are worth reading at all. What it buys is comparability *across submissions on one set*. What it does not buy is a statement about your users.

The three sets this course's method was shaped by, from [`references/README.md`](../../references/README.md), none of which ships here:

| set | what it is | licence |
|---|---|---|
| [MT-Bench human judgments](https://huggingface.co/datasets/lmsys/mt_bench_human_judgments) | expert pairwise judgements on multi-turn answers, from [Zheng et al.](https://arxiv.org/abs/2306.05685) | CC-BY-4.0 |
| [HelpSteer2](https://huggingface.co/datasets/nvidia/HelpSteer2) | multi-attribute human ratings — helpfulness, correctness, coherence, complexity, verbosity | CC-BY-4.0 |
| [JudgeBench](https://huggingface.co/datasets/ScalerLab/JudgeBench) | where judges fail on correctness rather than on style | MIT |

Those are *their* results on *their* items, released under those licences, and none of them is in this repository. Use them the way the licence says and attribute them the way the paper says.

### What it structurally cannot measure

**It cannot measure your slice mix.** One number is not a breakdown. When [15.4](../module-15/lesson-04.md) moves a system 21 points worse on the whole set, the interesting part is that 55 of those points are in `how_to` and one of them is in `exception` going the other way; a benchmark would have reported the 21 and lost both facts.

**It cannot measure your format.** Your product emits an answer inside a chat widget with a citation the user can click. A benchmark scores a string. The properties that break in production — a citation that points at the wrong section, a refusal that refuses a legitimate question — are invisible to a benchmark that scores the string.

**It cannot be re-analysed.** This is the sharpest one, and it is arithmetic rather than opinion. Every statistic in this course is a function of the per-item records, and the per-item records ship:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import wilson; print('successes 33 of 57 ->', wilson(33, 57))"
successes 33 of 57 -> 57.9% (45.0%–69.8%)
```

That interval came from **two integers**. A published score gives you `57.9%` and, at best, a sample size — and a rate plus a count does not tell you which of the two is which, because the two orders are not symmetric. Swap them and `wilson` raises rather than lies, which is the friendly outcome:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import wilson; print('successes 57 of 33 ->', wilson(57, 33))"
ValueError: expected a nonnegative input, got -0.03718473896622723
```

…which is friendly only if your reporting script lets the exception through. In a pipeline that catches it, you get a row with a blank interval and no explanation, and a blank looks like a reason not to worry. The real constraint is sharper than either: **you cannot bootstrap an aggregate, cut it by slice, or pair it against another system, because all three need the item list — and the item list is precisely what a leaderboard throws away.**

### Contamination, and the check you can run

Contamination is the situation where the score is high for a reason that will not survive contact with your users. The model has seen the questions — or paraphrases of them, or worked solutions — during training, so the benchmark measures recall of a public artefact rather than capability. [Xu et al.](https://arxiv.org/abs/2406.04244) survey the problem and the detection methods; none of them is free, and the cheapest one is a search you run once and then keep re-running.

For a **public benchmark** you cannot do it at all. The test items are the benchmark. Every competitor has them.

For **your own set** you can do it in one line, and you should run it in CI:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load; d=load('support'); q=lambda ids:{d.by_id(i).question for i in ids}; print('dev',len(d.dev_ids),'test',len(d.test_ids),'| shared ids',len(set(d.dev_ids)&set(d.test_ids)),'| shared questions',len(q(d.dev_ids)&q(d.test_ids)))"
dev 57 test 37 | shared ids 0 | shared questions 0
```

Zero and zero. That is the check, and it is the first thing that stops when somebody adds a production failure to dev and forgets it was already in test. It is the same loop [14.4](../module-14/lesson-04.md) closes, run in the other direction: there, production traces became items; here, two splits that were supposed to be disjoint are checked for being disjoint.

### The contamination you commit yourself

The version of this you *can* measure on your own data, today, with what ships here, is selection: **you pick the best of several options on the set you report on.** A leaderboard is a maximum over submissions; a judge you chose is a maximum over a menu; a prompt you tuned is a maximum over attempts. In all three cases the reported number is the top of a distribution, and the top of a distribution is biased upward by an amount that grows with how many things you tried.

This repository ships sixteen judges in one menu. Score each of them on the same 57 dev items against the same human labels, sort by agreement, and then read the held-out column:

```console
$ py -c "import sys,itertools; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion; d=load('support'); k=lambda jid,items:[confusion([(it.label('v1'), MajorityJudge(RecordedJudge(d,jid),repeats=5).verdict(it,'v1')) for it in items]) for _ in [0]][0]; rows=[]; [rows.append((j['id'], k(j['id'],d.items_for('dev')).kappa, k(j['id'],d.items_for('test')).kappa)) for j in d.judge_menu]; rows.sort(key=lambda r:-r[1]); [print('  %-20s dev %.3f  test %.3f'%(a,b,c)) for a,b,c in rows]; import statistics; print('  mean test kappa over all 16:', round(statistics.mean(r[2] for r in rows),3)); print('  pairs keeping the same dev-to-test order:', sum(1 for a,b in itertools.combinations(rows,2) if a[1]>b[1] and a[2]>b[2]), 'of', len(rows)*(len(rows)-1)//2)"
  c-step-3b            dev 1.000  test 1.000
  c-step-7b            dev 1.000  test 1.000
  c-crit-3.8b          dev 1.000  test 1.000
  c-crit-3b            dev 1.000  test 1.000
  c-rubric-3b-fs3      dev 1.000  test 1.000
  c-rubric-1.7b        dev 0.965  test 0.946
  c-rubric-3.8b        dev 0.965  test 0.946
  c-rubric-7b          dev 0.965  test 1.000
  c-rubric-3b-verb     dev 0.930  test 1.000
  c-rubric-1.7b-self   dev 0.895  test 0.892
  c-rubric-3b          dev 0.894  test 1.000
  c-rubric-0.6b        dev 0.859  test 0.731
  c-plain-7b           dev 0.714  test 0.839
  c-plain-3b           dev 0.568  test 0.380
  c-plain-1.7b         dev 0.494  test 0.093
  c-plain-0.6b         dev 0.155  test 0.085
  mean test kappa over all 16: 0.807
  pairs keeping the same dev-to-test order: 83 of 120
```

Three things in that table, and the third is the honest one.

- **The selection moved the mean held-out kappa from 0.807 to 1.000.** Picking the best of sixteen on dev does not leave you with the average judge; it leaves you with the best one, and the held-out column confirms it *on this data*. That is a real result and it is about 94 items.
- **It does not hold for the judges that lost.** `c-plain-1.7b` is `0.494` on dev and `0.093` on test; `c-rubric-0.6b` is `0.859` and `0.731`. The ordering survives for 83 of the 120 judge pairs and not for the other 37, which means **a dev comparison of judges tells you the winner and lies to you about the field.**
- **The five judges at 1.000 should make you suspicious, not happy.** Five different models and five different prompts produce *identical* held-out kappa, and only **9 of the 96** judge × variant × split cells in this dataset produce a false negative at all, so `TPR` is pinned at 100% almost everywhere. A judge that essentially never misses a pass is not a well-calibrated judge; it is a recorded run that happens to have few errors on that variant. **The number at the top of a selection table is the number that most deserves a held-out run, and here the held-out run is what tells you it is close to an artefact of the recording.**

Now the small-set version, which is the one that reads exactly like a leaderboard:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion; from collections import defaultdict; d=load('support'); s=defaultdict(list); [s[(it.slice or {}).get('intent','?')].append(it) for it in d.items_for('dev')]; sub=s['how_to']; print('  how_to slice n=',len(sub)); [print('  %-20s slice kappa %s   whole-dev kappa %s'%(j['id'], round(confusion([(it.label('v1'), MajorityJudge(RecordedJudge(d,j['id']),repeats=5).verdict(it,'v1')) for it in sub]).kappa,3), round(confusion([(it.label('v1'), MajorityJudge(RecordedJudge(d,j['id']),repeats=5).verdict(it,'v1')) for it in d.items_for('dev')]).kappa,3))) for j in d.judge_menu]"
  how_to slice n= 9
  c-plain-1.7b         slice kappa 1.0   whole-dev kappa 0.494
  c-plain-3b           slice kappa 0.609   whole-dev kappa 0.568
  c-plain-0.6b         slice kappa 0.0   whole-dev kappa 0.155
  c-plain-7b           slice kappa 0.609   whole-dev kappa 0.714
  c-rubric-0.6b        slice kappa 0.609   whole-dev kappa 0.859
  c-rubric-1.7b        slice kappa 1.0   whole-dev kappa 0.965
  c-rubric-3b          slice kappa 1.0   whole-dev kappa 0.894
  c-rubric-3.8b        slice kappa 1.0   whole-dev kappa 0.965
  c-rubric-7b          slice kappa 1.0   whole-dev kappa 0.965
  c-step-3b            slice kappa 1.0   whole-dev kappa 1.0
  c-step-7b            slice kappa 1.0   whole-dev kappa 1.0
  c-crit-3.8b          slice kappa 1.0   whole-dev kappa 1.0
  c-crit-3b            slice kappa 1.0   whole-dev kappa 1.0
  c-rubric-3b-fs3      slice kappa 1.0   whole-dev kappa 1.0
  c-rubric-3b-verb     slice kappa 1.0   whole-dev kappa 0.93
  c-rubric-1.7b-self   slice kappa 1.0   whole-dev kappa 0.895
```

`c-plain-1.7b` scores **kappa 1.000 on the nine `how_to` items** and **0.494 over the whole dev set**, and 0.093 on held-out test. On nine items, kappa can be 1.000 while the judge is one of the two worst in the menu, because kappa 1.000 on nine items means "agreed on all nine" and nothing more. **That is a leaderboard.** A slice of nine, a perfect score, and a completely different story when you look at the next hundred items.

### The rule, which is a rule about decisions

> **Use a benchmark to choose between models. Never to decide whether your feature works.**

Choosing between models is a *comparison*, and a benchmark is a controlled comparison: same questions, same protocol, same scorer, one variable changed. That is exactly what a benchmark is for and exactly what your own suite cannot do across vendors, because your suite has your questions and their model may never have been run on them in a form you control.

Deciding whether your feature works is a *claim about your users*, and for that you need your questions, your slices, your format, and a set you have checked for overlap.

The line is not "benchmarks are bad". It is that a benchmark's number is admissible evidence for a decision whose subject is the benchmark's set, and inadmissible for a decision whose subject is your traffic.

## Show me

Everything in this lesson runs from the repo root with Python and no network. There is **no benchmark shipped in this repository** and none was run; the table above is this course's sixteen recorded judge configurations scored against this course's human labels, and the held-out column is the only thing in it that is not selection.

The three commands, in the order a team should run them:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load; d=load('support'); q=lambda ids:{d.by_id(i).question for i in ids}; print('dev',len(d.dev_ids),'test',len(d.test_ids),'| shared ids',len(set(d.dev_ids)&set(d.test_ids)),'| shared questions',len(q(d.dev_ids)&q(d.test_ids)))"
dev 57 test 37 | shared ids 0 | shared questions 0
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, wilson; d=load('support'); print('successes 33 of 57 ->', wilson(33, 57))"
successes 33 of 57 -> 57.9% (45.0%–69.8%)
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load; from collections import Counter; d=load('support'); [print(' ',s,dict(sorted(Counter((it.slice or {}).get('intent','?') for it in d.items_for(s)).items()))) for s in ('dev','test')]"
  dev {'boundary': 16, 'exception': 3, 'how_to': 9, 'out_of_scope': 5, 'policy_fact': 24}
  test {'boundary': 15, 'how_to': 10, 'out_of_scope': 2, 'policy_fact': 10}
```

A published benchmark gives you the first number in the second line's output and nothing else. Everything the rest of this course does — intervals, slices, paired comparisons, gates — is downstream of the item list, and the item list is the thing a benchmark score has thrown away.

> [!NOTE]
> There is no runnable benchmark artefact in this repository and there is not meant to be one. [`references/README.md`](../../references/README.md) lists the public datasets the method was developed against and their licences, so you can go and read the primary sources; the courses' own datasets are generated and original and are described in [the licences note](../../COURSE-MAP.md).

## Try it

**Predict first**, on paper:

1. A model card says the new build is 4 points behind on a public multi-turn benchmark. Predict what the number was computed over, and write the three questions you would need answered before you could use it.
2. Sixteen judges, sorted by agreement on 57 dev items, top one selected. Predict whether the winner's held-out kappa is the highest of the sixteen, and by how much.
3. `wilson` is handed the sample size and a rate instead of successes and the sample size. Predict what it returns, and say what kind of bug in a reporting script produces exactly that output.
4. One slice of your eval set has nine items and a judge scores kappa 1.000 on it. Predict what kappa on the other 48 items could be, and say what the nine-item number is evidence of.

[Lab: evallab package](../../labs/common/)

1. **Run the overlap check on every split you have**, not just dev against test — and also compare the *questions*, not only the ids. Then find the item id in [`evallab/observe.py`](../../labs/common/evallab/observe.py) that gets prefixed with `tr_` and write the line that would make a production trace rejoin the test split by accident.
2. **Score all sixteen shipped judges on dev, sort, and read the held-out column.** Then answer three questions in writing: how much of the dev-to-test ordering survived, which judges moved most, and whether the top of the table would still be the top if you had scored on test first and selected on dev afterwards.
3. **Repeat the selection on a single slice.** Take `how_to` (9 items) and `boundary` (16), rank the judges on each, and write down whether the two rankings agree. Then compute the whole-dev ranking and put the three side by side.
4. **Try to make `wilson` fail in three different ways** — the wrong argument order, a rate instead of a count, `n = 0` — and record what each one returns. Write the assertion you would add to a reporting script so that none of the three can pass silently.
5. **Write the rule as a decision table** for your own product: one column per kind of decision you make about models, one column saying whether a public benchmark score is admissible, and the last column naming the set the decision has to be made on. Include at least one row where the answer is "yes" — if you cannot fill that row in, you have decided to stop reading model cards.

## Break it

**Quote a public benchmark score in a decision about your feature.** The lie: **the number is real and the subject is wrong.** It was computed over somebody else's questions with somebody else's protocol, and your users asked none of them.

**Select the best of sixteen on dev and report the dev number.** `0.494 → 1.000` for the winner, `0.494 → 0.093` for the loser. The lie: **a selected maximum is biased upward by the number of things you tried**, and the bias lands on the reported figure while the held-out figure is never computed.

**Report a slice number as if it were the system number.** Kappa `1.000` on nine `how_to` items, `0.494` over 57, `0.093` held out. The lie: **a perfect score on a small set is a statement about the set**, and it is indistinguishable from a model that has genuinely mastered the category — which is why benchmark tables are full of small slices.

**Assume contamination is somebody else's problem.** The test items are public; every competitor has them; nothing in the protocol tells you whether this build predates or postdates them. The lie: **a benchmark score measures capability and recall of a public artefact, and it cannot tell you which one you got**, so a high score is compatible with both.

**Treat the headline as agreement.** `c-plain-0.6b` passes 93.0% of dev items against a human pass rate of 52.6%. The lie: **a pass rate is not a quality measure until you know what a pass means**, which is the whole of [06.1](../module-06/lesson-01.md) and the reason a benchmark's score is usually a win rate.

**Skip the overlap check because the splits "obviously" don't overlap.** The lie: **splits stop being disjoint the first time somebody adds an item from the other one**, and the resulting contamination is invisible — both numbers keep looking normal.

## Fix it

1. **Use a benchmark to choose between models; use your own set to decide whether your feature works.** Write the sentence that says which is which into whatever document your team uses for model decisions.
2. **Report a selected number with its held-out number next to it, always.** Top judge: `1.000` dev, `1.000` test. Bottom judge: `0.155` dev, `0.085` test. The pair is a finding; either half alone is a boast.
3. **Put the overlap check in CI.** `set(dev_ids) & set(test_ids)` and the question-text comparison, as a test that fails the build. It is two lines and it is the only contamination check you can actually run.
4. **Report your own number by slice, with `n` beside every one.** `exception` is 3 items on dev and 0 on test; `out_of_scope` is 2 on test. A slice with two items is not a slice, it is a story, and it should be printed with its `n` so nobody reads it as a rate.
5. **Say what a benchmark score is and is not, in the paragraph that quotes it.** One sentence: "public benchmark X, score Y, published by Z, on their items." It takes ten seconds and it is the difference between a citation and a claim.
6. **Count your attempts.** If you tried four prompts and reported the best, the reported number is a maximum of four, and the held-out run has to be one you did not choose on.
7. **Treat the item list as the artefact, not the score.** Everything this course does is a function of the records; a score that cannot be re-derived from records cannot be checked by anybody, including you in six months.

## How do I know it works?

**Challenge, on dev**, with the 57 dev items, `c-rubric-3b`, five repeats:

- **The overlap check runs and returns two zeros**, for ids and for question text. A test that fails the build if either is non-zero.
- **Every number you quote has its `n` beside it.** 57, 37, 16, 9, 3, 2. A number with no `n` is not in the report.
- **Every selected number has a held-out number next to it**, including the judges you rejected. The rejected column is the evidence that the selection was not just noise.
- **Your own headline score is reported by slice**, and the smallest slice on the held-out split is named as too small to report.
- **You can say, in one sentence, what a benchmark measures and what it cannot**, and the sentence names your smallest slice.

**Then one held-out validation**, on the **37 test items**, with nothing re-tuned:

| | dev, 57 | held-out, 37 |
|---|---|---|
| Shared item ids with the other split | 0 | 0 |
| Shared question texts | 0 | 0 |
| `policy_fact` items | 24 | 10 |
| `how_to` items | 9 | 10 |
| `boundary` items | 16 | 15 |
| `out_of_scope` items | 5 | 2 |
| `exception` items | 3 | **0** |
| Best-of-16 judge kappa | 1.000 | 1.000 |
| Mean kappa over all 16 judges | 0.838 | 0.807 |
| Worst-of-16 judge kappa | 0.155 | 0.085 |

Two things in that table are the check.

- **The selection result held.** The judge's kappa on the split it was not chosen on is `1.000`, the same as on the split it was chosen on, while the mean over all sixteen is `0.807`. On this data, selecting on dev found a judge that is genuinely better rather than a judge that looked better — and that is a finding about 94 items, which is why it has to be re-run every time the suite changes.
- **The slice mix does not hold, and that is the point.** `exception` has 3 items on dev and **0** on the held-out split. A headline number that was 3 items away from a category that vanishes on validation is a headline number that has never been validated on that category at all. **A benchmark would have printed one number and lost both facts** — which is the argument of this lesson in the only form it needs to be made.

## Use / don't use

**Do use public benchmarks to choose between models.** That is what they are for. Same questions, same protocol, one variable — the model. If you are picking between two vendor builds and neither has been run on your suite, a benchmark comparison is better than nothing and better than two unrelated marketing pages.

**Do cite them properly**: the set, the score, the publisher, their items. MT-Bench human judgments is CC-BY-4.0, HelpSteer2 is CC-BY-4.0, JudgeBench is MIT, and the numbers in their papers are theirs.

**Do keep your own eval set closed and small enough to audit.** Nobody has memorised your nine `how_to` questions. That is the entire advantage you have and it is worth more than a leaderboard position.

**Do run the overlap check in CI.** It is the cheapest contamination defence that exists and it catches the most common version of the problem, which is internal rather than adversarial.

**Do report your own numbers with intervals and slices.** The interval says how much you know; the slice says what you know it about.

**Do re-run the selection every time the suite changes.** A judge selected on 57 items and re-validated on a 600-item suite is a new selection.

**Don't use a benchmark to decide whether your feature works.** Your users did not ask the benchmark's questions, in your format, with your failure modes.

**Don't quote a selected number without the held-out number.** The gap between them is the size of your selection bias and it is free to measure.

**Don't treat a small-set perfect score as a finding.** Nine items, kappa 1.000, and 0.494 on the other 48 — that is what small sets do.

**Don't run a benchmark to compare judges.** [15.2](../module-15/lesson-02.md) is about why, and the short answer is that a judge benchmark tells you how a judge behaves on a fixed set of comparison questions, which is not the same question as whether it agrees with your humans on your answers.

**Don't assume a clean result means a clean run.** Contamination does not announce itself. It produces a good number.

What teams actually do: keep a two-page model-adoption note with a fixed shape — the vendor's public benchmark score and its citation, then your own suite's paired numbers with intervals, then the slice table, then the decision and the owner. The benchmark score is one line and it is the line nobody is allowed to quote on its own. Everything the decision rests on is computed from the item list, which is the part the team owns.

## Reflect

1. A vendor model card quotes a benchmark score 4 points ahead of your current build. Write the paragraph that puts that number into your team's notes correctly — what it is, what it is not, and what has to happen before it can be used.
2. Your best-of-sixteen judge is at kappa 1.000 on dev and the held-out column says 1.000 as well. Write the two sentences you would put in a design review that make clear why this is *not* the reassuring result it appears to be.
3. `exception` has 3 items on dev and 0 on test. Write what your system has therefore never been measured on, and what it would cost to get to 30 items on that slice.
4. A judge scores kappa 1.000 on nine `how_to` items and 0.494 over the whole set. Write the sentence that would stop a stakeholder putting the nine-item number in a slide.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) — the source of [MT-Bench human judgments](https://huggingface.co/datasets/lmsys/mt_bench_human_judgments)
  (CC-BY-4.0), the expert pairwise judgement set the method in this course was shaped by, and the paper that treats data contamination as a reason to filter benchmark questions before publishing them.
- Cheng Xu et al., [Benchmark Data Contamination of Large Language Models: A
  Survey](https://arxiv.org/abs/2406.04244) (2024) — what contamination is, how it is detected, and why none of the detection methods is free enough to run on every submission, which is the reason the "select on the set you report on" argument is the part you can act on.
- [HelpSteer2](https://huggingface.co/datasets/nvidia/HelpSteer2) (CC-BY-4.0) and [JudgeBench](https://huggingface.co/datasets/ScalerLab/JudgeBench)
  (MIT) — the other two datasets [`references/README.md`](../../references/README.md) names, one for multi-attribute ratings and one for where judges fail on correctness rather than style. Both are theirs, both are readable for free, and neither ships here.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the shortest statement of the position this lesson takes: a benchmark is evidence about a benchmark, and the claim you need to defend is about your own users.
