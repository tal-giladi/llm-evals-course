---
id: "07.4"
module: 7
minutes: 16
practice_minutes: 40
prerequisites: ["07.3"]
objectives:
  - Read a judge-size ladder with kappa, its bootstrap interval, TPR, TNR, cost and latency side by side, and say which differences the evidence supports.
  - Explain why a non-monotone ladder is the correct reading of a 57-item set rather than a defect in the data.
  - Convert a judge upgrade into an equivalent number of extra eval items and argue for spending it on items.
volatility: concept
sources:
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "A Coefficient of Agreement for Nominal Scales (J. Cohen, 1960)"
    url: https://doi.org/10.1177/001316446002000104
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 07.4 · Judge size, agreement and cost

The obvious question — should we use a bigger judge? — has a three-column answer, and the columns do not
agree with each other. This lesson reads a five-rung ladder honestly, including the two rungs that go
**down**, and converts the money a bigger judge costs into the thing that buys more: eval items.

## Why it matters

A team has a 3B judge with a kappa of 0.79. Somebody proposes moving to a 7B judge on the strength of a
leaderboard, a vendor benchmark, and the fact that 7 is bigger than 3. The proposal costs $0.09872 a call
against $0.03794, and 1250 ms against 540 ms, which means the nightly eval that finishes in four minutes
finishes in nine.

The supporting argument is usually a single number. Somewhere there is a table saying a 7B judge scores 0.86
where the 3B scores 0.79, and 0.86 looks like a win. What the table does not say is how many items it was
measured on, or how wide the interval around it is. On a normal eval set — 30 to 60 items — the interval on a
kappa of 0.79 is about 0.3 wide, and almost every pairwise difference a model leaderboard will ever show you
is inside 0.3.

So the team spends 2.6× the money and 2.3× the wall clock to buy a difference its eval set cannot resolve.
Meanwhile the eval set stays at 40 items, which is the actual reason every number on the dashboard wobbles.

## How it works

### The ladder, all five rungs, one configuration

Five rubric judges at 0 shots, all scoring the tuned system's answers, all on the **same 57 dev items** with
the greedy verdict. Nothing varies but the model:

| Judge | Kappa | Kappa 95% CI | TPR | TNR | Cost / call | Latency | 57-item run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Qwen3 0.6B | 0.68 | 0.47–0.86 | 86.7% | 81.5% | $0.01444 | 210 ms | $0.8231 |
| Qwen3 1.7B | 0.61 | 0.40–0.79 | 83.3% | 77.8% | $0.02244 | 380 ms | $1.2791 |
| Llama 3.2 3B | 0.79 | 0.62–0.93 | 96.7% | 81.5% | $0.03794 | 540 ms | $2.1626 |
| Flow-Judge 3.8B | **0.86** | 0.71–0.96 | 93.3% | 92.6% | $0.04680 | 700 ms | $2.6676 |
| Prometheus 2 7B | 0.79 | 0.64–0.93 | 93.3% | 85.2% | $0.09872 | 1250 ms | $5.6270 |

Cost goes up **6.8×** from the bottom rung to the top. Latency goes up 6.0×. Kappa goes **0.68 → 0.61 → 0.79
→ 0.86 → 0.79**.

### The ladder is not monotone, and that is the finding

Two of the four steps go down. Doubling from 0.6B to 1.7B moves kappa from 0.68 to **0.61**. Tripling again
from 3.8B to 7B moves it from 0.86 to **0.79**. If you were expecting "bigger is better" you do not get it,
and the instinct is to suspect the data. Do not. Check the intervals, because that is the whole answer:

| Comparison | Kappa difference | Do the intervals overlap? |
| --- | --- | --- |
| 0.6B → 1.7B | −0.07 | Yes, 0.47–0.79 |
| 1.7B → 3B | +0.18 | Yes, 0.62–0.79 |
| 3B → 3.8B | +0.07 | Yes, 0.71–0.93 |
| 3.8B → 7B | −0.07 | Yes, 0.71–0.93 |
| 0.6B → 7B (end to end) | +0.11 | Yes, 0.64–0.86 |

Every adjacent pair overlaps, and so does the two ends. On 57 items **no rung separates from any other** on
kappa. The step that looks like the biggest win on the table — 1.7B to 3B, +0.18 — is also the step that
changes the model *family*, from a Qwen-family model to a Llama-family one. So on this ladder size and family
move together and neither can be attributed. That is not a defect in the corpus; it is the honest state of the
evidence, and it is exactly the confound [7.3](lesson-03.md) was about.

