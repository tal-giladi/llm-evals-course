---
id: "10.4"
module: 10
minutes: 17
practice_minutes: 45
prerequisites: ["10.3", "04.3", "10.1"]
objectives:
  - Show with one comparison how an overall pass rate can stay flat while a safety slice changes completely, using the same 94 items.
  - Size a slice metric for a gate from its count and its interval, and set a looser threshold on the slice rather than deleting it.
  - Detect a slice that reports zero because nothing was labelled, and say what to publish in place of the zero.
volatility: concept
sources:
  - title: "Holmes & Williams, When Not to Trust the Machine (2006)"
    url: https://www.hcsp.org/hcsp/index.php/jml/article/view/24/21
  - title: "Stratification in observational studies (Thompson, 2002)"
    url: https://www.ncbi.nlm.nih.gov/books/NBK343649/
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 10.4 · Slices as their own gates

An overall pass rate is a total, and a total cannot tell a fix from a regression of the same size. This
lesson builds a second gate on one safety slice, shows what it costs to measure the same thing twice, and
closes the fundamentals path with the gate you would actually ship.

## Why it matters

Two teams ship the same week.

Team A adds a safety filter. The overall pass rate on the eval moves from 50.0% to 49.2% — a rounding
artefact, inside the interval, nobody says anything. Their bot now answers eight questions it used to
refuse, and four of those answers invent a policy that does not exist.

Team B removes a line from the prompt that told the model to decline when the handbook does not cover the
question. The overall pass rate goes from 50.0% to 50.3%, because the model started answering fourteen
questions the handbook answers, correctly. Nobody says anything, and eleven users who needed the policy get
a confident non-answer instead.

Both teams have a green dashboard. One shipped an invented policy and one shipped a bot that will not tell
you how many days of leave you get. **Both failures are invisible in the overall number, in opposite
directions, and neither is visible in the other team's direction either.**

An overall pass rate improves whenever a system becomes more accurate *or* more cautious, or some mixture of
the two. It is a sum over a population and the population can move either way. That is the whole argument
for a second gate on a slice, and it is why the slice gets a threshold of its own rather than a line in the
release notes.

## How it works

### The slice on this corpus

The lab's safety panel gives two counts and one rate per variant, over **all 94 items**:

| System | Over-refusals | Wrong or invented policy | Share of items (wrong ÷ n) | Human pass rate |
|---|---|---|---|---|
| A — handbook-tuned prompt | **6** | **14** | 15% | 47/94 = **50.0%** |
| B — generic prompt | **6** | **24** | 26% | 26/94 = **27.7%** |
| C — small model, no retrieval | **10** | **36** | 38% | 8/94 = **8.5%** |
| D — A, padded | **0** | **0** | **0%** | **no human labels — 0 of 94** |

Three things in that table are lessons.

**The refusal count is not a rate.** It is a raw integer with no denominator beside it, sitting next to a
percentage. A and B both refuse six items, so the column reads `6, 6, 10` and the eye slides past it. As
rates on 94 items those are **6.4%, 6.4% and 10.6%**, and C's is 66% higher than A's — a difference the
column formatting hides completely. Any slice that gates anything needs a denominator printed next to its
count, which is [4.3](../module-04/lesson-03.md)'s rule about naming the population, not a new one.

**The counts are equal and the behaviour is not.** A refuses `s17, s18, s23, s50, s54, s55`. B refuses
`s02, s16, s37, s43, s73, s76`. The two sets **do not overlap at all**. Six and six, same denominator, and
not one item in common. A gate written as `over-refusals ≤ 6` passes both systems and says nothing whatever
about either of them. Two candidates can agree on every number you can publish about a slice and behave
completely differently on it, which is the strongest argument in this course for publishing *which items*,
not just *how many*.

**The fourth row is the dangerous one.** D is A with a paragraph of filler on every answer, and its row is
`0, 0, 0%` — the best row on the page, beating a system that passes half the items humanly. D has **no human
labels at all**: not one of the 94 items carries a label for D, which is why every count on its row is zero.
A slice metric with nothing behind it reports zero, and zero is indistinguishable from safety on a
dashboard. In this module's terms it is the [10.3](lesson-03.md) failure at a different altitude: a
measurement that cannot fail is not a measurement.

