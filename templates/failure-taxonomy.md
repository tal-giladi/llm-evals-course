# Failure taxonomy sheet — template

Fill this in **before** writing any metric. If a category here does not map to a check, you have not
finished deciding what to build yet.

## The success criterion

Write the criterion in one sentence, and make it decidable by someone who did not build the feature.

> _The answer states the handbook fact correctly **and** cites the handbook section._

Note the second clause. Most answers fail it. That is why the pass rate is what it is, and it is only
visible because the criterion says so.

## Categories

One row per distinct way the feature can fail. "Wrong answer" is not a category; it is the absence of
one.

| # | Failure mode | How you would recognise it | How often (count / sample) | Severity for the user | Cost to fix | Which check |
|---|---|---|---|---|---|---|
| 1 | Right answer, no citation | Answer is correct but names no section | _78 / 282_ | Medium — unverifiable | Low — prompt change | Code: regex for a citation |
| 2 | Contradicts the handbook | States a rule the handbook does not contain | _60 / 282_ | High — user acts on it wrongly | Medium | Judge + human review |
| 3 | Invents policy where none exists | Answers a salary or share-scheme question as fact | _14 / 282_ | Critical — company policy invented | Medium | Judge, plus a refusal test set |
| 4 | Refuses an answerable question | Says it cannot help on a covered policy | _22 / 282_ | High — user gets nothing | Low — prompt change | Code: regex for a refusal |
| 5 | Adds an unsupported claim | Correct answer plus an extra "in practice" claim | _27 / 282_ | Low | Low | Judge |

Counts are from the shipped course dataset: 94 questions × 3 system variants = 282 answers, of which
81 are correct. Recount them yourself with `node build/count-taxonomy.mjs` — if the numbers have moved
since this was written, the table is stale and the data is right.

## Where the effort goes

Score each category by **frequency × severity**, then sanity-check against **cost to fix**. The biggest
number is not automatically the best target: a category that is frequent, severe and fixed by one line of
prompt beats one that is frequent and needs a model migration.

| Category | Frequency × severity | Fix cost | Do it now? |
|---|---|---|---|
| 2 — contradicts the handbook | _highest_ | medium | yes |
| 1 — no citation | _highest_ | low | yes, cheapest win in the table |
| 3 — over-refusal | low | low | later — one prompt line, low blast radius |
| 4 — invented policy | _lowest frequency, highest severity_ | medium | yes, but keep a dedicated gate on it |
| 5 — extra claim | medium | low | later |

Note what the table does *not* say: the most frequent failure is not the most dangerous one. Invented
policy is 5% of answers and would be the first thing to make a lawyer's day.

## The question each row must answer

> _Which check decides this, and what would make that check wrong?_

If you cannot name what would make the check wrong, you have described a vibe with a table around it.