### Read the other two columns before you decide

Kappa is not the number a gate reads. TPR and TNR are, and they have their own intervals:

| Judge | TPR | TPR 95% CI | TNR | TNR 95% CI | False alarms (of 27 real failures) |
| --- | --- | --- | --- | --- | --- |
| Qwen3 0.6B | 86.7% | 72–97% | 81.5% | 69–96% | 5 |
| Qwen3 1.7B | 83.3% | 68–95% | 77.8% | 62–93% | 6 |
| Llama 3.2 3B | 96.7% | 88–100% | 81.5% | 65–94% | 5 |
| Flow-Judge 3.8B | 93.3% | 83–100% | **92.6%** | 81–100% | **2** |
| Prometheus 2 7B | 93.3% | 83–100% | 85.2% | 70–96% | 4 |

The Flow-Judge 3.8B judge catches **2** of the 27 real failures wrongly waved through, where the two Qwen
rungs and the 3B judge wave through 5 or 6. If your gate is *"TNR ≥ 0.85"*, that is the only rung on this
ladder that clears it on the point estimate — and its TNR interval, 81–100%, still contains 81.5%, the value
the 3B judge reads. Which is the whole argument for this lesson: **on 57 items you cannot rank five judges
by agreement, so rank them by whether they clear your target, take the cheapest one that does, and spend the
rest on items.**

### What items buy instead

Interval width on a rate falls roughly like $1/\sqrt{n}$. Measured, on this judge and this corpus, by drawing
60 random dev subsets at each size and averaging the bootstrap kappa interval:

| Items | Mean kappa 95% CI width |
| --- | --- |
| 20 | 0.470 |
| 30 | 0.434 |
| 40 | 0.373 |
| 57 | 0.312 |

Now convert the upgrade into items. Moving the 57-item run from the 3B judge to the 7B judge costs

$$(0.09872 - 0.03794) \times 57 = \$3.4645$$

Spent at the 3B price instead, that buys

$$\$3.4645 \div \$0.03794 = 91 \text{ extra items}$$

which takes you from 57 to 148. At the $1/\sqrt{n}$ rate your kappa interval goes from 0.312 to roughly
**0.19**. The upgrade bought at most 0.07 of point estimate between two rungs whose intervals both contain
the overlap; the items buy a third of the interval off every number on the board, including the ones you have
not measured yet.

## Show me

The preset opens the lab on `Qwen3 0.6B · Rubric · 0 shots` — the **bottom rung** — with the size panel on
screen. The panel always prints all five rungs, regardless of which one is selected, and highlights the row
your Judge dropdown is on. Starting at the bottom is deliberate: read the ladder upwards and watch the
highlighted row climb while the number does not.

The panel carries seven columns and the order matters. Kappa and its interval first, then TPR and TNR, then
the two columns that decide the budget: cost per call and latency per call. Every one of the five judges
prints the **same three-clause rubric** in the prompt box below — same model prompt, same format, same
`PASS only if all three hold` — so nothing but the model differs.

The cost panel under the agreement tiles prices the current run at the selected rung: the 0.6B judge calls at
$0.01444 a call and 210 ms, the 7B judge at $0.09872 and 1250 ms. The cost of a run is `cost per call ×
items`, and the 5-repeats line is the honest number for a judge that gates.

> [!NOTE]
> > All five rungs are recorded runs of the lab's seeded educational model, filed under the labels
> > `Qwen3 0.6B`, `Qwen3 1.7B`, `Llama 3.2 3B`, `Flow-Judge 3.8B` and `Prometheus 2 7B`. They are the
> > menu the lab offers, not published benchmark results for those models, and no row here should be quoted
> > as one. The intervals, the rates and the prices are exact arithmetic on 57 recorded verdicts each.

## Try it

**Predict first**, on paper, before opening the page:

1. From `Qwen3 0.6B` at kappa 0.68 to `Prometheus 2 7B` at kappa 0.79, how many times more expensive is the
   top rung? And how many more items would that money buy at the bottom rung's price?
2. If kappa intervals on 57 items are roughly 0.3 wide, what is the smallest real difference between two
   judges this eval set could resolve?
