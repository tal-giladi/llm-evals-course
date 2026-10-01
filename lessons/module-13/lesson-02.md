---
id: "13.2"
module: 13
minutes: 20
practice_minutes: 50
prerequisites: ["13.1", "05.3"]
objectives:
  - Write down the nine fields in the judge cache key and say, for each one, how a verdict could change while the key stays the same.
  - Test a cache key by changing one field at a time and asserting the key moves, and say why that test is the only thing standing between you and a wrong number.
  - Read a cache's hit and miss counts and say what an implausibly high hit rate is evidence of.
  - Explain why a cache is cheaper to make honest than a threshold is to tune, and where that difference shows up on a bill.
volatility: implementation
sources:
  - title: "GitHub Actions — Dependency caching"
    url: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
  - title: "Prompt caching — Anthropic Claude Platform Docs"
    url: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 13.2 · Caching judge calls

A regression gate runs the judge over the same frozen item set on every pull request, three times each, and
pays for every one of those verdicts. Lesson [05.3](../module-05/lesson-03.md) already wrote down exactly
which inputs a verdict depends on; this lesson joins that list with a `|` and hashes it, and then argues
that this is the cheapest and most dangerous line of code in the suite. It is cheap because it is the
difference between a suite a team keeps and a suite a team disables, and it is dangerous because a cache
keyed on anything weaker serves verdicts from a prompt nobody ran — reproducibly, so nobody notices for
months.

## Why it matters

Here is the run this module just built, priced. A gate on the 57 dev items at three repeats asks the judge
the same 171 questions, every time, on every pull request:

```
calls=171
```

That number is not decoration. `run_gate` computes it as `calls = n * repeats` and carries it on every
`GateResult`, and `Budget.check(calls, usd)` exists so a run can be refused for exceeding it. At the
`cost_per_call=0.0004` the shipped test uses — an illustrative figure for a small open model, chosen so the
arithmetic is real — one run is **$0.0684**, and a team shipping five pull requests a day for a quarter is
paying for:

| | Calls | Illustrative cost |
|---|---|---|
| One run, 57 items × 3 repeats | 171 | $0.0684 |
| 200 pull requests | 34,200 | $13.68 |
| The same 200, at one repeat | 11,400 | $4.56 |

Read the middle row and then read it against the row above it. **If every one of those 200 pull requests
were re-run once — which is what happens the first time anything goes red — half of all the calls would be
buying an answer the suite already had.** A branch that was force-pushed because of a formatting change, a
merge commit from the default branch that touched no eval code, the second run after somebody moved the
interpreter: each of those is 171 paid verdicts reproducing a number that was on the runner ten minutes ago.

On a busy team most of the remaining 34,200 are duplicates too. The point is not to be exact about the
fraction — the fraction is a property of your development pattern and you should measure it, which is what
the hit rate at the end of this lesson is for. The point is that **none of these calls needed to be made,
and the reason they had to be is that nothing remembered what the last run learned.**

Then the number stops being money and starts being a decision. A support bot that this suite protects is
not obviously worth thirteen dollars a quarter of judgement, and a team that has done this arithmetic once
will do it again in a budget meeting and will be told the eval suite is an unreasonable line item. The
interesting failure is not the expensive one.

**The other failure is cheaper and much worse.** A team adds a cache to fix the bill, keys it on the two
fields that were easiest to reach — the item id and the judge id — and ships it. The suite now runs in a
fraction of the time and every number on the report looks exactly as plausible as it did before. The gate
blocks what it always blocked. Nobody has a reason to look at it.

Then somebody edits the judge prompt. **The cache keeps serving the old verdicts**, because the prompt is
not in the key, so the PR that changed the rubric is measured against the rubric it replaced. The gate
reports a pass rate, the pull request merges, and three weeks later a support ticket arrives about an answer
the team has been asserting is fine for a month.

Here is what makes that failure so hard to catch and why it is worth a whole lesson rather than a warning
box. **A cache keyed too loosely is perfectly reproducible.** Run it twice, get the same wrong number twice,
and the CI log shows a green check with a stable value. The entire evidence a team has — the run is
repeatable, the test suite is green, the trend is smooth — is consistent with a healthy suite and with a
suite that has not measured anything since March. The bug does not announce itself. It gets *more*
credible over time, because every run that agrees with the last one is a run nobody looks at.

## How it works

### The key, as a function you can call

