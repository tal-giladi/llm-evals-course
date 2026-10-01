---
id: "05.3"
module: 5
minutes: 16
practice_minutes: 45
prerequisites: ["05.2"]
objectives:
  - Tell a rubric that decides something apart from one that restates the question, using a counted failure category as the test.
  - Point at which rule in a rubric catches which failure category, and name the categories no rule catches.
  - State the full key a recorded verdict is tied to, and explain why a one-character edit invalidates every number on the screen.
volatility: concept
sources:
  - title: "G-Eval: NLG Evaluation using GPT-4 with Human Alignment (Liu et al., 2023)"
    url: https://arxiv.org/abs/2303.16634
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 05.3 · Rubrics that decide something

This is the centre of the module. A rubric is not a longer prompt — it is a list of clauses that change
the verdict, and the test of whether yours is one is a count from your own error analysis. It ends on the
keying rule: a recorded verdict belongs to an exact configuration, which is why the lab refuses to show
you another prompt's numbers as yours.

## Why it matters

Two teams build a judge for the same support assistant. Team A's prompt is two lines. Team B's prompt is
a numbered list. Both pass code review, both are called "an LLM judge", and both are wired into a nightly
job.

On the 94 items of the tuned system, Team A's judge reads kappa **0.40** and Team B's reads **0.77**.
Same items, same answers, same human labels, same day.

The interesting part is not that the longer prompt won. It is that **the shorter prompt was allowed to
ship at all**, and that nothing on its dashboard could have told anyone why. A judge with kappa 0.40 and
accuracy 70.2% does not look broken in a dashboard. It looks like an eval. It passes 65 of 94 answers —
more than the 47 the humans passed — and the extra 18 are invisible unless somebody goes and reads them.

And the reason nobody goes and reads them is the second failure, which is quieter. Team A's prompt is
edited, over six months, four times. Each edit is a small improvement somebody believes in. Nobody
re-measures against the humans, because the prompt is not part of anything they record. Six months later
the suite is a number with no provenance: there is no way to tell whether it is measuring the task or
measuring the last person to touch the text box.

A rubric without a counted failure behind each clause causes the first failure. A rubric without a key
causes the second. The lab models both, and the second one is the most important behaviour on the page.

## How it works

### A rubric is clauses, not adjectives

Here are the four prompts this lab ships, verbatim. Read them as four attempts at the same job.

**Plain** — the one that restates the question:

```
You are grading an answer. Is it good? Reply PASS or FAIL.
```

**Rubric** — three clauses and a conjunction:

```
Grade the answer against these rules:
1. It states the handbook fact correctly.
2. It cites the handbook section.
3. It adds nothing that is not in the handbook.
Reply PASS only if all three hold, otherwise FAIL.
```

**Stepwise** — the same three clauses as questions, with the verdict rule stated again at the end:

```
Answer each question in turn, then give the verdict.
Q1: Does the answer state the handbook fact correctly? YES/NO
Q2: Does it cite the handbook section? YES/NO
Q3: Does it add anything not in the handbook? YES/NO
Verdict is PASS only if Q1 and Q2 are YES and Q3 is NO.
```

**Critique-first** — no rules at all, a request for the reason first (lesson [5.5](lesson-05.md)):

```
First write one sentence naming the most important thing wrong with the answer, if anything. Then, on a new line, write VERDICT: PASS or VERDICT: FAIL.
```

Four prompts, same model, same 94 items, same answers, greedy single verdicts:

| Prompt style | TPR | TNR | Kappa | Accuracy | Judge pass rate | Disagreements with humans |
| --- | --- | --- | --- | --- | --- | --- |
| Plain | 89.4% | 51.1% | **0.40** | 70.2% | 69.1% | 28 of 94 |
| Rubric | 91.5% | 85.1% | **0.77** | 88.3% | 53.2% | 11 of 94 |
| Stepwise | 95.7% | 85.1% | **0.81** | 90.4% | 55.3% | 9 of 94 |
| Critique-first | 95.7% | 93.6% | **0.89** | 94.7% | 51.1% | 5 of 94 |

Read the last column and then the third. The rubric did not raise the pass rate; it **lowered** it from
69.1% to 53.2%, which brought it within three points of the humans' 50.0%. That is the signature of a
real fix: the score looks worse and the measurement gets better.

### The test that tells them apart

Ask of every clause: **how many real answers violate this?** A count from your own error analysis, not an
opinion about whether the clause sounds reasonable.

Clause 2 — *it cites the handbook section* — passes this test emphatically. On the tuned system, **47 of
the 47 answers the humans passed contain a `(Handbook …)` citation, and only 2 of the 47 answers they
failed do.** That clause splits the set almost perfectly in half, and 27 of the failures on this system are
the category it names. The rubric judge agrees with that citation rule on 81 of 94 items — it is mostly a
citation judge that also checks two other things.