### Why one number cannot carry this

An overall pass rate is $\sum$ over items of a 0/1 verdict. Over-refusal contributes a 0 to that sum, exactly
as an invented policy does, exactly as a vague-but-correct answer with no citation does. The three are
indistinguishable in the total and not at all in the product:

| Fault | User's experience | In the overall rate | In the slice |
|---|---|---|---|
| Invented policy | confidently wrong, acted on | −1 | wrong/invented |
| Over-refusal | knows to ask a human | −1 | over-refusal |
| No citation | right, unverifiable | −1 | neither |

So the overall rate can only ever tell you *how many* items are wrong. Deciding **which** faults are
acceptable is a product decision, and it cannot be encoded in a single total — because the same total is
produced by "six more answers, all correct" and "six more answers, all invented".

### The interval is why you cannot just tighten the slice

The slice is small. Six refusals on 94 items is a rate of **6.4% with a Wilson 95% interval of 3.0% to
13.2%** — a range a factor of four wide. C's ten is **10.6%, 5.9% to 18.5%**. Those two intervals overlap
almost entirely, and the honest paired comparison on the same 94 items says the same thing: C refuses on 9
items A does not, A refuses on 5 items C does not, and the exact two-sided sign test on that 9-against-5
split gives **p = 0.424**. Ten refusals against six is **not** evidence that C refuses more.

This is the [4.3](../module-04/lesson-03.md) lesson arriving as an operational constraint, and its
conclusion is not "the slice is too noisy to gate":

- **A slice gate is looser than the overall gate, on purpose.** An overall rate moves when anything moves;
  a slice rate moves only when that slice moves. If you set the slice threshold to the same absolute
  tolerance as the overall one, a one-item change in six flips the gate, which is the false alarms you
  already paid to remove.
- **A slice gate is a floor on count, not a movement detector.** `Over-refusals must not exceed 12 of 94`
  catches C's 10 and 14 against A's baseline when the label set grows, and it does not pretend to
  distinguish 10 from 6.
- **The slice has to be sized like [4.3](../module-04/lesson-03.md) says.** If over-refusal is 6% of
  production traffic and you want a gate that can see it double, you need enough items in the slice that the
  doubled rate is outside the interval — not enough items that the original rate is.
- **Never drop the slice because it is noisy.** A noisy gate that fires on real regressions is worth more
  than an absent gate that never does, and the width belongs in the ADR rather than in the decision to
  delete the gate.

### What the flip list cannot show you

[10.1](lesson-01.md) established that the A/B panel's flip list is the result. Here is what it is blind to.
Of A's six over-refusals, exactly **one — s17 — appears on the v1-versus-v2 flip list**, because it is the
only one where the judge's verdict differs between the two systems. The other five fail under both systems,
so no verdict moved and nothing is listed. Three of B's six refusals (`s02`, `s16`, `s76`) *do* appear,
because A answered them and B declined.

So: a flip list built on pass/fail will under-report refusal regressions roughly in proportion to how bad
the baseline already was. Five of six on the preset. **A slice you care about needs a count over the whole
item set, not a delta between two runs.**

And the judge can supply it — this is not a measurement you need a new rubric for. Across the recorded runs
at 3 repeats, `c-rubric-3b` passes **0 of A's 6 over-refusals, 0 of B's 6, and 1 of C's 10**. It is already
treating a refusal as a failure. The number was simply never being collected.

## Show me

This lesson's preset opens the lab on the **A safety slice as a second gate** panel, with all 94 items and
the `c-rubric-3b` judge. The panel's own caption sets up the whole lesson:

> An overall pass rate improves if a system becomes both more accurate and more cautious. Refusing a
> question the handbook answers is a regression, and a single overall number hides it. Give the slice its
> own gate.

and under the table:

> Slice metrics are usually small, so their intervals are wide. That is an argument for a looser
> threshold on the slice, not for dropping it.

Do this, in order:

1. **Read the last column and find the denominator.** It is `Wrong or invented policy ÷ 94` — 15%, 26%, 38%,
   0%. The refusal count has no denominator at all. Compute the three refusal rates yourself: **6.4%,
   6.4%, 10.6%**, and write them beside the raw counts so the column stops lying to you.
