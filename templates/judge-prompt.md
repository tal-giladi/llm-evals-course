# Judge prompt template

One judge, one failure mode, one decidable output. Copy this and fill every blank. A blank left as a
blank is a bug: an unfilled slot becomes whatever the judge felt like that day.

---

```text
You are grading one answer against a specific policy section.

<policy_section>
{{retrieved_section}}
</policy_section>

Question the user asked:
{{question}}

Answer to grade:
{{answer}}

Grade the answer against these rules, in order:

1. Does the answer state the fact from the policy section correctly?
   YES / NO
2. Does it cite a section from the policy?
   YES / NO
3. Does it add any claim that is not in the policy section?
   YES / NO

Verdict is PASS only when the answers are YES, YES, NO.
Otherwise the verdict is FAIL.

Reply with the three answers on one line each, then on a new line:
VERDICT: PASS
or
VERDICT: FAIL
```

---

## Why each part is there

| Part | Reason it fails without it |
|---|---|
| `{{retrieved_section}}` in the prompt | The judge cannot check grounding against a rule it cannot see. This is the single most common cause of a generous judge. |
| Numbered rules | A vague "is it good?" prompt passes most failures. Measured on the course dataset: TPR 89.4%, TNR 51.1%, kappa 0.40. With the rules: TPR 91.5%, TNR 85.1%, kappa 0.77. |
| YES/NO per rule | Forces the judge to commit to each criterion separately, so a disagreement is visible in the critique rather than hidden in a verdict. |
| Exact output format | Anything else needs a parser, and a parser that guesses is a correctness problem, not a convenience. |
| PASS only when ... | Makes the verdict a function of the rules instead of a summary judgement. This is what keeps the judge stable across temperature. |

## Before you ship it

Check each box and record the number, not a yes or no:

- [ ] **TPR** on the dev set: _0.92_. Below 0.85 and the judge is dropping good answers you will hear about.
- [ ] **TNR** on the dev set: _0.86_. Below 0.70 and the judge cannot be a release gate.
- [ ] **Kappa** on the dev set: _0.78_. Below 0.40 and it is barely better than guessing.
- [ ] **Swap consistency** on pairwise items: _0.94_. Below 0.85 and it has position bias.
- [ ] **Verbosity probe**: hold the content fixed, add two sentences of filler, and check the verdict does not move. If it moves, you are grading length.
- [ ] **Self-preference probe**: compare pass rate on answers from the judge's own model family against another. A gap is a reason to change judge.
- [ ] **Test agreement**, run once, recorded. _0.79_ on the held-out set.
- [ ] **Cost and latency** per call: _$0.0004, 540 ms_.

## Two things to write down

**The key.** A recorded verdict is only reusable when the dataset item, the system output, the judge
model build, this entire prompt text, the rubric, the few-shot ids and order, the answer order, the
decoding settings and the sample index all match. Hash the prompt. If a cached result is ever served
for a different prompt, every number downstream is fiction.

**The disagreement list.** Export the items where judge and humans differ and keep them next to the
prompt. When agreement drops after a model update, that list is the fastest way to find out why.