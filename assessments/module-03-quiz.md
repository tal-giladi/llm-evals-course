# Module 3 quiz — Code-based checks

This quiz checks the four things Module 3 exists to install: that a code check is the first thing to
reach for and the cheapest thing to run, that a check which passes everything is telling you about the
check, that overlap metrics reward wording rather than facts, and that every check needs a stated
reason for existing.

Every question is a situation you will meet in your own work, not a definition. Four options, one
correct. **Pass mark: 70%** — seven of the ten questions. You can retake it; the questions do not
change, so a second attempt is worth taking only after you have re-read the lesson behind the one you
got wrong.

What it covers, in the order the lessons build it:

- [03.1 · Assertions: the cheapest check there is](lessons/module-03/lesson-01.md) — what an assertion
  is, and why a 100% pass rate is the symptom of a broken check rather than a healthy system.
- [03.2 · Regex and JSON schema](lessons/module-03/lesson-02.md) — shape against structure, the
  error message that names `$.ingredients[0]`, and the lenient parser that is making a product
  decision on your behalf.
- [03.3 · Reference metrics and their traps](lessons/module-03/lesson-03.md) — ROUGE-L and token F1,
  the corruption that leaves recall untouched, and why 0.0% can be as uninformative as 100%.
- [03.4 · Choosing code, judge or human](lessons/module-03/lesson-04.md) — the ladder, the decision
  table with a reason in every row, and what a check stretched onto the wrong category looks like.

Two reminders before you start. First, the lab behind these lessons is unusual: **every evaluator on
that page is real code running in your browser**, not a model call, so the numbers are computed for
real from twenty generated recipes with an exactly known target — but they are measurements of this
lab's data and never of a named system in the wild. Second, most of these questions are about what you
would *do* next, not about what a number is, because that is the part that decides whether an eval
survives contact with a real team.