2. **Open the D row and ask where the labels are.** `0, 0, 0%` is the best row on the page. D has **no human
   labels on any of the 94 items** — every one of its human entries is absent, so every count on its row is
   zero by construction. Fall back to a plain pass rate and D reads 0 of 94, while the judge passes 48 of
   94. The row that looks
   safest is the row with nothing behind it.
3. **Set A and B to the two six-refusal systems and compare the item ids.** A refuses `s17, s18, s23,
   s50, s54, s55`; B refuses `s02, s16, s37, s43, s73, s76`. Intersection: empty. A gate on the count
   passes both. Now write down what a gate has to be written on instead.
4. **Count the refusals the flip list shows you.** Go back to the A/B panel on the same configuration and
   read `What flipped — 10 fixed, 35 broke`. Search both halves for `s17, s18, s23, s50, s54, s55`: one
   match. Five of six refusal regressions are invisible on a panel whose entire purpose is to show you what
   changed.
5. **Price the slice gate on this data.** `Over-refusals ≤ 12 of 94` fails nothing today. `≤ 8` fails
   nothing today either, because A and B are at 6 and C is at 10 — which would fail C. Then write down the
   Wilson interval on each count: **3.0–13.2%**, **3.0–13.2%**, **5.9–18.5%**. Your threshold has to sit
   where those intervals are separated, and today they are not.

> [!NOTE]
> The 94 support questions, the four answer variants and the human labels behind these counts are
> generated for teaching; every verdict comes from a seeded educational model of judge behaviour, computed
> for real in your browser. Nothing here measures a named support bot in the wild. The one thing worth
> carrying out of the panel is the method, which is the method Module 4 taught: a slice is a population,
> and a population needs its own denominator, its own interval and its own threshold.

## Try it

**Predict first**, on paper:

1. A system goes from 50.0% to 50.3% overall while its over-refusals go from 6 to 11. Write the sentence
   that tells a stakeholder what happened, and say what number you would have needed to catch it.
2. Two systems both refuse 6 of 94 items and refuse completely different ones. Write a gate threshold that
   passes both, and say what you would have to add for the threshold to mean anything.
3. A slice shows 0 events. Write the three different situations that produce that number, and say which one
   looks safest on a dashboard.

[Simulation: ab-gates](../../simulations/ab-gates/index.html?preset=safety)

1. **Turn every count on the panel into a rate with its interval.** Three systems, two counts each, six
   rates, six Wilson intervals. Write them in a table and then look at how many of the six intervals overlap
   with another system's. That count is the number of comparisons the panel cannot make for you.
2. **Run the paired comparison on the slice by hand.** A refuses 6, B refuses 6, C refuses 10, and the sets
   are disjoint for A and B. Count, for C against A, the items C refuses and A does not (9) and the items A
   refuses and C does not (5). Compute the exact two-sided sign test on that 9-against-5 split. You should
   land at 0.424 — write down what that licenses you to say about C's ten.
3. **Build the gate you would actually ship.** Write two thresholds: one on the overall pass rate with its
   tolerance and its accepted false-alarm rate, one on the over-refusal count. Put the measurement's
   half-width beside each. Then write the one sentence that says which errors the team has chosen to make.
4. **Find the item that is both.** Read the six refusal items on A and the six on B and find `s17`, which
   both A and C refuse and which B answers correctly. Then read what A's output actually is: *Procurement is
   not covered in the handbook* on a question about buying a SaaS tool. Decide whether that is a correct
   refusal and what your gate should say about it.
5. **Decide what to do about D.** D's row is `0, 0, 0%` and there are no labels behind it. Write the line
   you would put in the dashboard instead of the row — something that distinguishes *no refusals observed*
   from *no refusals labelled* — and say who has to produce the labels before the row can be published.

## Break it

**Gate on the overall pass rate and call it done.** 50.0% to 49.2% is inside the interval, so a release
shipped an invented policy; 50.0% to 50.3% is inside the interval, so a release shipped a bot that will not
tell anyone how many days of leave they get. The lie: **an overall rate is a sum over a population, and the
population can move in opposite directions without the sum noticing.**

**Print the refusal count without its denominator.** The column reads `6, 6, 10`. As rates those are 6.4%,
6.4% and 10.6%, and the third is 66% higher than the first. The lie: **a count beside a percentage is a
number wearing a percentage's credibility.**

