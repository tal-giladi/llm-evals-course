---
id: "15.2"
module: 15
minutes: 20
practice_minutes: 45
prerequisites: ["15.1", "06.2"]
objectives:
  - Distinguish a verifier, a judge and a reward model by what each one is asked and what each one costs to trust, and say which of the three a given check belongs to.
  - Apply the decidability test from module 2 to a proposed check, and write the sentence that decides it.
  - Measure a three-line verifier against the same human labels as a judge, on every variant in the dataset, and report the cells where the verifier beats and loses to the judge.
  - Compute the coverage of a verifier and a judge together on the failures they each miss alone, and say what that number justifies building.
volatility: implementation
sources:
  - title: "Hunter Lightman et al. — Let's Verify Step by Step"
    url: https://arxiv.org/abs/2305.20050
  - title: "Nisan Stiennon et al. — Learning to summarize from human feedback"
    url: https://arxiv.org/abs/2009.01325
  - title: "Nathan Lambert et al. — RewardBench: Evaluating Reward Models for Language Modeling"
    url: https://arxiv.org/abs/2403.13787
  - title: "Zheng et al. — Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"
    url: https://arxiv.org/abs/2306.05685
  - title: "JudgeBench (ScalerLab) — MIT"
    url: https://huggingface.co/datasets/ScalerLab/JudgeBench
last_verified: "2026-10-01"
---

# 15.2 · Reward models, judges and verifiers

Three different things "score" an output, they fail in three different ways, and the confusion between them costs real money in both directions — a team that trains a reward model to do a job a three-line assertion does, and a team that runs a model call, at a price per call and a validation cycle, to decide whether a citation is present. This lesson is about telling them apart, and the test that tells them apart is one you already know.

## Why it matters

Two real shapes, and they are mirror images.

**Shape one.** A team has a support bot. The failure that matters is "the answer adds something the handbook does not say". Somebody proposes training a reward model on 30 000 preference pairs, because the property — *is this supported?* — is not something they can write down as a rule. Six figures and a quarter later there is a model that ranks answers, and it ranks them well on the training distribution, and nobody can say what it does on an answer phrased differently, because there is no confusion matrix and there was never a labelled set to build one from. The reward model is asked a question no one framed as a classification, and its output is a number, and a number cannot be checked.

**Shape two.** A team has the same bot and the same worry, and somebody else has already shipped a judge. They wire the judge in, run it in CI, and three weeks later the gate is blocking on a metric they cannot interpret, because the judge was validated against 57 labels and a judge with `TNR = 88.9%` blocks on a real regression about half the time and passes a real one a ninth of the time. They are paying per call, running a prompt through a model, to compute a boolean that a regular expression computes exactly, for free, in microseconds, with no labels, no intervals, and no validation.

Both teams ended up in the same place: **a scorer nobody can check, pointed at a property somebody could have checked.** And the reason both happened is that all three things — verifier, judge, reward model — return a number that goes in the same column, and once the numbers are in the same column the distinction is gone.

The distinction is not academic. It decides three things you pay for:

| | what it needs to exist | what it needs to be trusted | per item |
|---|---|---|---|
| **verifier** | a decidable property | nothing beyond the property | microseconds, $0 |
| **judge** | a rubric and a labelled set | a confusion matrix, an interval, a disagreement review, a hold-out | a model call |
| **reward model** | a preference dataset | a benchmark that is itself an eval, plus the preferences | training, then a call |

The reward model is the expensive one and the one whose purpose is different from both of the others: it is not asked to *grade* anything. It is trained to produce a scalar whose ordering matches human preferences, and it is used to rank candidates, to filter a large pool down to a small one, or as the training signal for a model that will be graded later by something else. If you are using it as a pass/fail gate, you have taken a ranking tool and asked it a calibration question it was never trained to answer.

## How it works

### The test, which is module 2's test

[02.3](../module-03/lesson-03.md) gave you a test for a taxonomy: *is this a new category, or an instance of a category you already have?* The same test, three years and eleven modules later, decides which of the three you want:

> **Is the property decidable?**

