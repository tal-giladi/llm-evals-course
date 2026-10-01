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
| 1 | Right answer, no citation | Answer is correct but names no section | _57 / 282_ | Medium — unverifiable | Low — prompt change | Code: regex for a citation |
| 2 | Contradicts the handbook | States a rule the handbook does not contain | _56 / 282_ | High — user acts on it wrongly | Medium | Judge + human review |
| 3 | Refuses an answerable question | Says it cannot help on a covered policy | _20 / 282_ | High — user gets nothing | Low — prompt change | Code: regex for a refusal |
| 4 | Invents policy where none exists | Answers a salary or share-scheme question as fact | _14 / 282_ | Critical — company policy invented | Medium | Judge, plus a refusal test set |
| 5 | Adds an unsupported claim | Correct answer plus an extra "in practice" claim | _27 / 282_ | Low | Low | Judge |

## Where the effort goes

Score each category by **frequency × severity**, then sanity-check against **cost to fix**. The biggest
number is not automatically the best target: a category that is frequent, severe and fixed by one line of
prompt beats one that is frequent and needs a model migration.

| Category | Frequency × severity | Fix cost | Do it now? |
|---|---|---|---|
| 2 — contradicts the handbook | _high_ | medium | yes |
| 3 — over-refusal | _high_ | low | yes, cheapest win in the table |
| 1 — no citation | medium | low | yes |
| 4 — invented policy | low | medium | yes, but keep a dedicated gate on it |
| 5 — extra claim | low | low | later |

## The question each row must answer

> _Which check decides this, and what would make that check wrong?_

If you cannot name what would make the check wrong, you have described a vibe with a table around it.