**Gate on `over-refusals ≤ 6`.** A and B both pass it and share no refusal item at all. The lie: **a
threshold on a count is a threshold on a coincidence, and agreement on a count is not agreement on
behaviour.**

**Publish a slice that was never measured.** D's row is `0, 0, 0%` because no item carries a D label. The
lie: **zero events is the output of a measurement that found nothing and of a measurement that looked
nowhere, and a dashboard cannot tell them apart.**

**Delete the slice because its interval is wide.** Six refusals on 94 items has a Wilson interval of 3.0% to
13.2%. That is an argument for a looser threshold, a count-based floor and a bigger slice — all of which
are cheap — and not an argument for the only outcome that is free. The lie: **the slice is noisy precisely
because the failure you are gating for is rare, and rarity is not a reason to stop watching.**

**Set the slice threshold as tight as the overall one.** A one-item change in six flips a 94-item count by
seventeen percent. The lie: **a slice moves only when that slice moves, so it does not need the same
absolute tolerance as the total — it needs a looser one and a larger count.**

## Fix it

1. **Publish every slice as a rate with its denominator and its interval.** `Over-refusals 6/94 = 6.4%
   (3.0–13.2%), judge c-rubric-3b, 3 repeats.` No bare counts on a dashboard, ever, including in the table
   that already has a percentage column next to them.
2. **Gate the slice on a floor, not on a movement.** `Over-refusals must not exceed 12 of 94` is a
   specification that is checkable, cheap and honest about what it can see. It fails C's 10 the moment the
   item set grows, and it never claims to distinguish 10 from 6.
3. **Print the item ids beside the count.** Six and six, disjoint — that is one line of text and it is the
   difference between a gate and a coincidence. The flip list taught you this in [10.1](lesson-01.md); the
   slice needs the same discipline.
4. **Make "no labels" visible.** When a variant has no human labels, render the row as *not measured* with
   the item count, never as `0`. A row that cannot be wrong is a row that will eventually be trusted.
5. **Put both gates in one ADR with both error rates.** `Overall: tolerance 5 pts against a ±13.3 half-width,
   ~1 false alarm in 3 runs, accepted. Slice: over-refusals ≤ 12 of 94, interval too wide to see 6 against
   10, so it is a floor and not a detector, accepted.` One paragraph, both failure modes, no surprises.

## How do I know it works?

**Challenge, on dev.** The dataset's dev split is **57 items**. Size both gates on that half and require all
four:

- **The slice rate is computed with a denominator and its interval on the dev half.** Over-refusals on the
  57 dev items are **A 3/57 = 5.3% (1.8–14.4%)**, **B 5/57 = 8.8% (3.8–18.9%)**, **C 6/57 = 10.5%
  (4.9–21.1%)**. Three overlapping intervals across a two-fold range in counts is the reason the gate is a
  floor and not a detector, and writing that down is the deliverable.
- **The slice threshold is a count on a named denominator.** `Over-refusals ≤ 8 of 57 on dev`, not
  `over-refusals ≤ 6`. A threshold without its denominator is a different threshold every time the item set
  changes.
- **Every variant row states its label coverage.** `A: 57/57 items labelled. D: 0/57 items labelled — row
  not published.` The D row must not appear at all until somebody labels it.
- **The judge is checked against the slice before the slice gates anything.** Over the recorded runs at 3
  repeats the judge passes **0 of A's 6 refusals, 0 of B's 6 and 1 of C's 10**. A slice gate is only as
  trustworthy as the metric reading it, and that has to be measured rather than assumed.

**Then one held-out validation**, on `test_ids` — the remaining **37 items** — read once:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Over-refusals, A | 3 — 5.3% (1.8–14.4%) | 3 — 8.1% (2.8–21.3%) |
| Over-refusals, B | 5 — 8.8% (3.8–18.9%) | **1 — 2.7% (0.5–13.8%)** |
| Over-refusals, C | 6 — 10.5% (4.9–21.1%) | 4 — 10.8% (4.3–24.7%) |
| A ∩ B refusal items | **0** | **0** |
| Paired refusal split, C vs A | 5 vs 5 → **p 0.453** | 4 vs 3 → **p 1.000** |
| Overall human pass, A vs B | 52.6% vs 35.1% (gap 17.5) | 45.9% vs 16.2% (gap **29.7**) |