Not "is it easy". Not "could somebody write it down". **Decidable** means: given the answer and the reference material, does a fixed piece of code return the same verdict every time, with no model in the loop?

- **"Does the answer cite a handbook section?"** — decidable. The answer either contains the citation marker or it does not.
- **"Does the number in the answer match the number in the handbook section it cites?"** — decidable. You have both strings; you compare them. This is what [03.1](../module-03/lesson-01.md) calls a check and what your post-check span is for.
- **"Is the answer helpful?"** — not decidable. There is no program. You are asking for a judgement, and a judgement needs a judge.
- **"Does this answer add anything the handbook does not support?"** — **this is the interesting one**, and the answer is *partly*. "Adds something" is decidable per claim: split the answer into claims, check each against the source. What is not decidable is whether a claim is *supported* when the source is prose and the claim is a paraphrase. Teams routinely answer this question with a model, and then call it a verifier, and then cannot reproduce it.

### The verifier, measured

Here is the whole of a verifier for the citation rule, which is the second of the three rules in `c-rubric-3b`'s rubric:

```python
PATTERNS = (r"(?i)handbook", r"(?i)section", r"(?i)according to")

def has_citation(answer: str) -> int:
    return int(any(re.search(p, answer) for p in PATTERNS))
```

Three lines, no model, no labels, no cost. And here is its agreement with the human labels, on every variant in the dataset, against the same judge from [06.2](../module-06/lesson-02.md) on the same items:

```console
$ py -c "import sys,re; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion; d=load('support'); P=(r'(?i)handbook',r'(?i)section',r'(?i)according to'); cite=lambda a:int(any(re.search(p,a) for p in P)); J=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); [print('  %-6s %-6s verifier kappa %.2f   judge kappa %.2f'%(v,s,confusion([(i.label(v),cite(i.output(v))) for i in d.items_for(s)]).kappa,confusion([(i.label(v),J.verdict(i,v)) for i in d.items_for(s)]).kappa)) for v in ('v1','v2','v3') for s in ('dev','test')]"
  v1     dev    verifier kappa 0.93   judge kappa 0.89
  v1     test   verifier kappa 1.00   judge kappa 1.00
  v2     dev    verifier kappa 0.72   judge kappa 0.96
  v2     test   verifier kappa 0.63   judge kappa 1.00
  v3     dev    verifier kappa 0.40   judge kappa 1.00
  v3     test   verifier kappa 0.35   judge kappa 0.84
```

Read that row by row rather than as a scoreboard, because the pattern is the finding:

- **On `v1` the verifier beats the judge** — 0.93 against 0.89 on dev, tied at 1.00 on test. `v1` is the tuned build: it retrieves, and it cites. On a system that satisfies the other two rubric rules by construction, checking one of the three gets you most of the way, for free.
- **On `v2` and `v3` the verifier loses badly** — 0.72 against 0.96, 0.63 against 1.00, 0.40 against 1.00. Those are the builds that do not retrieve, and their answers carry confident wrong facts with a correct-looking citation. A verifier that checks the citation cannot see any of that, and its agreement falls to a third.
- **The honest caveat, which is not optional.** The judge's `1.000` on several cells is a property of a recorded run generated from the labels with an error pattern, not a finding about Llama 3.2 3B. Only **9 of the 96** judge × variant × split cells in this dataset produce a single false negative, so `TPR` is pinned at 100% almost everywhere and the judge here is close to one-sided by construction. **Do not quote "verifiers beat judges" or "judges beat verifiers" from this table.** Quote the pattern — *the verifier's agreement tracks whether the property it checks is the property the label depends on* — because that is the part that transfers.

### Why they are worth having together

The better question is not which one wins, and it is measurable. On the items a human labelled as failures, how many does each one catch, and how many does *neither* catch?