[`evallab/judge.py`](../../labs/common/evallab/judge.py)'s `cache_key` is lesson [05.3](../module-05/lesson-03.md)'s
list turned into code. Nine fields, joined with `|`, hashed, printed as eight hex characters:

```python
def cache_key(item, variant, judge_id, sample_index=0,
              model_build="", prompt_hash="",
              decoding="", fewshot="", answer_order="") -> str:
    parts = [item.id, variant, judge_id, model_build, prompt_hash, decoding,
             fewshot, answer_order, str(sample_index)]
    return f"{hash_seed('|'.join(parts)):08x}"
```

`hash_seed` is the same FNV-1a the browser path uses, so the Python and JavaScript halves of the course
agree on a key. Read the nine fields as nine ways for the verdict to change while the key stays the same:

| Field | What it pins | How a verdict changes while the key does not |
|---|---|---|
| `item.id` | which question | positional ids like `item-0` name a different question the moment the list is re-ordered — which is exactly how lesson 13.1's quarantine list once reported itself empty |
| `variant` | which system output is being graded | `v1` and `v1padded` carry the same answer and different verdicts; a cache keyed without this grades both as one |
| `judge_id` | which rubric | `c-rubric-3b` and `c-rubric-7b` disagree on **12 of the 57 dev items** (21%) |
| `model_build` | the actual weights | `llama-3.2-3b` is a name, not a digest; a quantisation change moves every verdict |
| `prompt_hash` | the full prompt text | **one character is enough** — `a1b2c3d4` → `a1b2c3d5` |
| `decoding` | temperature, seed, top-p | `greedy` → `temperature=0.7` makes the judge a different judge |
| `fewshot` | which examples, in what order | adding one example changes every verdict, and so does swapping two |
| `answer_order` | A/B position | position bias means the same answer flips when the options swap |
| `sample_index` | which repeat | **three repeats must be three different samples** — see the next section |

Every one of these moved the key when I changed it alone, and the lesson is not the table, it is the
discipline behind it: **change one field, assert the key moved, or you have not tested the field.** A key
you asserted against for one field is a key you have evidence about; a key you read and agreed with is a key
you have an opinion about.

### The field people drop: `sample_index`

`sample_index` is the one that does not look like a correctness field, and dropping it makes the suite
*look better* while making it wrong. Say why slowly.

Your gate runs the judge **three times** per item and takes the majority. That is the noise-reduction
buys that lesson [10.3](../module-10/lesson-03.md) priced: the same question, asked three times, to a judge
that is not deterministic. It works because the three answers differ — that spread *is* the measurement.

Now delete `sample_index` from the key. All three repeats of item `s01` now hash to the same key, so all
three lookups return **the same cached verdict**. The majority of three identical values is that value. The
recorded samples for `s01` on `v1` are `[1, 0, 0, 0, 0]` and for `s03` they are `[1, 0, 1, 1, 1]`; with
`sample_index` gone, `s03`'s three repeats all read `1`, and the `[1, 0, 1]` that carries the disagreement
is replaced by a value the cache invented by repetition. On this dev split **28 of the 57 items** have
recorded samples that are not all identical, so this is not a corner case; it is half the set.

Run-to-run noise goes to **exactly zero**, and that is the disaster. In lesson 13.1's own measurement, the
pass rate of one unchanged build moved by up to **3.51 points** depending on which repeat window you read.
With this key it cannot move at all. And a gate that cannot move:

- never fires a false alarm, so its false-alarm rate is a perfect zero;
- cannot see any regression smaller than the tolerance, so its miss rate silently goes to one;
- and **reports both of those improvements as a win**, because every dashboard you would build to watch the
  gate gets flatter.

The lesson is not "never drop `sample_index`". It is: **a knob that makes your measurement quieter is
suspect until you have shown it made the measurement no smaller.** The tell is the hit rate, which is the
next section.

### Count the misses, because that is the only alarm

A cache that is too loose has no symptom except a hit rate nobody would believe. `JudgeCache` in
[`labs/module-11/`](../../labs/module-11/) counts them, and one of its tests is named for what it catches —
`test_misses_are_counted_so_a_too_loose_key_is_visible`:

```python
cache.put(item, "v1", "c-rubric-3b", 1, **BASE_PARTS)
for i in range(3):
    cache.get(item, "v1", "c-rubric-3b", **{**BASE_PARTS, "sample_index": i + 1})
assert cache.misses == 3
assert cache.hit_rate == 0.0
```

