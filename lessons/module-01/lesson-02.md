---
id: "01.2"
module: 1
minutes: 16
practice_minutes: 35
prerequisites: ["01.1"]
objectives:
  - Write a success criterion for one feature so that two people labelling the same answer reach the same verdict.
  - Explain, using the support set, why the citation clause decides more items than the accuracy clause.
  - Tell the difference between a vague criterion, a vague check and a specific criterion measured by a vague check.
volatility: concept
sources:
  - title: "Define success criteria and build evaluations (Claude Platform Docs)"
    url: https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
  - title: "Your AI Product Needs Evals (Ham Husain, 2024)"
    url: https://hamel.dev/blog/posts/evals/
  - title: "The Measurement of Observer Agreement for Categorical Data (Landis & Koch, 1977)"
    url: https://doi.org/10.2307/2529310
last_verified: "2026-10-01"
---

# 01.2 · What "good" means for one feature

An eval set is only as good as the definition of good behind it, and "is this answer good?" is not a
definition: it is a mood. This lesson writes a criterion decidable enough to label, and shows what
happens to the numbers when the second clause of that criterion is the one that does the work.

## Why it matters

A team builds an eval set for the support bot. The brief to the three engineers labelling it says: "mark
the answers that are good". They each read the same 20 answers independently. The first passes 14, the
second passes 11, the third passes 9. Nobody is wrong and nobody is lying. On nine of the 20 items, two
labelers disagreed.

That eval set is now worse than useless, and it is worse than useless in a specific way: it looks like
data. It has rows, it has columns, it can produce a pass rate, and the pass rate will be quoted in a
planning meeting as though 65% of the bot's answers are good. Every downstream number inherits a
definition that three competent people could not apply consistently. The usual response is to average the
three labelers, which produces a number nobody in the room believes.

The cause is not carelessness. "Good" is a word about a feeling, and the labeller is being asked to turn a
feeling into a verdict with no other instruction. Writing the criterion is not paperwork before the eval;
the criterion *is* the eval. Everything downstream — which check to use, what a pass rate means, whether
the number can gate a release — is a consequence of how clearly the criterion was written.

## How it works

The feature under test: **the support bot answers a question about the company handbook.** That is one
feature, narrow enough to be decidable, which is the whole trick.

A vague version: *the answer is good*.

A decidable version:

> The answer passes if it **states the handbook fact correctly** **and** **cites the handbook section**.

Now the interesting part is that second clause, and here is where it bites. Two answers from the same
system, both about paid time off:

| Item | Answer | Human verdict | Why |
| ---- | ------ | ------------- | --- |
| `s01` — "How many days of paid time off do I get each year?" | "You get 25 days of paid time off per year, accrued monthly." | **fail** | right answer, but nothing ties it to the handbook, so it is not verifiable |
| `s02` — "What if I do not use all my PTO before December 31?" | "You can carry over at most 5 unused days into the next year. Anything above that is lost. (Handbook — Leave and time off)" | **pass** | correct and cited |

`s01` is factually right. A human who only checked the fact would pass it. The criterion says a
support answer has to be traceable, because the user's real question is not "what number did the model
recall" but "what does our policy say, and where can I check". That is a product decision, and it is
exactly the kind of decision a vague criterion hides.

**The second clause is what makes most answers fail.** In the 57 labelled dev items, the humans fail the
tuned system on 27 answers: 15 are `no citation`, 7 state a wrong fact, 3 refuse a question the handbook
answers, and 2 state a policy as fact where the handbook is silent. The citation clause alone accounts for
**15 of 27 failures — 55.6%** — on a system whose facts are mostly right. (The disagreements view of the
same lab lists these item by item, grouped by the label the human wrote.)

This is worth sitting with, because it changes what you optimise. A team that assumes the accuracy clause
is the hard one will spend the quarter tuning retrieval. A team that reads the labels sees that most of
the loss is a formatting and grounding problem, and a citation instruction in the prompt is a much cheaper
fix.

Now the two ways a criterion goes wrong, and they are different failures:

- **A vague criterion** — "is this good?" — cannot be labelled consistently, so the eval set is noise
  before any judge is involved.
- **A vague check on a specific criterion** is worse, because it produces confident numbers. Give the same
  decidable criterion to a check that has not been told what it means, and it will still hand you a pass
  rate. The number is the thing that travels; the criterion is the thing nobody re-reads.

Write the criterion so that two people who disagree can both show their work. "Feels more helpful" cannot.
"Does not contain a number that contradicts the handbook section it names" can.

## Show me

Open the page this lesson links to and it loads one recorded run: a judge whose entire prompt is

> You are grading an answer. Is it good? Reply PASS or FAIL.

scoring the tuned system's answers on 40 randomly drawn dev items. The scoreboard shows:

| Number | Value | Interval |
| ------ | ----- | -------- |
| Judge pass rate | **67.5%** (27 of 40) | 52.0%–79.9% |
| Kappa vs humans | **0.43** | 0.13–0.69 |
| TPR | **86.4%** | 70.4%–100.0% |
| TNR | **55.6%** | 31.3%–77.8% |
| Accuracy | **72.5%** | 57.5%–85.0% |

The confusion table underneath is `tp 19, fp 8, fn 3, tn 10`. Read the human row: `19 + 3 = 22` of these
40 items were passed by the people who labelled them by hand. So on the same 40 answers, the humans say
**55.0%** and the judge says **67.5%** — the judge is 12.5 points optimistic, and eight real failures got
a pass. Three of those eight were `no citation` failures: the judge does not check for the clause that
decides most of the set, because nobody told it to.

The page also prices the run, which is the part teams forget: **$0.03794 per call, 40 calls, $1.5176**;
five repeats would be **$7.5880**; 540 ms per call. Cheap. The expensive part of an eval is not the judge,
it is the 57 hand labels behind these numbers — and a criterion vague enough that the labels disagree with
each other is what makes that cost buy nothing.

> [!NOTE]
> As in every lab, the verdicts come from a seeded model of judge behaviour, not a live LLM. The `Llama
> 3.2 3B` name on the Judge menu is the model the run was recorded against, not a measurement of that
> model in the wild. The confusion table, the kappa, the intervals and the cost are all computed for real
> in your browser from the recorded verdicts.

## Try it

**Predict first.** On paper, before you open the page:

1. The judge prompt says "is it good?". Will its pass rate land **above** or **below** the 55.0% the
   humans give on the same 40 items? By roughly how much?
2. Is kappa positive, zero or negative here, and why?
3. Pick one of the 22 items the humans passed. Name one thing the judge could have got wrong about it.

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=binary-first)

1. **Find the eight.** Read the confusion table, then find the eight items the judge passed and the
   human failed: `tp 19, fp 8, fn 3, tn 10` means eight false alarms and three missed faults. For each of
   the eight, write one line: *what did the judge reward that the criterion forbids?* You will find that
   most of your lines are about the clause the judge was never told about. That is the lesson, not a
   coincidence.
2. **Write your own criterion for one item.** Take any answer in the set and write a criterion specific
   enough that a stranger could apply it without asking you a question. Then write a second, different
   criterion and score the same answer under both. If your two criteria disagree, you have just written
   the failure this lesson is about.
3. **Change the Judge dropdown and predict the TNR.** Switch from the plain judge to `Llama 3.2 3B ·
   Rubric · 0 shots` and read its prompt in the box at the bottom of the page. It states three written
   rules. Predict the new TNR before you look at the tile, then look. You should find TPR 95.8% and TNR
   81.3% on these same 40 items, against the plain judge's 86.4% and 55.6%.
4. **Try the question the criterion is really about.** With the rubric judge selected, set *How many
   items* to **All of them** and switch *Answer being judged* to **B — generic prompt**. Read the human
   row of the confusion table: the humans pass 20 of 57 (35.1%). Compare the rubric judge's 33.3% and the
   plain judge's 64.9% on the same items. One judge is roughly right about this system and the other is
   30 points wrong, and only one of them was told what "good" means.

## Break it

The knob is the **judge prompt**, and the page will let you type into it. Type a single character and read
what the page says: *no recorded run for this exact judge*. That message is the most important thing in
this lab. Changing one character of a prompt produces a different judge, whose verdicts on these 40 items
nobody has ever observed — and the tempting thing to do is to leave the tiles showing and ignore the
warning. Those tiles are another prompt's results. Reporting them as this prompt's results is the exact
move that produces a confident, wrong number.

The lie, named: **a check that was never told your criterion will agree with you more than it agrees with
your users.** The plain judge here has a kappa of 0.43 and an accuracy of 72.5%, which in a dashboard
looks like a working eval. It is the same prompt that scored the generic system at 64.9% when humans scored
it at 35.1% — a judge that cannot see a 30-point quality gap cannot gate a 5-point one.

The second, quieter version of the same break: tighten the criterion until nothing can fail it. *"The
answer is on topic and does not insult anyone"* passes everything, including a confident wrong leave
policy. A criterion that cannot fail is not a safe criterion; it is a criterion that has stopped
measuring. Every criterion needs at least one clause that some real answer actually violates, and the
labelled set above has four such clauses on purpose.

## Fix it

Three written rules, one per clause, in the judge prompt — and then read the scoreboard again. The rubric
judge in the lab states:

> Grade the answer against these rules:
> 1. It states the handbook fact correctly.
> 2. It cites the handbook section.
> 3. It adds nothing that is not in the handbook.
> Reply PASS only if all three hold, otherwise FAIL.

Same 57 dev items, same answers, same humans, three numbers that matter:

| | Vague judge | Rubric judge | Humans |
| --- | --- | --- | --- |
| Answer A, tuned | 66.7% | **59.6%** | 52.6% |
| Answer B, generic | 64.9% | **33.3%** | 35.1% |
| Answer C, small model | 47.4% | **14.0%** | 8.8% |
| Kappa on A | 0.43 | **0.79** | — |
| TNR on A | 55.6% | **81.5%** | — |

The repair moved the judge from "close to nobody" to "within about seven points of a person" on the system
it previously rated as good, and from "30 points optimistic" to "under two points optimistic" on the
system it previously waved through. Note the direction: the fixed judge scores the tuned system **lower**
(59.6% against 66.7%). Making a criterion decidable almost always makes the score look worse, because the
old score was partly measuring the judge.

The third rule earns its place too, even though no answer from system A is labelled `extra`: on the generic
system 12 of 94 answers are labelled as adding practice the handbook does not state, and on the small model
15 are. Rule 3 is what catches "in practice many teams round this to a whole month" — a sentence that makes
the answer *more* useful-sounding and is not policy.

## How do I know it works?

**Challenge, two steps, and the second one is one-way.**

*Step 1 — on dev, reach the target.* With the rubric judge selected and 40 dev items: get the **TNR to 0.80
or above** without letting the **TPR fall below 0.90**. The rubric judge gives you 95.8% and 81.3% on the
default draw, so it passes as loaded. If you cannot reach TPR ≥ 0.90 on the same run, you have made the
judce stricter by making it blinder, and the scoreboard is telling you so.

*Step 2 — once, on the held-out set.* Press **Validate on test**. The 37 test items are items you have not
tuned against, and the button reveals the numbers once. Write down all four before you press it.

Here is what the rubric judge reports on the 37 held-out items, scoring the tuned system's answers:

| Number | Dev (57) | Test (37) |
| ------ | -------- | --------- |
| Judge pass rate | 59.6% | **43.2%** (16 of 37) |
| Kappa | 0.79 | **0.73** (0.49–0.94) |
| TPR | 96.7% | **82.4%** |
| TNR | 81.5% | **90.0%** |
| Humans | 52.6% | **45.9%** |

Three things to notice, and they are the reason the split exists. The judge's pass rate lands within
2.7 points of the human rate on data it has never seen. The TPR falls from 96.7% to 82.4% — the judge was
partly tuned to the dev items, and held-out data charges you for it. And a judge scoring 45.9% by hand
agreement is a judge you could put in front of a gate, which is a very different position from the vague
judge's 73.0% on the same 37 items against the same humans' 45.9%.

For contrast, the vague judge on those same 37 held-out items: pass rate **73.0%**, kappa **0.37**, TNR
**45.0%** — 27 points more optimistic than the people, on data it had not seen. Validation did not save the
vague judge. Nothing would have, except writing the criterion down.

## Use / don't use

**Do use** a written criterion before anything else, and expect to rewrite it twice. The first version is
always wrong in a way you only discover by labelling. Budget for it: in this course the criterion for the
support bot is three lines long and it took one afternoon of labelling 20 items to find the clause that
mattered. That afternoon is the cheapest hour in the whole project.

**Don't use** a criterion to settle a product decision it was not written for. "Cites the handbook
section" is right for a policy bot and absurd for a creative-writing feature. The generalisable move is to
write the criterion in terms of what a *user* would complain about, then check that at least one clause
fires on a real failure you have already seen. Module 2 is where you collect those failures; do not skip
it and invent a criterion from imagination, because you will invent one that passes everything.

In production, the cost of a good criterion is human labelling time, and the cost of a bad one is
invisible: it shows up as a team that agrees the bot is improving and a support channel that disagrees.
The practical discipline is to keep the criterion next to the eval set, version it, and re-read it every
time a failure is added. Criteria drift silently — the eval set grows, the feature changes, the written
rule stays where it was, and six months later you are measuring a product that no longer exists. Module 6
is about that failure in detail.

One more production note: a criterion that is decidable by a program should be checked by a program.
"Does the answer name a section that exists in the handbook" is a regex plus a lookup, it costs nothing,
and it never gets tired at 2am. Save the model call for the clauses that need meaning.

## Reflect

1. Write your own two-clause criterion for one feature you have shipped. Name one real failure of yours
   that each clause would catch, and one failure that neither clause would catch.
2. Your criterion says "and cites the source". A third labeler argues this is too strict for a chat
   assistant, because users care about the answer, not the paperwork. What evidence would settle it, and
   would that evidence be the same on 20 items as on 5,000?

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Claude Platform Docs, [Define success criteria and build
  evaluations](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) — specific, measurable,
  achievable and relevant: the four tests this lesson applies to the support bot's criterion.
- Hamel Husain, [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) (2024) — why binary
  labels beat scored ones for a first eval, and why the labeler's written critique is the most valuable
  thing your eval set produces.
- J. R. Landis and B. G. Koch, [The Measurement of Observer Agreement for Categorical
  Data](https://doi.org/10.2307/2529310) (1977) — the kappa bands the labs print next to every score.
