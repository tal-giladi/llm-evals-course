---
id: "05.5"
module: 5
minutes: 14
practice_minutes: 40
prerequisites: ["05.4"]
objectives:
  - Decide between a verdict-only judge, a rule-trace judge and a critique-first judge, and name what each one makes checkable.
  - Audit recorded critiques against the human category and say what share you would require before trusting them.
  - Price a critique-first judge against its verdict-first twin at the same size and state what the critique actually costs.
volatility: concept
sources:
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "G-Eval: NLG Evaluation using GPT-4 with Human Alignment (Liu et al., 2023)"
    url: https://arxiv.org/abs/2303.16634
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 05.5 · Verdict-first or critique-first

A judge that answers PASS and nothing else can be counted but not argued with. A judge that answers one
sentence of reason and then PASS can be checked by a person who disagrees with it — which is the whole
reason to pay for the extra sentence, and the reason it is also the fastest route into Module 6's
disagreement review.

## Why it matters

A nightly eval passes 57 items. This morning it passes 42. Somebody paged. The run log contains this:

```
run 2026-03-14T02:11:07Z  judge=llama-3.2-3b rubric v4  pass=42/57
run 2026-03-07T02:10:55Z  judge=llama-3.2-3b rubric v3  pass=57/57
```

Nobody knows which of three things happened. The system regressed. The system did not regress and fifteen
items were always marginal. Or the rubric was reworded in v4 and the judge got stricter. All three
produce this log, and the log does not contain enough information to tell them apart, because the judge
only ever emitted a word.

The failure is not the regression. The failure is that the team will spend a day investigating, and then
the next time this happens they will spend a day again, because the artifact that would have answered the
question in ninety seconds was never recorded.

This is the module's last design decision, and it is the one with the clearest payoff: **a judge that
writes its reason is the only kind of judge whose errors you can triage without re-running anything.**

## How it works

### Three output shapes

| Shape | The judge writes | Checkable? | Audit trail | Cost on this lab |
| --- | --- | --- | --- | --- |
| Verdict only | `PASS` | no | none | 38 output tokens |
| Rule trace (stepwise) | `Q1: YES  Q2: NO  Q3: YES  VERDICT: FAIL` | yes, against the rubric | the clause that fired | 38 output tokens |
| Critique first | one sentence naming the worst problem, then `VERDICT: FAIL` | yes, and readable by a non-expert | the reason in prose | 38 tokens at 3B, 80 at 3.8B |

The third shape is the prompt this lab ships:

```
First write one sentence naming the most important thing wrong with the answer, if anything. Then, on a new line, write VERDICT: PASS or VERDICT: FAIL.
```

Note what it does *not* contain: no rubric, no clause list, no numbering. That is deliberate and it is
the interesting part of the design. The critique-first judge is not told what to look for — it is asked
to name the worst problem and is then made to commit to a verdict after writing it down. Writing the
reason first forces the verdict to be consistent with it, because the sentence is already on the page
when the verdict is produced.

### What it buys, on the same items

Same model, same 94 items of the tuned system, greedy single verdicts:

| Judge | TPR | TNR | Kappa | Kappa 95% CI | Judge pass rate | Disagreements |
| --- | --- | --- | --- | --- | --- | --- |
| `Plain · 0 shots` | 89.4% | 51.1% | 0.40 | 0.23–0.57 | 69.1% | 28 |
| `Rubric · 0 shots` | 91.5% | 85.1% | 0.77 | 0.62–0.89 | 53.2% | 11 |
| `Stepwise · 2 shots` | 95.7% | 85.1% | 0.81 | — | 55.3% | 9 |
| `Critique-first · 2 shots` | 95.7% | 93.6% | **0.89** | 0.79–0.98 | 51.1% | **5** |

On the dev/test split, the same pair reads: rubric **0.79** on the 57 dev items and **0.73** on the 37
held-out; critique-first **0.86** on dev and **0.95** on test. Five disagreements instead of eleven is
the number to hold on to — it is half the work for whoever reads the disagreements next.

Two items from the tuned system show what that means in practice.