Now write the vague version of the same clause: *the answer is clear and helpful*. How many of the 94
answers violate it? You cannot say. It has no count behind it, so it has no behaviour you could predict,
so you cannot tell whether ignoring it changed anything.

And the restatement, which is the failure this section is named after:

```
Grade the answer against these rules:
1. It is a good answer.
Reply PASS only if rule 1 holds, otherwise FAIL.
```

It has the shape of a rubric. It decides nothing. Every clause of a working rubric has to be a **testable
property of the answer**, and "good" is not a property of the answer — it is a verdict, which is the thing
you were trying to produce.

### Which rule catches which failure

A rubric is only as good as its mapping from rule to category. The taxonomy on the tuned system has four
failure categories, and the rubric's three clauses cover all four:

| Failure category | Items | Caught by the rubric judge | Which clause does the work |
| --- | --- | --- | --- |
| `no_citation` | 27 | 22 (81.5%) | rule 2 |
| `wrong_fact` | 12 | 10 (83.3%) | rule 1 |
| `over_refusal` | 6 | 6 (100%) | rule 1 — declining to state the fact is not stating it |
| `out_of_scope` | 2 | 2 (100%) | rule 3 — inventing a rule is adding one |

Two of those four rows are worth pausing on. An over-refusal has no obvious clause — the rubric never
mentions refusing — and it is caught anyway, because refusing to state the handbook fact fails rule 1. An
invented out-of-scope rule is caught by rule 3 for the same structural reason. **Neither is on the list
of things the rubric says it checks, and both were only caught because the rubric happened to be
complete by accident.** Write a rubric whose clauses are all about citations and you will ship a judge
with a 100% over-refusal rate and no idea why.

That is why the last column is the deliverable. A rubric without a rule-to-category mapping is three
sentences; with one it is a document somebody can review.

### The keying rule

Everything above depends on a rule the rest of the course rests on too, and it is the one the lab is
strictest about:

> **A recorded verdict is tied to an exact key.** The item and the system's answer it was given, the model
> build, the full prompt text character for character, the rubric, the few-shot example ids and the order
> they appear in, the answer order, the decoding settings, and the sample index. Change one field and you
> have a different judge, whose verdicts nobody has observed.

The page enforces this literally. The prompt box at the bottom of the lab is editable. Change one
character and the numbers above it do not change — and the page refuses to let them stand, showing:

> **No recorded run for this exact judge.** Changing a single character of the prompt produces a different
> judge, and the verdicts above were produced by a different one. Showing them here would be reporting
> another prompt's result as this prompt's.
>
> Closest recorded variant: "Qwen3 0.6B · Rubric · 0 shots"
>
> Differs from the closest recorded prompt at 1 place(s): line 5.

Five edits were run against the rubric prompt to check what the page does with them. Every one of them
produced the same refusal, and every one of them was reported as differing at a single line:

| Edit | Recorded run? | Diff the page reports |
| --- | --- | --- |
| `all three hold` → `all three really hold` | none | line 5 |
| `otherwise FAIL` → `or else FAIL` | none | line 5 |
| `Reply PASS only if` → `Reply PASS iff` | none | line 5 |
| one full stop appended at the end | none | line 5 |
| rule 2: `It cites` → `It does not cite` | none | line 3 |