```console
$ py -c "import sys,re; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge; d=load('support'); P=(r'(?i)handbook',r'(?i)section',r'(?i)according to'); cite=lambda a:int(any(re.search(p,a) for p in P)); J=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); rows=lambda v,s:[(i.id,i.category(v),1-cite(i.output(v)),1-J.verdict(i,v)) for i in d.items_for(s) if i.label(v)==0]; [print('  %-4s %-5s human failures %3d | both %3d | verifier only %2d | judge only %2d | missed by both %2d'%(v,s,len(r),sum(1 for x in r if x[2] and x[3]),sum(1 for x in r if x[2] and not x[3]),sum(1 for x in r if x[3] and not x[2]),sum(1 for x in r if not x[2] and not x[3]))) for v in ('v1','v2','v3') for s in ('dev','test') for r in [rows(v,s)]]"
  v1   dev   human failures  27 | both  22 | verifier only  3 | judge only  2 | missed by both  0
  v1   test   human failures  20 | both  20 | verifier only  0 | judge only  0 | missed by both  0
  v2   dev   human failures  37 | both  28 | verifier only  1 | judge only  8 | missed by both  0
  v2   test   human failures  31 | both  26 | verifier only  0 | judge only  5 | missed by both  0
  v3   dev   human failures  52 | both  41 | verifier only  0 | judge only 11 | missed by both  0
  v3   test   human failures  34 | both  25 | verifier only  1 | judge only  8 | missed by both  0
```

**Missed by both: zero, on all six cells.** Two scorers that each fail on their own — the verifier at kappa 0.35 on `v3` test, the judge at `TNR = 88.9%` on `v1` dev — between them caught every human failure on this data.

And look at *where* the judge is doing the unique work: on `v2` dev, 7 of its 8 unique catches are the `extra` category, and on `v3` dev, 8 of 11. `extra` is "the answer cites the handbook and adds something the handbook does not say". A verifier that looks for a citation sees a citation and passes it. **That is not a flaw in the verifier; it is what a verifier is.** It decides one property, exactly, and the property it decided was not the one that failed.

The number that justifies building this is not either kappa. It is: *how many human failures does my current stack miss, and are any of them decidable?* If a failure is decidable and no verifier covers it, that is a three-line afternoon. If a failure is not decidable and no judge covers it, that is a [06.2](../module-06/lesson-02.md) project with a validation budget.

### The reward model, and the knob that behaves like one

**No reward model ships in this repository and none was run.** The closest thing that ships is the probability-weighted threshold from [06.4](../module-06/lesson-04.md): the judge produces five binary samples, and a threshold turns them into one verdict. That is not a reward model — it has no preferences behind it — but it is *shaped* like one, and its behaviour under a distribution shift is the behaviour worth understanding before you build the expensive thing.

```console
$ py -c "import sys,re; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion, pct; d=load('support'); R=RecordedJudge(d,'c-rubric-3b'); [print('  threshold %.1f   v1 pass %s kappa %.3f   |   v2 pass %s kappa %.3f'%(t,pct(confusion([(i.label('v1'),MajorityJudge(R,repeats=5,use_threshold=True,threshold=t).verdict(i,'v1')) for i in d.items_for('dev')]).judge_pass_rate),confusion([(i.label('v1'),MajorityJudge(R,repeats=5,use_threshold=True,threshold=t).verdict(i,'v1')) for i in d.items_for('dev')]).kappa,pct(confusion([(i.label('v2'),MajorityJudge(R,repeats=5,use_threshold=True,threshold=t).verdict(i,'v2')) for i in d.items_for('dev')]).judge_pass_rate),confusion([(i.label('v2'),MajorityJudge(R,repeats=5,use_threshold=True,threshold=t).verdict(i,'v2')) for i in d.items_for('dev')]).kappa)) for t in (0.2,0.4,0.5,0.6,0.8,1.0)]"
  threshold 0.2   v1 pass 86.0% kappa 0.307   |   v2 pass 75.4% kappa 0.299
  threshold 0.4   v1 pass 66.7% kappa 0.714   |   v2 pass 45.6% kappa 0.784
  threshold 0.5   v1 pass 57.9% kappa 0.894   |   v2 pass 36.8% kappa 0.962
  threshold 0.6   v1 pass 57.9% kappa 0.894   |   v2 pass 36.8% kappa 0.962
  threshold 0.8   v1 pass 50.9% kappa 0.965   |   v2 pass 29.8% kappa 0.880
  threshold 1.0   v1 pass 36.8% kappa 0.689   |   v2 pass 21.1% kappa 0.661
```