**A real failure the rubric judge waved through.** `s60`, asked *What is the daily rate for meals while
travelling?*, answered *"There is no daily rate; meals are reimbursed at actual cost always."* The
humans labelled it a failure — it states a rule the handbook contradicts. The rubric judge's five samples
were `[1, 0, 1, 1, 0]`: three passes, two fails, and the greedy verdict is **PASS**. The clause that
should have fired is rule 1, and the judge passed it anyway. The critique-first judge on the same item
recorded `[0, 0, 0, 0, 0]` — five fails out of five.

**A correct answer the rubric judge failed.** `s15`, asked *How long is the probation period?*, answered
*"3 months, with a written review at the end. During probation the notice period is waived. (Handbook —
Working here)"* — cited, correct, and labelled a pass. The rubric judge's samples were `[0, 1, 1, 1, 1]`,
so the greedy verdict is **FAIL** on four samples out of five that say pass. That single unlucky draw is a
false alarm in your nightly report, and you cannot tell it from a real one because there is no reason
attached. The critique-first judge recorded `[1, 1, 1, 1, 1]`.

### The reason is not automatically right either

This is the part that decides whether a critique-first judge is a measurement or a mood. The lab records
the critique sentence for two menu entries; the `Flow-Judge 3.8B · Critique-first · 3 shots` entry is
the readable one. Read its critique on each of the 94 tuned-system items and compare it with the category
the humans assigned:

- **83 of 94 name the same category the human named.**
- 11 do not — and **6 of those 11 are items the humans passed**, where the judge wrote *"The stated rule
  contradicts the handbook section."* On `s15`, `s29`, `s57`, `s76`, `s81` and `s94` the answer is correct
  and cited, and the critique confidently says the opposite.
- 3 are `no_citation` items where the judge wrote *"Correct, grounded and cited."*
- 2 more are `over_refusal` and `out_of_scope` items where it wrote a pass-shaped sentence.

So the critique is checkable and it is wrong about one answer in eight. That is still worth having — a
reason you can disagree with is infinitely more useful than no reason — but it is a **second measured
quantity**, and if you do not measure it you have simply moved the failure somewhere you are not looking.

### What it costs

Here the honest answer is two different answers, depending on which menu entry you read, and both are
worth stating.

At the 3B size the lab prices the critique-first entry **exactly the same** as the rubric entry:
660 input tokens, 38 output tokens, $0.03794 a call, 540 ms, **$1.5176** for a 40-item run. The critique
is free in dollars and free in latency, and the only reason is that the price sheet does not model the
extra output.

At the 3.8B size it does. `Flow-Judge 3.8B · Rubric · 0 shots` is 680 in / **40** out, $0.0468, **$1.8720**
per 40 items. `Flow-Judge 3.8B · Critique-first · 3 shots` is 680 in / **80** out, $0.0528, **$2.1120** per
40 items. Output tokens double and the run costs **24 cents more** — about 13%. Input tokens are
unchanged, because the critique comes out, not in.

That 13% is the number to carry into a budget: the critique is not an expensive feature, but it is not
free, and at 200 items nightly across four category judges it is about $4.80 a night more than the
verdict-only version. What you are buying with it is a triage queue you can read.

## Show me

The preset for this lesson opens the lab already on `Llama 3.2 3B · Critique-first · 2 shots`, variant A,
on a random draw of 40 dev items at seed 7: pass rate **57.5%** (23 of 40), kappa **0.85** (0.66–1.00),
TPR **95.5%**, TNR **88.9%**, accuracy **92.5%**, confusion `tp 21, fp 2, fn 1, tn 16`.

One comparison and it is the whole lesson:

1. **Pin as A.**
2. Switch the Judge dropdown to `Llama 3.2 3B · Rubric · 0 shots`. Same model, same items, same seed.
   Read the diff on the scoreboard: TNR down, disagreements up from two to three on this draw, pass rate
   up — the verdict-first judge is the more generous of the two here.
3. Read the prompt box at the bottom of the page for each. The critique-first prompt is one paragraph and
   contains no rules at all; the rubric prompt is three numbered clauses. Neither is the better *prompt* —
   they are different instruments, and the menu holds both because the comparison is the point.
4. Move **Repeats** to 5 on the critique-first entry and watch the cost line go from $1.5176 to $7.5880.

> [!NOTE]
> These are recorded runs of the lab's seeded educational model, filed under the menu labels
> `Llama 3.2 3B · Rubric · 0 shots` and `Llama 3.2 3B · Critique-first · 2 shots`. The names identify
> which recorded configuration produced a verdict; they are not measurements of those models in the wild,
> and the $0.03794 a call is this course's own recorded price for its educational model, not a provider's.

