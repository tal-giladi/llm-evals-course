# Module 8 quiz — Evaluating RAG answers

This quiz checks the four things Module 8 exists to install: that a retrieval number and an answer number are
two halves of the same system and only one of them is what a user complained about; that grounding judged
claim by claim is a different measurement from grounding judged answer by answer; that abstention and
over-refusal pull in opposite directions and both have to be counted; and that a RAG metric you did not write
has to be validated against your own labels before it gates anything.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the nine questions. You can retake it; the questions do not change, so a second
attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [08.1 · Retrieval failures and answer failures](lessons/module-08/lesson-01.md) — the chain from "a passage
  came back" to "the answer is grounded", the failure taxonomy you build by reading passages, and why a green
  context-recall number is not evidence the feature works.
- [08.2 · Grounding judges, claim by claim](lessons/module-08/lesson-02.md) — atomic claims, the ungrounded-claim
  rate with its denominator, the 33-point TNR gap between two prompts, and why zero claims is a routing signal
  rather than a good grade.
- [08.3 · Abstention and over-refusal](lessons/module-08/lesson-03.md) — two rates with two denominators, a tile
  that measures the label instead of the behaviour, and the case where a passage came back and declining was
  still right.
- [08.4 · Validating RAG metrics against humans](lessons/module-08/lesson-04.md) — the module-6 procedure applied
  to a metric you did not write, a leaderboard the metric gets wrong, and a knob that takes a prefix rather
  than a draw.

Two reminders before you start. First, the lab behind these lessons is unusual: **the questions, the passages
retrieval actually returned, the three answer variants and the human labels are all generated for teaching, and
every judge verdict on the page comes from a seeded educational model of judge behaviour — but every statistic
is computed for real in your browser from those recorded verdicts.** The model names in the grounding-judge
menu are the labels recorded runs are filed under, never published benchmark results for those models, and no
number from these lessons should be quoted as one. Second, most of these questions are about what you would
*do* next: three of the nine ask you to tell a number from the label it was computed over, and that is the
skill the whole module is built on.