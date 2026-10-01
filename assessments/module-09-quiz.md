# Module 9 quiz — Evaluating agents and conversations

This quiz checks the four things Module 9 exists to install: that an agent reaching the right answer has not
necessarily done the right thing, and that the two are different measurements with different denominators; that a
tool call in the trace is a structured record you can assert on instead of a model call; that a simulated user
puts a second model inside your eval and has to be measured before you read the agent through it; and that a
run-level score becomes actionable the moment you attach a step index to it.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the nine questions. You can retake it; the questions do not change, so a second
attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [09.1 · End state versus trajectory](lessons/module-09/lesson-01.md) — the same 40 runs scored 75.0% by end
  state and 50.0% by trajectory, the ten runs in the gap, the paired comparison that resolves a difference the
  two marginal intervals cannot, and the in-order split that puts every failure in the held-out half.
- [09.2 · Tool-call correctness](lessons/module-09/lesson-02.md) — 91 string comparisons against the tool name on
  the span, why a check that scores 100.0% while flagging none of the 20 failures is not a good check, and the
  ladder that gets from a count comparison to a judge.
- [09.3 · Multi-turn conversations and simulated users](lessons/module-09/lesson-03.md) — why this lesson quotes no
  rate at all, what the shipped 40 runs do and do not contain, and what has to be validated before a model is
  allowed to play the user.
- [09.4 · Finding the failing step](lessons/module-09/lesson-04.md) — the first-bad-step distribution over the 20
  failing runs, the partial-credit metric's missing interval, and twenty hand labels turning a score into three
  tickets.

Two reminders before you start. First, the lab behind these lessons carries an educational-model banner: **the 40
kitchen-assistant runs, their 171 spans, their task strings and their end states are all generated for teaching,
while every count, rate and interval on the page is computed for real in your browser from those recorded runs.** No
number from these lessons should be quoted as a measurement of a named agent system in the wild. Second, four of
the nine questions are about what you would *do* next — which check to write, which fault to fix, what to do about
a simulator, what to change about a split — and that is the skill the module is built on.