3. Read the ladder as a ranking. Which judge is "second best"? Now find the pair of rungs you would be least
   able to tell apart, and say which column in the table settled it.

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=size)

1. **Read all five rows before you touch the dropdown.** Write the kappa column down, then draw a line under
   it. Say out loud that 0.68, 0.61, 0.79, 0.86, 0.79 is not a ranking, and identify which two steps go down.
   Then do the interval check on paper for all four adjacent pairs before you look at the CI column.
2. **Move the Judge dropdown up the ladder, one rung at a time**, and watch the highlighted row change while
   the tile above recomputes. The tiles are your own judge on your own draw; the panel is all 57 dev items.
   Those are two different measurements and conflating them is the easiest mistake on this page.
3. **Price the ladder at your own eval-set size.** Take your real number of items, multiply by each rung's
   cost per call, and write the five monthly numbers. Then do the same for latency at 200 items run
   serially, and find out at which rung your nightly job stops fitting in its window. The 7B judge is 1250 ms
   a call; 200 calls is 250 s, and at five repeats it is 1250 s.
4. **Find the rung that clears your target and stop there.** Write a real TNR target — say 0.85 — then find
   the cheapest rung on the ladder that clears it on the point estimate. Check its TNR interval. If the
   interval straddles your target, say what that means for using it as a gate.
5. **Test the family confound yourself.** Compare the two Qwen-family rungs with each other, then compare the
   1.7B rung with the 3B rung. The second pair changes family as well as size. Write the one sentence that
   explains why the second comparison is the one to distrust, and check whether you can point at any column
   in the table that separates them.

## Break it

**Buy the top rung and quote the point estimate.** Move to `Prometheus 2 7B`, see kappa 0.79, and write *"we
upgraded our judge and it agrees better"*. It agrees 0.79 — exactly where the 3B judge already was, for
2.6× the money and 2.3× the latency. The lie has a name: **a point estimate with an interval that overlaps
its neighbour is not a ranking, and reading it as one is how teams spend seven times their judge budget on
nothing.**

**The subtler break is picking the maximum.** The best kappa on this ladder belongs to the **3.8B** rung,
not the 7B rung. That is what happens when the table has 57 items on it — the maximum of five noisy numbers
is usually not the largest number, and treating the max as "the best model" means you have selected on noise.
Worse, it is *argmax on the same 57 items you validated on*: the 3.8B rung's TNR of 92.6% has an interval of
81–100% and the only reason it looks best is that on this particular draw it happened to catch 2 of the 27
failures instead of 5.

**The third break is trusting the ladder after a split.** Take the same five judges to the **37 held-out
items**:

| Judge | Dev kappa (57) | Test kappa (37) |
| --- | --- | --- |
| Qwen3 0.6B | 0.68 | 0.67 |
| Qwen3 1.7B | 0.61 | 0.73 |
| Llama 3.2 3B | 0.79 | 0.73 |
| Flow-Judge 3.8B | **0.86** | **0.62** |
| Prometheus 2 7B | 0.79 | **0.89** |

The best judge on dev is the worst judge but one on the split it was not tuned on. The 7B judge — last place
on dev, best on test. That is not noise you can average away; it is 37 items, and it is the clearest possible
demonstration that this ladder cannot rank anything.

## Fix it

Four changes, all on the page:

1. **Choose by target, not by rank.** Write the TNR the gate needs and the TPR you will not go below, then
   take the **cheapest** rung that clears both on dev. A `TNR ≥ 0.85 and TPR ≥ 0.90` target leaves exactly two
   rungs on this ladder: `Flow-Judge 3.8B` at $0.04680 and `Prometheus 2 7B` at $0.09872 — and the cheaper one
   is the fourth rung, not the top. Loosen the TNR target to 0.80 and `Llama 3.2 3B` clears both at
   $0.03794. Write the target into the config, next to the model name, so the choice is reviewable.
2. **Spend the difference on items.** Upgrading from 3B to 7B on 57 items costs $3.4645; at the 3B price that
   is **91 more items**, taking the interval from 0.31 wide to about 0.19. Items narrow every number you have
   not measured yet, including the ones you will be asked about next quarter.
3. **Price the judge in your own runbook, per call and per millisecond.** Both are on the page and neither is
   free. Latency is the one people forget: a judge at 1250 ms is a judge inside your nightly budget, and a
   judge at 210 ms is a judge you could put on a pull request.