## Try it

**Predict first**, with the critique-first judge loaded on the tuned system:

1. Over the 94 items, how many of the 47 answers the humans failed does it let through — more or fewer
   than the rubric judge's 7?
2. Its judge pass rate: above or below the rubric judge's 53.2%?
3. Two human failures on this system are `out_of_scope` — invented rules. The critique-first prompt has
   no rule about inventing rules. Does the judge catch them anyway?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=format)

1. **Read the disagreements as a queue.** Switch the panel to disagreements on the critique-first judge,
   then on the rubric judge. On the full 94 the rubric judge's 11 disagreements are 5 `no_citation`,
   4 `correct`, 2 `wrong_fact`; the critique-first judge's 5 are 2 `no_citation`, 2 `correct`,
   1 `over_refusal`. Now ask the question that separates the two designs: for each disagreement, how long
   does it take you to work out whether the human or the judge is right?
2. **Find `s60` and `s15`.** Switch *How many items* to **All of them** and find them in the list. They
   are the two items in this lesson's worked example. Write down which of the two judges you'd rather
   have on a nightly alert for each one, and why the answer is not the same for both.
3. **Answer the third prediction.** Search the 2 `out_of_scope` items. The critique-first prompt never
   mentions them. Did the judge catch them, and if so, does the reason it wrote make sense given that it
   had no clause to apply? This is the `over_refusal` case from [5.3](lesson-03.md) all over again.
4. **Price the critique at your own size.** Take your judge suite's item count and repeat count, price
   the verdict-first version and the critique-first version on your provider's sheet, and write the
   difference per month. Then write down how many engineer-hours a month of readable disagreements is
   worth — that is the trade, and it is the only part of this lesson that is genuinely about money.
5. **Audit twenty critiques.** Pick twenty items where the human category is known and read what the
   critique-first judge wrote. Count how many name the category the human named. The lab reads 83 of 94
   on this system; yours will read lower, because yours will be a real judge on real answers.

## Break it

**Store the critique and never read it.** This is what most teams do by accident: the prompt asks for a
reason, the runner stores it in a column, nobody opens the column. The critiques get longer, the cost
goes up 13%, and the triage queue still does not exist. The lie is named: **a recorded reason nobody
reads is a bill for a feature you did not build.**

**The worse one: read the critique instead of the verdict.** Within a month somebody is reading the
critique column in the disagreement queue, because it is right there and it explains itself. Now the
system has a human in the loop reading generated prose and making the call, and calling that an "LLM
judge" on a dashboard. It is not the judge any more — the judge is a suggestion engine with a person
approving it, and the pass rate on the dashboard is a measure of the person's afternoon. Worse, this is
the failure with the longest fuse: it works well enough that nobody notices it is a different system.

**The third break is trusting the critique because the verdict is good.** The `Flow-Judge 3.8B` entry is
the clearest example in this lab: it writes *"The stated rule contradicts the handbook section"* about six
correct, cited answers. Its kappa is 0.77 — the same as the 3B rubric judge's — and its verdicts are
reliable enough to gate on. The reasoning is not reliable, and nothing on a kappa tile would ever have
told you. **A judge with a good verdict rate and an unmeasured reason is a judge whose disagreements you
cannot triage.**

**And the one people expect to be true: a bigger critique-first judge is a better one.** It is not, on
this corpus. `Flow-Judge 3.8B · Critique-first · 3 shots` reads kappa **0.77** on the 94 items, against
**0.89** for `Llama 3.2 3B · Critique-first · 2 shots`; dev **0.75** against **0.86**. The larger model
is 1.4× the price ($0.0528 against $0.03794 a call). The gap between those two kappas spans the whole
range where you cannot tell which is better — which is the argument for reading the interval before the
model name.

## Fix it

Four changes:

1. **Put the critique on its own line, in a format a parser can read.** `First write one sentence …
   Then, on a new line, write VERDICT: PASS or VERDICT: FAIL.` The new line is load-bearing: it makes the
   verdict extractable without parsing prose, so the critique can never be the thing the pipeline reads
   by accident.