Two findings, and the second is the lesson. The **overall** comparison holds its direction across the split
and widens — B is 17.5 points behind A on dev and 29.7 behind on the held-out half. The **slice**
comparison flips: on dev B refuses *more* than A (5 against 3), on the held-out half it refuses *fewer*
(1 against 3), and the held-out refusal set is a single item, `s43`. Every one of those intervals is wider
than the gap it is trying to measure, and the exact two-sided sign test on C's nine-against-five split over
all 94 items is **0.424**, on the held-out half **1.000**.

Write down what that licenses: **a slice gate validated on a small half is a floor you can defend, not a
detector you can rely on** — and the runbook has to say which of the two it is. This is the
[4.3](../module-04/lesson-03.md) rule one level up: the slice is the population, the slice has its own
denominator, and the threshold you set is a consequence of how many items that population has.

## Use / don't use

**Do gate a safety slice separately from the overall rate.** One overall gate is a statement about how many
items are wrong. A product decision about which faults are acceptable needs a statement about which ones,
and those are different numbers with different owners.

**Do set the slice threshold looser and on a count.** A slice does not move when the total moves, and a
threshold tuned to fire on single-item changes in a six-item count is a false-alarm generator.

**Do publish the ids.** Six refusals that are six different items is a different product from six refusals
that are always the same six, and only the list tells you which one you have.

**Do treat "no events" as a statement about the measurement first.** `0 observed` and `0 labelled` are
different facts about your eval and only one of them is about the system.

**Don't add a gate for every slice you can compute.** A gate you have to defend is worth having; a gate
nobody acts on teaches the team that gates are decorative. Two well-sized gates beat nine noisy ones, and
the count of gates is a maintenance cost like any other.

**Don't replace the overall rate with the slice.** The slice is what the overall number hides. Removing the
overall number to fix that is the same error in the opposite direction, and the release decision usually
needs both.

> [!IMPORTANT]
> This is where the fundamentals path ends. You started in [2.1](../module-02/lesson-01.md) by reading one
> trace, and the work since has been about turning traces into numbers that survive a challenge: labels
> you can defend ([6.1](../module-06/lesson-01.md)), judges whose bias you can measure
> ([6.5](../module-06/lesson-05.md)), intervals on every rate ([4.4](../module-04/lesson-04.md)), slices
> with their own denominators ([4.3](../module-04/lesson-03.md)). What you can now do is decide whether a
> change is safe to ship — and the thing that makes that decision hold up is not the threshold. It is
> having **two named failure rates** instead of one number. The production path builds directly on this:
> the same two gates, run on traffic instead of on a frozen set, with the interval on every one of them.

What teams actually do in production: publish the overall rate with its interval, publish the two or three
slices that have an owner and a response, and require both to clear before a release. When one fires, the
flip list tells you what moved and the slice tells you what kind of thing moved — and the two together are
usually enough to identify the commit.

## Reflect

1. The panel's last column reads `15%, 26%, 38%, 0%`. Write the sentence you would put under the table so
   that nobody in the room reads the `0%` as a result.
2. A and B both refuse 6 of 94 and share no item. Write the two-sentence version of the gate you would
   write on this slice, and say what you would need to collect to make it detect rather than merely floor.
3. Six refusals on 94 items has a Wilson interval of 3.0% to 13.2%. Write the paragraph you would put in
   the ADR that explains why you are keeping a gate this noisy, and what it is allowed to be used for.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Christine Holmes and Douglas Williams, [When Not to Trust the
  Machine](https://www.hcsp.org/hcsp/index.php/jml/article/view/24/21) (2006) — the pairing of a classifier
  with a stratified report so the sub-population failures stay visible after the overall score looks fine.
- Sander Greenland and James Robins, [Estimation of a Common Effect
  Parameter from Sparse Follow-Up Data](https://www.ncbi.nlm.nih.gov/books/NBK343649/) (2002) — the
  stratified-estimation machinery behind treating a slice as its own population with its own interval rather
  than as a line item under a total.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the fourth fix:
  when a number is zero, the first question is whether anything was measured, not whether anything was
  found.