**The threshold that maximises agreement on `v1`'s answers is 0.8, and the threshold that maximises it on `v2`'s answers is 0.5.** At 0.8 the judge agrees with humans on `v2` at 0.880 instead of 0.962 — the scalar was tuned on one answer distribution and carried to another, and it landed in a worse place. That is the whole reason reward models need [RewardBench](https://arxiv.org/abs/2403.13787)-style evaluation: a scalar carries the distribution it was tuned on, and nobody notices until the distribution moves.

Two smaller things the table shows that are worth more than the headline:

- **`0.5` and `0.6` give identical verdicts.** With five repeats the pass fraction can only be 0, 0.2, 0.4, 0.6, 0.8 or 1.0, so a threshold anywhere in `(0.4, 0.6]` selects the same items. Six effective settings, not fifty-one — and if you were to report "we swept the threshold" with a plot of fifty-one points, forty-five of them would be the same run twice.
- **`threshold = 1.0` means "all five samples must say pass"**, and it drops agreement to 0.689. A stricter rule on a noisy instrument is not a better rule; it is a noisier one pointed the other way.

## Show me

Everything above runs from the repo root with Python and no network. There is **no reward model in this repository**, no training step, and no preference dataset — the reward-model section runs on the threshold knob because the knob is the part of the idea that you can actually check.

The whole of the comparison, three commands, in the order you would run them for a real check:

```console
$ py -c "import sys,re; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge, confusion; d=load('support'); P=(r'(?i)handbook',r'(?i)section',r'(?i)according to'); cite=lambda a:int(any(re.search(p,a) for p in P)); J=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); [print('  %-6s %-6s verifier kappa %.2f   judge kappa %.2f'%(v,s,confusion([(i.label(v),cite(i.output(v))) for i in d.items_for(s)]).kappa,confusion([(i.label(v),J.verdict(i,v)) for i in d.items_for(s)]).kappa)) for v in ('v1','v2','v3') for s in ('dev','test')]"
  v1     dev    verifier kappa 0.93   judge kappa 0.89
  v1     test   verifier kappa 1.00   judge kappa 1.00
  v2     dev    verifier kappa 0.72   judge kappa 0.96
  v2     test   verifier kappa 0.63   judge kappa 1.00
  v3     dev    verifier kappa 0.40   judge kappa 1.00
  v3     test   verifier kappa 0.35   judge kappa 0.84
$ py -c "import sys,re; sys.path.insert(0,'labs/common'); from evallab import load, RecordedJudge, MajorityJudge; d=load('support'); P=(r'(?i)handbook',r'(?i)section',r'(?i)according to'); cite=lambda a:int(any(re.search(p,a) for p in P)); J=MajorityJudge(RecordedJudge(d,'c-rubric-3b'),repeats=5); rows=lambda v,s:[(i.id,i.category(v),1-cite(i.output(v)),1-J.verdict(i,v)) for i in d.items_for(s) if i.label(v)==0]; [print('  %-4s %-5s human failures %3d | both %3d | verifier only %2d | judge only %2d | missed by both %2d'%(v,s,len(r),sum(1 for x in r if x[2] and x[3]),sum(1 for x in r if x[2] and not x[3]),sum(1 for x in r if x[3] and not x[2]),sum(1 for x in r if not x[2] and not x[3]))) for v in ('v1','v2','v3') for s in ('dev','test') for r in [rows(v,s)]]"
  v1   dev   human failures  27 | both  22 | verifier only  3 | judge only  2 | missed by both  0
  v1   test   human failures  20 | both  20 | verifier only  0 | judge only  0 | missed by both  0
  v2   dev   human failures  37 | both  28 | verifier only  1 | judge only  8 | missed by both  0
  v2   test   human failures  31 | both  26 | verifier only  0 | judge only  5 | missed by both  0
  v3   dev   human failures  52 | both  41 | verifier only  0 | judge only 11 | missed by both  0
  v3   test   human failures  34 | both  25 | verifier only  1 | judge only  8 | missed by both  0
```

Two scorers, one of which is a regex, between them caught **201 of 201 human failures** on this dataset — with the `extra` category, 27 cells of it, invisible to the verifier by construction, and picked up entirely by the judge.

> [!IMPORTANT]
> None of the judge's numbers here is a measurement of a real model. The verdicts come from this repository's shipped educational model, and only 9 of its 96 judge × variant × split cells produce a false negative, so the judge on this data is near one-sided by construction and its kappa is high for reasons that have nothing to do with any model in the wild. The **verifier's** numbers, by contrast, are real arithmetic over real strings — if you disagree with `0.93` on `v1` dev you can go and count the strings yourself, and you will get `0.93`.

## Try it

**Predict first**, on paper:

1. A three-line citation verifier scores kappa 0.93 on one variant and 0.40 on another, same items, same labels. Predict what differs between the two variants' answers, and predict which failure category the verifier scores 0 on.
2. The judge catches 8 failures the verifier misses and the verifier catches 1 the judge misses, on 37 items. Predict what the "missed by both" column is, and say what a non-zero value there would mean about your stack.
3. You sweep a threshold over `(0.4, 0.6]` on five repeats. Predict how many distinct verdicts that range produces, and explain why.
4. A team is about to train a reward model on 30 000 preference pairs to detect unsupported additions. Predict the question you would ask first that is cheaper to answer and that determines whether the training is needed at all.

[Lab: evallab package](../../labs/common/)

1. **Write five verifiers, one per rubric rule**, in [`labs/common/`](../../labs/common/) as a small module. Rule 2 is the citation check above. For rules 1 and 3 write down what the function needs as arguments before you write it — the point of the exercise is finding out that rule 1 needs the handbook and rule 3 needs a per-claim decomposition, not a model.
2. **Run the kappa table for all five verifiers** on all six cells, next to the judge. Then rank the verifiers by their *worst* cell rather than their best, and write the sentence that says why the worst cell is the number that matters.
3. **Build the coverage table for every verifier you have, plus the judge.** `missed by both` per cell, with the item ids. Then take the items that *no* scorer catches and read them, and classify them by hand — that list is the argument for whatever you build next.
4. **Sweep the threshold** over `0.1` to `1.0` in steps of `0.05` and print the number of *distinct verdict vectors* at each step. Confirm that five repeats give you six, and write the sentence you would put in a design review to stop somebody presenting fifty-one points as a sweep.
5. **Price the stack.** `c-rubric-3b` costs `$0.03794` per call in `datasets/support.json`. Compute the annual cost at your own CI frequency and item count, then compute what fraction of it is spent on items a verifier already decided. Write the number; it is the most persuasive line in the lesson.

## Break it

**Train a reward model to decide whether a citation is present.** The lie: **a scalar is not a verdict**, and the cost is a training set, a training run and a benchmark for the reward model itself — none of which checks the thing you wanted checked. Three lines do it exactly, at no cost, forever.

**Run a judge where a verifier would do.** $0.03794 a call, plus the confusion matrix, the interval, the disagreement review and the hold-out — to compute a boolean that a regex computes exactly. The lie: **a model call's cost is not the token price; it is the token price plus the validation you now owe**, and the validation never ends.

**Use a verifier as though it were the label.** Kappa 0.93 on `v1` dev, and you report it as "our citation check agrees with humans 93% of the time" without saying which build it was measured on. The lie: **a verifier's agreement is a property of the distribution it was measured on**, and `v1` is the build that cites; on the builds that do not, the same function scores 0.40.

**Use a judge as though it were a verifier.** You want "does it cite" and you get "does it cite and is it correct and adds nothing", scored by a model, with three failure modes instead of one. The lie: **a rubric with three rules has three failure modes and you can only diagnose them if you can separate them** — which is what the coverage table above is for.

**Read the reward model's number as a pass rate.** A score of 4.2 becomes 70% because you put it in the same column as the judge. The lie: **an uncalibrated scalar has no threshold**, and the threshold you pick is fitted to the distribution you fitted it on — `0.8` on `v1`, `0.5` on `v2`, and the difference between them is the whole of the failure.

**Drop the verifier once the judge exists.** Judge alone on `v2` dev misses 1 of 37 human failures; the judge plus the verifier misses 0. The lie: **a better average can come with a worse tail**, and the tail is where your users are.

## Fix it

1. **Apply the decidability test before you choose the instrument, and write the answer down.** "Decidable — three-line check" or "not decidable — needs a judge, here is the validation budget". Put it in the same document as the failure's category from [02.3](../module-03/lesson-03.md), so the check and the failure it covers stay adjacent.
2. **Write the verifier even when a judge already covers the property.** It costs an afternoon, it runs in CI forever for free, and it is the only scorer whose behaviour you can reason about without a labelled set.
3. **Measure every scorer on every variant, and report the worst cell.** Not the best. A check that scores 0.93 on one build and 0.40 on another is a check you can only trust on the build you measured, and the build you measured is the one you already knew about.
4. **Report coverage, not a scoreboard.** "Missed by both: 0 of 27" is a finding about your stack. "Verifier 0.93, judge 0.89" is two numbers and no conclusion.
5. **Keep the rubric rules separate when you can.** Rule 2 alone as a verifier, rule 3 alone as a judge, and the coverage table that says which failures only the pair catches. A single three-rule judge gives you one number and no way to tell which rule fired.
6. **Re-fit any scalar when the answer distribution moves.** Same trigger as [15.4](../module-15/lesson-04.md): a model change, a prompt change, a new slice. The threshold that was 0.8 is not 0.8 any more, and nothing will tell you except re-running the sweep.
7. **Price the stack and publish the number.** What fraction of your eval budget is spent on decisions a deterministic check already made is the number that determines whether the next scorer is worth building.

## How do I know it works?

**Challenge, on dev**, with the 57 dev items and `c-rubric-3b`:

- **Every check in your suite has a written decidability verdict.** Three lines at most, one of the words *verifier* or *judge*, and a reference to the failure category it covers.
- **Every scorer has a kappa on all three variants**, not just the tuned one, and you have named the worst cell: verifier `0.40` on `v3` dev, judge `0.89` on `v1` dev.
- **The coverage table is printed with item ids** and `missed by both` is `0` on every cell you measured.
- **The failures no scorer catches are read by a person** and classified by hand. If the list is empty, you have a claim to check; if it is not empty, you have your next project and it is written down.
- **The threshold sweep shows six distinct settings**, not fifty-one, and the chart you publish has six points on it.
- **The price of the stack is a number**, in calls and in currency per run, with the fraction spent on already-decided items beside it.

**Then one held-out validation**, on the **37 test items**, with nothing re-tuned:

| | dev, 57 | held-out, 37 |
|---|---|---|
| Verifier kappa on `v1` | 0.93 | 1.00 |
| Judge kappa on `v1` | 0.89 | 1.00 |
| Verifier kappa on `v2` | 0.72 | 0.63 |
| Judge kappa on `v2` | 0.96 | 1.00 |
| Verifier kappa on `v3` | 0.40 | 0.35 |
| Judge kappa on `v3` | 1.00 | 0.84 |
| Human failures missed by both, `v1` | 0 of 27 | 0 of 20 |
| Human failures missed by both, `v2` | 0 of 37 | 0 of 31 |
| Human failures missed by both, `v3` | 0 of 52 | 0 of 34 |

Two things in that table are the check, and the first is uncomfortable.

- **The verifier got worse on the held-out split, not better.** `0.72 → 0.63` on `v2` and `0.40 → 0.35` on `v3`. It is deterministic, so this is not sampling noise in the usual sense — it is that the 37 held-out items happen to contain more of the failures the regex cannot see. **A verifier's agreement is not a stable property across splits, and the reason is the item mix.** If you had chosen your verifier by its dev kappa you would have chosen the wrong thing, and the wrong thing looked better on the set you chose it on.
- **The judge's `1.00` did not hold up.** It is `1.00`, `1.00` and `0.84` on test where it was `0.89`, `1.00` and `1.00` on dev. A judge that scores perfectly on the set you validated it on and then drops a full point on held-out data is telling you something about the validation set, not about the judge — which is [04.2](../module-04/lesson-04.md) again, and the reason the two scorers together are worth more than either.

## Use / don't use

**Do use a verifier wherever the property is decidable.** It is the cheapest, fastest, most reproducible and most explainable scorer available, and it is the only one whose wrong answers you can find by reading strings.

**Do use a judge where the property is genuinely a judgement.** `helpful`, `appropriate tone`, `would a person accept this`. [06.2](../module-06/lesson-02.md) is the whole cost of that decision, and you pay it once per judge rather than once per property.

**Do use a reward model to rank or to filter, and not to gate.** Its output is an ordering. If you need a boolean you have to pick a threshold, and the threshold is a fitted parameter that has to be re-fitted whenever the answer distribution moves.

**Do run verifiers and judges together and report the coverage.** The union is what your users experience; the individual kappas are what your tooling produces.

**Do keep the rules separate.** One judge per rule, or one verifier per rule plus a judge for the rest, and a coverage table that shows what the combination buys.

**Do re-run the coverage table whenever a scorer changes.** Adding a verifier can only reduce `missed by both`; removing one can only raise it, and you will not notice either without the table.

**Don't train a reward model for a property a check can decide.** It is the most expensive mistake available and the least likely to be caught, because the result looks like a working number.

**Don't point a judge at a decidable property because the rubric already mentioned it.** The rubric is a description of the label; it is not an argument for using a model to compute it.

**Don't trust a scalar that has crossed a distribution boundary.** Same rule as [15.4](../module-15/lesson-04.md): model change, prompt change, new slice, re-fit.

**Don't compare a verifier's kappa to a judge's kappa as if they were competing entries.** They are answering different questions and the comparison is not meaningful; the coverage table is.

What teams actually do: a small module of verifiers — one per decidable rule, each with a test that names a failing item id — plus one validated judge per undecidable rule, plus a script that prints, per variant and split, each scorer's kappa, the coverage table and the price of the stack. The deciding question at the start of any new check is one line in the design doc: **decidable or not** — and everything else follows from that word.

## Reflect

1. Your stack is a judge and nothing else, at `$0.03794` a call, 57 items, five repeats, every PR. Compute the annual cost, compute what a citation verifier would remove from it, and write the paragraph that gets the verifier merged.
2. The coverage table says `missed by both: 0` on dev and `0` on test, for both scorers. Write the three sentences you would put in a design review that stop somebody treating that as a claim the system is correct, rather than a claim the two scorers are on this data indistinguishable from the labels.
3. The threshold sweep gives six distinct settings and you need to choose one. Write the sentence that says how you are choosing it, and say what you would have to collect to know whether `0.8` is still right in three months.
4. A team wants to train a reward model on preferences for "is this answer supported by the handbook". Write the two questions you ask before that training starts, and say what each one's answer would do to the plan.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Hunter Lightman et al., [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) — the
  paper that made "verifier" a term of art: a function trained or written to decide whether a step is right, as distinct from a model asked whether an answer is right. It is also the clearest statement of why a verifier has to be *specific* — a verifier for "does it cite" is not a verifier for "is it right".
- Nisan Stiennon et al., [Learning to summarize from human
  feedback](https://arxiv.org/abs/2009.01325) — the origin of the reward model as a scalar trained on pairwise human preferences. Read it for the thing this lesson is about rather than for the summarisation results: the model is trained to *order*, and every deployment that turns it into a pass/fail gate is adding a calibration step the training did not do.
- Nathan Lambert et al., [RewardBench: Evaluating Reward Models for Language
  Modeling](https://arxiv.org/abs/2403.13787) (2024) — the argument that reward models need their own benchmark because they were being compared without being measured, which is the same failure this lesson is about one level down.
- Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) — the rubric-judge design and the bias probes; the judge whose kappa figures appear in this lesson is this repository's recorded analogue of it, not that model.
- [JudgeBench](https://huggingface.co/datasets/ScalerLab/JudgeBench) (MIT) — the public set
  for *where judges fail on correctness rather than style*, which is the closest existing instrument to the question this lesson asks: not "which judge is best" but "which failures is this judge blind to".