4. **Pin the judge by the provider's version string, not its display name.** The Judge menu labels here are
   `Llama 3.2 3B`, `Qwen3 1.7B` and so on — those are the names runs are *filed* under. Two different
   weights can answer to the same label. A result key holding only the label cannot tell you that your judge
   changed under you, and nothing in the pass rate will tell you either.

And the ceiling: if no rung clears your target, the problem is not the judge size. Go back to the rubric
([5.3](../module-05/lesson-03.md)) and to one failure per judge ([5.1](../module-05/lesson-01.md)). A bigger
model reading a vague question gets you a more confidently wrong answer to a question you have not agreed on.

## How do I know it works?

**Challenge, on dev.** Write two numbers before you look at the ladder:

- **TNR ≥ 0.85 and TPR ≥ 0.90 on 57 dev items**, stated as a sentence with the numbers in it. On this
  ladder: `Qwen3 0.6B` 81.5%/86.7% fails both, `Qwen3 1.7B` 77.8%/83.3% fails both, `Llama 3.2 3B`
  81.5%/96.7% fails the TNR, `Flow-Judge 3.8B` 92.6%/93.3% passes both, `Prometheus 2 7B` 85.2%/93.3% passes
  both. Exactly two rungs clear it, and the cheaper one is the third rung up, not the top.
- **The interval on the chosen rung reported with the number.** If the interval straddles your target — and
  `Flow-Judge 3.8B`'s TNR interval is 81–100% against a target of 85 — then the judge passes the challenge
  on the point estimate and does not pass it with confidence. Write that sentence down; it is the honest one.

**Then one held-out validation** on the 37 test items, and this is where the ranking dissolves. The dev
ordering and the test ordering are not merely noisy versions of each other; they disagree about which rung is
best and which is third-from-last. The correct conclusion from the validation is not "pick the test winner" —
it is **"this eval set cannot rank these judges, so rank them by target and re-run the ranking on a set large
enough to have an opinion."** The test split is 37 items. To separate two judges whose kappas differ by 0.07
on 57 items, you would need an eval set an order of magnitude larger, and you should price that against
$3.4645 of judge spend before you spend it.

## Use / don't use

**Do** start at the cheapest rung and go up only when a target fails. Most judges that need a rubric clause
more than they need parameters will tell you so at the bottom of the ladder, and it costs $0.82 to find out
on 57 items.

**Don't** rank judges by kappa on a set of a few dozen items, and never pick the maximum. Two independent
reasons, both in this lesson: the intervals overlap, and the maximum of five noisy numbers is a selection,
not a result.

**Don't** spend a judge's price on arguments the eval set cannot settle.** The money buys a narrower interval
on a number you already have; items buy a narrower interval on every number, including the ones you have not
measured. At $0.03794 a call, items are the better purchase by a wide margin, and that ratio only improves as
your judge gets more expensive.

What teams actually do: one judge per failure category, each pinned to a target rather than a ranking, each
re-validated when the provider ships a new version; the eval set grows first and the judge model grows second;
and the runbook carries cost per call and latency per call next to the kappa, so the cost conversation happens
with the number rather than after it.

## Reflect

1. Someone proposes the 7B judge over the 3.8B judge. The 3.8B reads kappa 0.86 on dev and 0.62 on the
   held-out 37; the 7B reads 0.79 and 0.89. Write the two sentences that end the conversation — one for the
   person proposing, one for the person who has to sign the invoice.
2. Your eval set is 57 items and your kappa intervals are about 0.3 wide. Given [7.3](lesson-03.md)'s noise
   floor of 12 points of pass rate between two runs of the same judge, write down how many items you would
   need before any judge comparison on this set means anything.
3. Price your own ladder. Write the cost per nightly run at three rungs, the wall-clock time at each, and the
   sentence you would put in a design document explaining why you chose the rung you chose.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the reference point for judge strength and for the
  family-and-size confound that a five-rung ladder cannot separate.
- J. Cohen, [A Coefficient of Agreement for Nominal Scales](https://doi.org/10.1177/001316446002000104)
  (1960) — kappa, and why agreement has to be corrected for what a coin guessing the majority label would
  have managed.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the discipline this lesson applies to
  the judge itself: measure the thing you depend on, on labelled data, before you depend on it.