Three lookups of a *different* sample index, three misses, hit rate zero. That is the assertion you want
running in CI, because a key that ignores a field has exactly one observable signature and this is it.
`hit_rate` is worth putting in the gate's own report: on a healthy suite the **per-run** hit rate falls to
zero the moment a field in the key changes and recovers to one on the run after, and a rate that never
falls is the shape of a key with fields missing.

### Two caches, and the one people conflate

There are two caches in an eval CI job and they answer completely different questions. Writing about them
as if they were one is how a suite ends up caching for two different things under one name.

| | **Dependency cache** | **Judge-verdict cache** |
|---|---|---|
| Caches | the Python environment, wheels, model weights | pass/fail verdicts, keyed on the nine fields |
| Key | a lockfile hash, usually scoped to a branch | the full `cache_key`, so it is valid across branches |
| Safety of a loose key | you download the wrong version of a library and a test fails loudly | you serve a verdict from a prompt you never ran, and nothing fails |
| Who cares | whoever waits for `pip install` | whoever trusts the number |

The judge cache has to be **content-addressed**, and that is the whole design constraint. It is not keyed
on the commit, the branch, or the pull request number, because those change on every push while the verdicts
do not — a key like that never hits, so you pay full price and conclude that caching does not work. And it
must not be keyed on the commit either in the other direction: a commit-keyed cache that *is* reused across
branches will happily serve `main`'s verdicts to a branch that changed the prompt, which is the same bug
with a different name.

Two properties of GitHub's own cache are worth knowing because they shape the job definition rather than the
key: caches are **immutable** (saving under an existing key is a no-op, so a cache you want to replace has
to change its key), and they are **scoped by branch** — a branch reads its own cache and its ancestors', and
the default branch's cache is readable everywhere. A judge cache is therefore most useful when it is keyed
so that every branch can read the same entry, which is exactly what a content address does.

### What the cache buys, measured

Four runs through the real `JudgeCache` on the real dataset: a cold run, a re-run of the same commit, a
prompt edit, and a revert of that edit. 171 lookups per run, every run.

```
one full run = 171 judge calls, at an illustrative $0.0004 each = $0.0684

cold run          0 hits /  171 misses   hit rate so far    0%
re-run          171 hits /    0 misses   hit rate so far   50%
prompt edit       0 hits /  171 misses   hit rate so far   33%
prompt reverted  171 hits /    0 misses   hit rate so far   50%

keys stored: 342
calls made: 342;  without a cache: 684
saved: 342 calls ($0.1368)
```

Three things in that output are the lesson.

**A re-run is free.** 171 hits, zero misses. That is not an optimisation somebody had to work for; it is
what a correct key means. The build that failed for a reason you did not find, and the branch you pushed
twice — they cost nothing to re-measure.

**A prompt edit costs exactly one full run, and a revert costs none.** The edit misses all 171. The revert
hits all 171. **A correct cache makes an experiment's cost reversible**, which matters far more than the
money: it means the team can afford to ask "what does this prompt change do to the pass rate?" on a
throwaway branch and throw the branch away afterwards.

**Half the calls were saved on four runs, and the saving is not uniform.** A suite gated on a branch that
changes the prompt every day will never hit. A suite gated on a branch that changes the prompt twice a
quarter will hit almost entirely. **The hit rate is a property of your development pattern, not of your
cache**, and it is worth putting on a dashboard for that reason alone.

One more thing the key cannot fix, and it is arithmetic. `hash_seed` returns a 32-bit value and `cache_key`
prints eight hex characters, so the key space is `2^32`. With the **3,420** distinct key inputs this
dataset's item × variant × judge × repeat grid produces, the birthday bound on a collision is
`3420² / 2·2³²` ≈ **1 in 734**. I sampled those 3,420 inputs and got 3,420 distinct keys and zero
collisions — but a collision in a content-addressed cache is a wrong verdict served with total confidence
and no symptom, so the key has to be long enough that the bound is negligible at your cache size. The same
32-bit key reaches a one-in-two collision chance at **65,536** cached verdicts, which at this suite's
171 verdicts per run is fewer than 400 gate runs. A suite on every pull request crosses that inside a
quarter, and the argument for a wider key has to be made before it does.

### The gate already knows what it costs

Nothing in this lesson needs a new mechanism, which is the nicest thing about it. `run_gate` returns
`calls` and `usd` on every result:

```python
calls = n * repeats
usd = calls * cost_per_call
```

and `Budget(max_calls, max_usd).check(calls, usd)` returns `over_calls`, `over_usd` and `ok`, so a run can
be refused before it is paid for. The cache and the budget are the same conversation from two ends: **a
budget you cannot meet is met by grading fewer items**, which buys the money back by buying exactly the
thing you built the gate to protect. A cache is what lets you keep the item count and meet the budget. That
is why 13.4's budget lesson is not an optimisation exercise — the ceiling is what tells you the cache was
necessary.

## Show me

The key, on item `s01`, with every field changed one at a time. Nothing here is theoretical; these are the
keys this code produced.

```
item            = s01
base key        = b409fc45
same inputs     = b409fc45   (equal: True)

 field changed                 to        key  moved
          item                s02   ca94365a  True
       variant                 v2   2334f058  True
       judge_id  c-rubric-7b   2b72a2d1  True
   model_build  qwen3-1.7b-q8_0   03cb4278  True
   prompt_hash           a1b2c3d5   a6942fcc  True
      decoding  temperature=0.7   35bfe2b9  True
         fewshot          s01,s02   eb8b6d78  True
  answer_order                 BA   32d1ff07  True
   sample_index                 1   b309fab2  True
all nine moved: True
```

`same inputs     = b409fc45   (equal: True)` is the half people forget: **the same inputs must produce the
same key**, or nothing is ever cached. `test_cache_key_changes_when_the_prompt_changes` asserts both halves
— `a != b` for one character of prompt hash, and `a == c` for identical inputs. A key that is too *loose*
and a key that is too *tight* both break caching; only one of them breaks correctness, and only one of them
has a symptom.

And the contrast, which is the two bugs side by side:

```
a key on item+judge only = ec7f5904
  ... reused after the prompt changed : True (always)
  ... the correct key would have moved : True
```

The loose key answers the same question forever. It is fast, it is stable, and it is the reason the numbers
on your dashboard stopped moving.

The four runs from "What the cache buys, measured", printed from the real `JudgeCache` in
[`labs/module-11/solution/`](../../labs/module-11/solution/), which is the whole implementation of this
lesson — sixty-one lines, and `JudgeCache.key` is a call to `evallab.judge.cache_key`:

```
one full run = 171 judge calls, at an illustrative $0.0004 each = $0.0684

cold run          0 hits /  171 misses   hit rate so far    0%
re-run          171 hits /    0 misses   hit rate so far   50%
prompt edit       0 hits /  171 misses   hit rate so far   33%
prompt reverted  171 hits /    0 misses   hit rate so far   50%

keys stored: 342
calls made: 342;  without a cache: 684
saved: 342 calls ($0.1368)
```