2. **Store the critique with the verdict, under the same key.** Same item, same model build, same prompt
   hash. A critique recorded against a different key than its verdict is a sentence about a verdict
   somebody else produced, and [5.3](lesson-03.md) already explained why that matters.
3. **Audit the critiques on the frozen human set.** Twenty items, once a quarter: read the critique,
   check it against the human's category, count the agreements. This lab reads 83 of 94; a judge below
   85% on that audit can keep its verdicts and loses its reasons — you keep the sentence for triage on
   the items where it agrees and fall back to reading the raw answer where it does not.
4. **Keep the reason and the verdict separable.** If you cannot write the rule that turns a critique into
   pass or fail, you do not have a judge — you have a second opinion generator with a confident voice.
   The verdict is the artefact; the critique is the explanation attached to it.

## How do I know it works?

**Challenge, on dev.** A critique-first judge is finished when all four hold:

- **Kappa ≥ 0.85 on dev with TPR ≥ 0.90.** `Llama 3.2 3B · Critique-first · 2 shots` reads kappa **0.86**
  on the 57 dev items with TPR 93.3% and TNR 92.6%; the rubric judge on the same items reads 0.79,
  96.7%, 81.5%. It passes as loaded.
- **The disagreements are few enough to read.** Five of 94 on this corpus. If the queue is longer than
  you will actually read, the number on the dashboard is being produced by nobody.
- **The critique audit clears 85%** against the human category on twenty items, and you have written down
  what you do about the ones that fail.
- **The critique is never the thing the pipeline reads.** Grep your own runner for which field goes into
  the pass-rate column. If it is not obviously the verdict, somebody will eventually make that change.

**Then one held-out validation.** Press **Validate on test**. The critique-first judge reads kappa
**0.95** (0.83–1.00) on the 37 held-out items with TPR 100.0%, TNR 95.0% and a single disagreement,
against the rubric judge's 0.73 and five. That is a real improvement on a real split — and with one
disagreement in 37 items it is also the smallest evidence base in this course, so the next thing you do is
add items, not conclusions.

## Use / don't use

**Do use** critique-first for the judges you will have to debug: the gate on your most valuable flow, the
check that pages someone, anything where you will spend time reading disagreements anyway. On this lab's
price sheet that is about 13% at the 3.8B size — $0.24 a run at 40 items — and it removes eleven
disagreements down to five.

**Don't use** it for the checks you expect to be quiet. Thirty code-level "does the output parse" style
judges do not need a reason column, and the reason you do not add one is that the reason will be wrong
sometimes and somebody will act on it.

**Don't use** a critique as a verdict, a critique as a severity score, or a critique as the input to
another model that makes the actual decision. Each of those puts generated prose on the critical path
without measuring it, and [5.4](lesson-04.md)'s lesson applies with more force: a thing you did not
validate is a threshold you did not choose.

What teams actually do: verdict-first by default, critique-first for the one or two judges that page
somebody; store both fields under one key; audit the critique quarterly against the frozen human set;
and when a release gate fires, open the critique first and the verdict second. That last habit is the
cheapest debugging tool in this module — Module 6 turns it into the disagreement review, which is where
the critique pays for itself several times over.

## Reflect

1. Your nightly log shows a 15-item drop and one sentence per item is stored. Write the two sentences you
   would put in the incident review, and say which of the three possible causes each one rules out.
2. The critique-first judge on your set agrees with the human category on 83 of 94 items and writes
   *"The stated rule contradicts the handbook section"* about six correct answers. Write the policy you
   would adopt for its disagreement queue — where the critique is trusted, and where you fall back to
   reading the answer yourself.
3. A teammate points out that the 3.8B critique-first judge costs more and scores worse than the 3B one,
   and proposes removing the critique entirely. Write the reply that concedes the point and keeps the
   feature, in two sentences, using the disagreement count rather than the kappa.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — position bias, verbosity bias and self-preference as
  judge failure modes, and the reference-guided design this lesson's output shapes come from.
- Yang Liu et al., [G-Eval: NLG Evaluation using GPT-4 with Human
  Alignment](https://arxiv.org/abs/2303.16634) (2023) — making the judge write its reasoning before its
  score, and the evidence that the written step is what carries the agreement.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit this lesson is really
  about: keep enough of the judge's output that a human can disagree with it and find out why.