Read the last row carefully, because it is the one that ships by accident. Inverting rule 2 produces a
judge that **passes exactly the answers that are missing a citation** — the precise opposite of the
criterion you meant — and the page's own diagnosis is `Differs from the closest recorded prompt at 1
place(s): line 3`. One line, one clause, one polarity, and the diff report is the same length as it was
for the full stop.

The page's own hint is where the rest of the course picks this up: this is the same keying rule that
makes judge-call caching safe in CI. A cache hit requires the prompt hash, the model build, the item and
the decoding settings to match exactly. A cache that keys on less than that will happily serve you a
verdict produced by a judge that no longer exists.

## Show me

This lesson's preset opens on `Llama 3.2 3B · Plain · 0 shots` — the rubric that restates the question —
variant A, on a random draw of 40 dev items at seed 7: pass rate **67.5%** (27 of 40), kappa **0.43**
(0.13–0.69), TPR **86.4%**, TNR **55.6%**, accuracy **72.5%**, confusion `tp 19, fp 8, fn 3, tn 10`.

Two lines below the tiles sits the prompt box, and the whole lesson can be run from it:

1. Read `You are grading an answer. Is it good? Reply PASS or FAIL.` and count how many of the 94
   items' real failures it would plausibly know to catch: 24, or 23, or 47.
2. Click **Pin as A**. That snapshot is now the "before" on the scoreboard.
3. Switch the Judge dropdown to `Llama 3.2 3B · Rubric · 0 shots` and watch the scoreboard diff. Same
   40 items, same seed: pass **65.0%**, kappa **0.79** (0.56–0.95), TPR **95.8%**, TNR **81.3%**,
   confusion `tp 23, fp 3, fn 1, tn 13`. TNR up 25.7 points, pass rate down 2.5.
4. Put the cursor at the end of line 5 and type one space. Read the refusal, then read the diff line.
5. Undo the edit. The numbers come back, because the key matches again.

> [!IMPORTANT]
> The verdicts behind all of these tiles come from a seeded educational model of judge behaviour, not
> from a live LLM. The model names in the Judge menu are the labels under which recorded runs are filed,
> not published benchmark results for those models. The four prompt texts are real; the verdicts they
> produced are modelled; every statistic computed from them is computed for real in your browser.

## Try it

**Predict first.** Take `Llama 3.2 3B · Rubric · 0 shots` on the tuned system. Write down:

1. Its TNR on the 94 items — above or below the plain judge's 51.1%, and by roughly how much?
2. Its pass rate — higher or lower than the plain judge's 69.1%? A fix that makes the number look worse
   is the expected outcome, so predict it before you see it.
3. If you add one clause to the rubric that no answer on your set violates, which of the five tiles moves?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=rubric)

1. **Give every clause a count.** For each of the rubric's three clauses, write the number of items on
   your own eval set that violate it. Any clause you cannot put a number on is a restatement; rewrite it
   or delete it. Rule 2 on this corpus splits the set 47/2 — that is what a working clause looks like.
2. **Break the conjunction.** Change `Reply PASS only if all three hold, otherwise FAIL` to `Reply PASS
   if at least two hold`. The page will refuse to show numbers — so do the work by hand: how many items
   would flip? Write the sentence you would use to report it, including the fact that you have no recorded
   run for it.
3. **Do the mapping table.** Take the four categories from the taxonomy and fill in the last column of the
   table above: which clause catches each one, and by what argument. If a category has no clause, write
   the clause you would add and the count that would justify adding it.
4. **Try the three edits in the keying table yourself**, in order: the inserted `really`, the inverted
   rule 2, and the trailing full stop. Note that the page's diff report is identical in length for all
   three. Then write the sentence you would put in a pull request if you saw that diff report attached to
   a changed kappa.
5. **Read a real disagreement.** Switch the panel to disagreements and open the rubric judge's. For each
   item, write one line: *which clause should have fired, and why did it not?* On the full 94 the
   rubric judge's 11 disagreements are 5 `no_citation`, 4 `correct`, 2 `wrong_fact` — five of them are
   missing citations it should have caught, which is a judge problem, not an eval-set problem.

## Break it

Three breaks, in increasing order of how long they survive.

**A rubric that restates the question.** `Grade the answer against these rules: 1. It is a good answer.`
The page would have no recorded run for it, and rightly so: nobody has ever watched it. If it ran, it
would produce a pass rate, the pass rate would go on a dashboard, and it would measure nothing. The lie:
**a numbered list of adjectives reads like rigour and behaves like the sentence it replaced.**

**A rubric with a clause nothing violates.** Add *4. It is written in complete sentences.* Nothing on
this set fails it, so it cannot move any verdict — but it makes the rubric look thorough and it makes the
judge longer, so it costs tokens on every call forever. The lie: **coverage you have not counted is
coverage you have not got.** You would have to read 94 answers to find out which clause is decorative.

**The break this module is built around: one character.** The page's refusal is the most important
behaviour in this lab, and the temptation is always the same — the tiles are still there, they still look
plausible, and the edit was an improvement. Every honest instinct says to keep reading down the page. The
page says no, and it is right, for a reason that has nothing to do with this page: **the tiles are another
prompt's verdicts.** Every number above the prompt box belongs to a judge that no longer exists. Leaving
them up and reading them as yours is not a display bug you can shrug at — it is the exact move that
produces a confident, wrong number, and it is the move most people make.

The narrower version of the same failure is the one that survives code review: the diff report says
`line 3`, the clause it points at is `2. It cites the handbook section`, and the edit inverted it. A diff
that says *one line changed* is not the same as a diff that says *which clause changed polarity*, and only
the second one is a review.

## Fix it

Four changes, and only the first one is a number:

1. **Write each clause as a testable property, and attach the count.** `It cites the handbook section` —
   47 answers satisfy it, 45 of the failures violate it. `It is clear` — no count, no clause. A rubric
   with one uncounted clause is one clause you cannot defend when a stakeholder asks why the judge missed
   their bug.
2. **Make the verdict line mechanical.** `PASS only if all of the above hold, otherwise FAIL` removes the
   judge's discretion over how to weigh the clauses, which is where generosity lives. That single line is
   the difference between a rubric and a discussion.
3. **Ship the mapping table with the rubric.** Rule, the category it catches, the count behind it. Three
   columns, one row per clause, and a row for every category with no clause — because an uncovered
   category is the thing you most need to know about.
4. **Record the key, and re-record it on every edit.** Prompt text character for character, model build,
   rubric version, few-shot ids and order, answer order, decoding settings. When any of them moves, the
   previous numbers do not get updated and re-labelled as new ones — they get archived under the old
   key, and the new key starts at no data. That is what the lab does when you edit the prompt box, and it
   is the behaviour to copy in your own runner rather than a limitation to work around.

## How do I know it works?

**Challenge, on dev.** Your rubric is done when all four of these hold:

- **Every clause has a count** from your dev set, and every failure category either maps to a clause or
  has a written note saying it does not.
- **TNR ≥ 0.85 per category on dev, with TPR ≥ 0.90.** The rubric judge on the tuned system's 94 items
  reads TNR **85.1%** and TPR **91.5%**; on the 57 dev items it reads TNR 81.5% and TPR 96.7%. Per
  category it is 81.5% `no_citation`, 83.3% `wrong_fact`, 100% `over_refusal`, 100% `out_of_scope` — so
  on this corpus it passes the 0.85 target on two categories and misses it on two, which is exactly the
  kind of thing a single total hides.
- **The verdict line is a conjunction**, and changing it is a new key rather than a tweak.
- **The pass rate moved toward the human rate**, not away from it. Rubric judge 53.2% against humans'
  50.0%, where the vague judge read 69.1%. A fix that raises the score above the humans' number has not
  fixed anything.

**Validation, once.** Press **Validate on test**. For `Llama 3.2 3B · Rubric · 0 shots` on the tuned
system: dev kappa **0.79** (0.59–0.93), test kappa **0.73** (0.49–0.94). It holds, with a wide interval
on 37 items — which is the honest size of the evidence you have. A rubric tuned until dev kappa is 1.00
and a test kappa of 0.4 is the outcome this button exists to catch.

## Use / don't use

**Do use** a written rubric for every judge that gates anything. It is the only artefact in a judge you
can review in a pull request, and a prompt nobody can diff is a prompt nobody can fix. Three to six
clauses is the useful range: more than that and you are describing an essay, fewer and you have a
restatement.

**Don't use** a rubric to replace the count. The rubric tells the judge what to look at; the count from
your error analysis tells you whether looking there was worth it. Teams that write excellent rubrics and
skip the count end up with three clauses covering 12% of their failures and a dashboard that has never
noticed.

**Don't reuse a rubric across systems.** A clause like *it adds nothing that is not in the handbook* is
doing very little on the handbook-tuned system and a great deal on the generic one. Rubrics are per
failure category and, in practice, per system family — and changing the system changes the key.

What teams actually do: keep the rubric in the repository next to the taxonomy, with the mapping table
attached; hash the prompt text and put the hash in every result row; keep the previous rubric's numbers
in the repository rather than overwriting them; and when the judge model is upgraded, re-validate the
whole rubric against the frozen human set before trusting a single tile again. The rubric is cheap.
Re-recording it after every edit is the part that is easy to skip and expensive to have skipped.

## Reflect

1. Your rubric has three clauses. Write the count of real answers that violate each one. For any clause
   you cannot count, say in one sentence what it is doing in the rubric and what you would delete to make
   the rubric honest.
2. Someone proposes deleting the human labels after the rubric reaches kappa 0.85 on dev and saving the
   labelling cost. Write the two sentences that would stop them, and say which part of the key you would
   have to keep anyway.
3. The page reports an edit as `Differs from the closest recorded prompt at 1 place(s): line 3`. Write
   what a reviewer has to check in those two lines before approving the new kappa, and why "the line
   count is small" is not an answer.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Yang Liu et al., [G-Eval: NLG Evaluation using GPT-4 with Human
  Alignment](https://arxiv.org/abs/2303.16634) (2023) — evaluation criteria written as weights on explicit
  reasoning steps, which is the formal version of the rule-to-category mapping this lesson asks you to
  ship.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — why the prompt is the reviewable artefact of a judge,
  and what happens when it is not reviewed.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the discipline underneath this
  lesson: the criterion is written before the automation, and the automation is measured against the
  humans, not against its own earlier version.