The tests that hold this up are in two places and you should read both, because they assert different
things. [`labs/common/tests/test_suite.py`](../../labs/common/tests/test_suite.py) has the specification —
`test_cache_key_changes_when_the_prompt_changes` and `test_cache_key_varies_by_every_component`, one
`assert` per field. [`labs/module-11/starter/test_cache.py`](../../labs/module-11/starter/test_cache.py) has
the executable form, and two of its tests are the ones this lesson is about:
`test_misses_are_counted_so_a_too_loose_key_is_visible` (a key with a field missing shows up as a hit rate
that will not move) and `test_the_key_matches_the_package_helper` ("Once fixed, the cache and evallab must
agree — or CI caches for two different things under one name").

Run them:

```
$ py -m pytest labs/common/tests -q
.......................................................                  [100%]
55 passed in 0.51s
```

> [!IMPORTANT]
> The judge verdicts behind every key in this lesson come from the seeded educational model of judge
> behaviour recorded into `datasets/support.json` at build time; they are not measurements of any named LLM,
> and the judge ids are the names the recorded runs are filed under. **The keys are real** — they are the
> output of the shipped `cache_key` on real items — and the hit and miss counts are real counts of lookups
> this code performed. The **$0.0004 per call is an illustrative figure** for a small open model, taken from
> the `cost_per_call` the shipped gate test uses so the arithmetic is checkable; it is not a quote, and the
> ratio between a cached and an uncached run is the number worth carrying to your own price sheet. As with
> the rest of this module, span durations are simulated and labelled `evallab.simulated_latency: true`.

## Try it

**Predict first**, on paper, before you run anything:

1. You delete `sample_index` from the key and re-run lesson 13.1's healthy re-scores — the four repeat
   windows that moved the pass rate by up to 3.51 points. What happens to those numbers, and which two
   dashboards get flatter?
2. You key the judge cache on the commit SHA. On a branch where you push five times a day, what is your hit
   rate, and what do you conclude about caching?
3. Your hit rate sits at 100% for a month. Write two sentences you would send to the person who owns that
   cache, and say which of your nine fields you would suspect first.
4. One broken item on 57 is a 1.75-point drop and the gate passes it. Does a cache change that number at
   all, and if not, why is it still the first thing to fix?

[Lab: evallab package](../../labs/common/)

1. **Change one field at a time and watch the key move.** Copy the sweep from *Show me* into a file and run
   it; then delete each row in turn and confirm the key stops moving when that field is gone from the key.
   Finish by removing `sample_index` and confirming that repeat 0, 1 and 2 of one item now share a key —
   then write down what that does to a majority vote over three samples.
2. **Count the misses, and break the key on purpose.** Write a ten-line `JudgeCache` whose `key()` is
   `f"{item.id}|{judge_id}"`, and run it over the four-run sequence above. Then add the miss counter and
   print `hits`, `misses` and `hit_rate` after each run. Write the one line you would add to the gate's
   report that would have caught this within a week.
3. **Do the edit-and-revert.** Run the cold run, then a prompt edit, then a revert, recording hits and
   misses for each. Predict the third run's numbers before you run it. Then find a field *other* than the
   prompt whose edit you would rather not pay for — `model_build`, `fewshot`, `answer_order` — and say which
   one of those you expect to change in an ordinary week.
4. **Make the key disagree with the library.** Copy `cache_key` into your own module, change one field's
   join order, and check `test_the_key_matches_the_package_helper`. Read what the test's docstring says
   about the consequence, and write down how long you would run before noticing.
5. **Put a ceiling on it.** Build a `Budget(max_calls=171, max_usd=0.07)`, run the sequence through
   `check(calls, usd)`, and find the settings that make the suite refuse its own run. Then work out which
   knob you would turn to bring it back under, and say which of those knobs is a worse thing for the gate
   than a large bill.
6. **Size the hash.** Sample at least 3,420 key inputs — the item × variant × judge × repeat grid — count
   the distinct keys, and compute the birthday bound for the 32-bit space. Then work out how many cached
   verdicts it would take for a collision to be a coin flip, and say what you would change in `cache_key`
   if your suite were that size.

## Break it

**Key on item and judge.** The shipped starter in [`labs/module-11/`](../../labs/module-11/) does exactly
this and it is the most instructive bug in the course, because the fix is one line and the damage is
permanent. The cache answers `ec7f5904` for `s01` under `c-rubric-3b` whether you are grading `v1` or
`v1padded`, whether the prompt changed, whether the rubric changed. The lie: **a cache is not a faster
answer, it is a claim that the question is the same**, and a key that omits a field is a claim you have not
checked. Nothing about this bug is visible in the output — it is *reproducible*.

**Drop `sample_index`.** Three repeats collapse to one value three times. Run-to-run noise goes to exactly
zero; the gate's false-alarm rate falls to a perfect zero and its miss rate rises to one; every chart you
built to watch the gate gets flatter. The lie: **a measurement that got quieter and no more sensitive did
not get better, it got smaller**, and the dashboard cannot tell those apart.

**Key on the commit SHA or the branch name.** A commit key never hits, so you pay full price and conclude
caching does not work. A branch key that is reused across branches serves another branch's verdicts, which
is the same bug wearing a different name. The lie: **a cache keyed on identity caches the *identity*, not
the content**, and in CI the identity of a pull request changes several times an hour.

**Don't count misses.** `JudgeCache.hits`, `.misses` and `.hit_rate` exist for one reason, and
`test_misses_are_counted_so_a_too_loose_key_is_visible` is the test that keeps them honest. Without them a
too-loose key is indistinguishable from a perfectly warm one. The lie: **the only observable difference
between a correct cache and a broken one is a counter nobody is printing.**

**Cache the dataset.** The dataset is not a cache — it is the population. Serving labels from a cache whose
key is the file's *path* rather than its bytes means a label edit is invisible until somebody clears the
cache by hand. The lie: **a cache of the measurement is not a cache, it is a stale copy with no
invalidation story**, and the eval set is the one thing that must never be stale.

**Use the saving to cut repeats instead of buying items.** Caching makes a run cheaper; it does not make a
bigger suite affordable in the only sense that matters — 171 calls on 57 items is still a 57-item suite.
Lesson [10.3](../module-10/lesson-03.md)'s grid says what items buy and what repeats buy, and they are not
the same thing. The lie: **a cheaper run is the same run**, and the temptation to spend the saving on
repeats rather than on items is how a suite buys quieter noise instead of more signal.

## Fix it

1. **Use `evallab.judge.cache_key` and do not reimplement it.** It is nine fields, one `"|".join`, one hash,
   and it is shared with the browser half of the course. A second copy of the key is a second definition of
   what a verdict depends on, and it will drift — `test_the_key_matches_the_package_helper` is the
   assertion, and its failure mode is paying full price forever without noticing.
2. **Test the key by changing one field at a time and asserting it moves.** That is the whole test, and
   `test_cache_key_varies_by_every_component` is its nine lines. A field you have never asserted against is
   a field you have an opinion about.
3. **Assert the other half too: identical inputs give an identical key.** Without it you will eventually
   "fix" a too-loose key by adding a timestamp, and the cache will never hit again — with a green build and
   a bill that doubles.
4. **Print `hits`, `misses` and `hit_rate` on the gate's own report.** A hit rate that never falls after a
   prompt edit is the signature of a key with fields missing, and it costs one line to notice.
5. **Keep `sample_index` in the key, and keep the repeats.** The repeats are what make the measurement's
   width what it is. If the budget forces a choice, [10.3](../module-10/lesson-03.md)'s grid says buy items
   before repeats — and a cache is what makes either one affordable.
6. **Key on content, restore across branches, and never write to a key you already wrote.** The judge cache
   is content-addressed and therefore valid for every branch; it is not scoped to a commit. GitHub caches
   are immutable, so a key you want to replace has to change — which is another reason the key has to be a
   hash of the inputs and nothing else.
7. **Let `Budget` refuse the run.** `Budget(max_calls, max_usd).check(calls, usd)` on the numbers `run_gate`
   already puts on every result. A ceiling that cannot be met is met by grading fewer items, and grading
   fewer items is a worse outcome than the bill.

## How do I know it works?

**Challenge, on dev.** The dev split is **57 items**, and a cache is only correct if every field survives a
test you actually ran:

- **Every one of the nine fields has an assertion behind it.** Change each alone; the key moves every time.
  The base key is `b409fc45` for item `s01` under the base configuration, and the same inputs give the same
  key — `test_cache_key_changes_when_the_prompt_changes` asserts both halves of that.
- **A deliberate loose key is caught by a test, not by a person.** Re-key the cache on `item.id` and
  `judge_id` and the suite of tests goes red on `test_a_different_prompt_never_hits`,
  `test_variant_and_judge_change_the_key`, `test_every_component_changes_the_key` and
  `test_misses_are_counted_so_a_too_loose_key_is_visible`. If your cache passes all of these, the key is
  right; if it passes some, you know exactly which field you left out.
- **`hits`, `misses` and `hit_rate` are on the report.** Cold run **0/171**, re-run **171/0**, prompt edit
  **0/171**, revert **171/0**, over four runs. A hit rate that does not fall to zero after a prompt edit is
  the one number that proves the prompt is not in the key.
- **The repeats are still three distinct samples.** Three lookups of one item at `sample_index` 0, 1 and 2
  give three keys and three misses. If they give one key, your measurement is one sample counted three times
  and lesson 13.1's noise table no longer applies to your gate.
- **The cache survives a save and reload**, because the CI job restores it between runs.
  `test_survives_a_save_and_reload` is one line and it is the one that makes caching possible at all.
- **The cost of a run is on the report too.** `171` calls, `usd` from `cost_per_call`, and the budget's
  `ok` beside them.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, run once, cold cache, same
nine fields:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Judge calls at 3 repeats | 171 | 111 |
| Distinct cache keys one cold run writes | **171** | **111** |
| Cold run | **0 hits / 171 misses** | **0 hits / 111 misses** |
| Re-run of the same commit | **171 hits / 0 misses** | **111 hits / 0 misses** |
| After changing `prompt_hash` by one character | **0 hits / 171 misses** | **0 hits / 111 misses** |
| After changing `model_build` to `qwen3-1.7b-q8_0` | **0 hits / 171 misses** | **0 hits / 111 misses** |
| After changing `answer_order` to `BA` | **0 hits / 171 misses** | **0 hits / 111 misses** |

The last four rows are the validation and the reason the split is held out at all. **A held-out set is
where a too-loose key finally shows up.** Every field you failed to put in the key will hit on a suite you
built the cache from, because you wrote those tests against your own fixtures and your own fixtures already
agreed with you. On 37 items nobody has looked at, a miss that *should* have been a hit is not obvious —
and the rows that matter are the ones where a single field's change is supposed to cost a full run and
does. A cache that reports 171 hits after you changed the prompt is not fast. It is wrong, and it was wrong
before you ran the held-out half, you just could not see it from inside the split you developed against.

The one asymmetry worth noticing is that **the held-out half is smaller, so a bug there produces fewer wrong
verdicts and is just as invisible.** 111 calls is not a safety margin.

## Use / don't use

**Do cache judge verdicts, and cache them content-addressed.** It is the largest cost lever in the suite and
it costs one function.

**Do keep the key and the library's `cache_key` the same object.** Two copies drift, and the drift shows up
as a bill rather than as a failure.

**Do print the hit rate next to the pass rate.** Both are properties of the run, and one of them is the
alarm for the other being stale.

**Do treat a 100% hit rate as a bug report.** A cache that never misses is a cache whose key is missing
fields, and it is cheaper to find that in a log than in a support ticket three weeks later.

**Do budget the run with `Budget` and let it refuse.** A ceiling nobody enforces is a wish.

**Don't key the judge cache on a commit, a branch, or a PR number.** Identity changes; content does not.
You will either never hit or serve another branch's verdicts.

**Don't cache the dataset, the human labels, or the item list as if they were verdicts.** They are the
measurement. Their invalidation story is a code review, not a hash.

**Don't let the saving quietly become fewer repeats.** The saving is worth real money, and spending it on
repeats buys quieter noise; [10.3](../module-10/lesson-03.md)'s grid says items are the better buy, and a
cache is what makes items affordable at all.

**Don't quote the $0.0004 in this lesson as a price.** It is a teaching figure taken from the shipped gate
test's `cost_per_call`, chosen so the arithmetic checks out. The number to carry to your own price sheet is
the *ratio*: how many calls a week your team makes that a correct key would have answered for free.

What teams actually do in production: one content-addressed verdict cache, restored by the runner's cache
mechanism, keyed by the same function the judge wrapper uses, with `hits`/`misses`/`hit_rate` in the gate's
own report and a `Budget` check in front of the run. The dependency cache beside it is a separate key with
a separate job and nobody confuses them, because the consequences are different: a wrong dependency version
fails a test, and a wrong verdict key does not.

## Reflect

1. Your hit rate is 100% every day and the gate's false-alarm rate is a perfect zero. Write the three
   sentences you would send to the person who added that cache, and name the one line you would add to the
   gate's report that would have said it a month earlier.
2. Deleting `sample_index` from the key made every metric on your dashboard improve. Write the pull-request
   description as the person who made the change would have written it — with the before-and-after numbers
   on it — and then write the review comment you would leave on somebody else's pull request that does the
   same thing.
3. A cache let you keep three repeats and 57 items inside a budget that did not fit them last quarter. Write
   the budget review where you say what you spent the saving on, and say why items rather than repeats. The
   number that settles it is lesson [10.3](../module-10/lesson-03.md)'s: the paired interval's half-width is
   **30.0 points at 20 items** against **13.3 at 94**, so items shrink the measurement's width and repeats
   barely touch it.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- GitHub Actions, [Dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
  — the two properties that shape the job rather than the key: caches are immutable, so saving under an
  existing key does nothing and a key you want to replace has to change; and caches are scoped by branch, so
  a cache a pull request can read is one written on the default branch. A content-addressed verdict cache is
  valid everywhere, which is the argument for keying it on content.
- Anthropic, [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — the
  production version of this lesson, where the provider does the keying for you: the system checks whether a
  prompt *prefix*, up to a cache breakpoint, is already cached, and reuses it. Every property that makes it
  safe is the property `cache_key` has to enforce by hand — the content is the address, one changed token
  invalidates the entry, and the saved work is only valid for an identical prefix.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the first fix:
  a number you publish needs to come from a run you can repeat, and a system that quietly stops re-running
  something has stopped measuring it while continuing to report.