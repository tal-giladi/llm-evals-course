---
id: "11.3"
module: 11
minutes: 20
practice_minutes: 55
prerequisites: ["05.3", "11.1"]
objectives:
  - Explain why a judge that passed validation can start failing six weeks later with no code change, and name the fields of the key that moved.
  - Start the pinned judge from docker-compose.yml and read `evallab doctor` to find out which lessons of this module the machine in front of you can run.
  - Compute the lesson 5.3 cache key for one item and say which of its components the container pins and which it does not.
  - Decide whether a live judge earns its wall-clock cost on your own suite, and write that decision down with a number beside it.
volatility: implementation
sources:
  - title: "Ollama — Docker"
    url: https://docs.ollama.com/docker
  - title: "ollama/ollama releases"
    url: https://github.com/ollama/ollama/releases
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 11.3 · A judge through Ollama on your laptop

This is the only lesson in the course that runs a model, and running one is optional: `evallab`'s default
judge replays verdicts recorded at build time, so nothing here needs an API key or a model download to
finish. What the live judge is for is the one thing recorded data cannot answer — how your judge behaves on
your data — and the only reason that answer is worth having is that you pin the thing you are calling.

## Why it matters

A team validates a judge on Monday. Dev kappa 0.79, TPR 96.7%, TNR 81.5%, the dashboard is green, the ADR is
written. Six weeks later the same command starts failing on a handful of items. Nobody changed the prompt.
Nobody changed the code. Nobody changed the model on purpose.

Here is why the failure is so hard to see coming, using the numbers the run above actually printed. The dev
split is **57 items**. One verdict changing hands is **1.8 points** of pass rate. The 95% interval on that
same pass rate is **46.7% to 71.4%**, a half-width of **12.4 points**. So the size of the drift a rebuilt
judge introduces is the same order as the measurement's own width: it does not announce itself on the
dashboard, it accumulates, and the first place it is visible is a red build in CI. And the run that goes red
prints `6 disagreement(s). These are the work:` — six items, out of fifty-seven, a tenth of the suite — which
reads like a normal bad week rather than a different judge.

The usual cause is the sentence nobody wants to write in the incident: **the judge is not the same judge.**
Three things move on their own. A **new model build** — the server was upgraded, or a different build of the
same weights was pulled. A **different quantisation** — the same weights, the same tag, served from a
different volume or a different machine, and the arithmetic underneath is not bit-identical. And a **floating
tag** — `latest`, or an unpinned `qwen3`, which means the bytes behind the name can change on any day,
including the day the CI runner rebuilt its image.

None of these is a bug in the model. They are all bugs in the *identity* of the model, and the identity of
the model is the thing your kappa was measured on. Lesson [5.3](../module-05/lesson-03.md) already wrote the
rule — a recorded verdict is tied to an exact key — and this lesson is the day that rule gets tested by
something that moves on its own while you are asleep.

The fix is a container with a pinned tag, and that is what `labs/common/docker-compose.yml` is for. It is in
the production path because of this failure, not as setup tax.

## How it works

### The key has nine components. A container pins some of them.

`cache_key()` in `evallab/judge.py` is the lesson 5.3 rule as a function you can call. Its signature is the
list of things that must all match before one recorded verdict is reusable:

```python
def cache_key(item, variant, judge_id, sample_index=0, model_build="",
              prompt_hash="", decoding="", fewshot="", answer_order="") -> str:
```

Nine components, joined and hashed to eight hex characters. Here is each one, and the honest answer to
"does the compose file pin it?":

| Component | What moves it | Pinned by `docker-compose.yml`? |
|---|---|---|
| `item.id` | which question is being graded | no — that is your data |
| `variant` | which system output is under test | no — that is your choice |
| `judge_id` | which judge configuration | partly — the prompt is yours, the model behind it is `qwen3:1.7b` |
| `model_build` | a new server build, a new quantisation | **yes, by tag** — `ollama pull qwen3:1.7b` |
| `prompt_hash` | one character of the rubric | no, and it should not be — a new prompt is a new judge, re-recorded |
| `decoding` | temperature, seed, top-p | no — your caller sets it |
| `fewshot` | the example ids and the order they appear in | no |
| `answer_order` | A/B or B/A | no |
| `sample_index` | which repeat this is | no |

Read that table as the lesson. The container exists to pin **one** of the nine — `model_build` — and it is
the one that moves without anybody editing anything. The other eight are all under your control already, and
three of them (`prompt_hash`, `decoding`, `fewshot`) are things you change on purpose, which is why a
recorded verdict for them is not a stale result but a *different* result.

> [!IMPORTANT]
> `qwen3:1.7b` is a **tag, not a content digest**. A registry tag is a name that can be re-pointed at
> different bytes, and the compose file says so itself: *"The tag is the pin — change it and every recorded
> number in your report stops being reproducible."* That is pinning as well as this file can, and it is a
> real improvement over nothing. The tighter version is to record the content digest that `ollama list`
> reports for the model into the `model_build` field, so the key names bytes rather than a name. The course
> does not ship a digest for you, and that is a real gap rather than a subtlety.

### The healthcheck waits for the server, not the container

This is the second thing the file gets right, and the comment above it is worth reading in full because it
names a failure you will otherwise hit on your first attempt:

> Wait for the server, not the container: `up` returns before Ollama is actually listening, and a judge call
> in that window fails for a reason that has nothing to do with the learner's code.

`docker compose up -d` returning is not the server being ready. The file's healthcheck is a real readiness
probe — `ollama list`, which is a request to the HTTP API and fails until the API is answering — polled
every 5 s, 12 retries, with a 10 s start period. And the second service, `pull-model`, does not start until
`condition: service_healthy`, so the 1.7 GB of weights are on disk before the first judge call rather than
during it. Between them, those two lines are the difference between "my connection was refused" and "my
judge is wrong", and only one of those is a bug in your code.

The whole file, which is the entire answer to this lesson:

```yaml
services:
  ollama:
    image: ollama/ollama:0.5.7
    ports:
      - "11434:11434"
    volumes:
      - ollama-models:/root/.ollama
    environment:
      OLLAMA_KEEP_ALIVE: "5m"
    healthcheck:
      test: ["CMD-SHELL", "ollama list >/dev/null 2>&1 || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 10s

  pull-model:
    image: ollama/ollama:0.5.7
    depends_on:
      ollama:
        condition: service_healthy
    entrypoint: ["sh", "-c", "ollama pull qwen3:1.7b"]
    environment:
      OLLAMA_HOST: http://ollama:11434
```

`0.5.7` is the server build and `qwen3:1.7b` is the model, and both are spelled out. Neither is `latest`.

### What a live judge costs, and what makes it affordable

`run_suite()` computes its own call count — `calls = len(scored) * repeats` — and the arithmetic is worth
doing before you press the button, because it is the only budget line in this lesson:

| Run | Items × repeats | Judge calls |
|---|---|---|
| dev, greedy | 57 × 1 | **57** |
| dev, 3 repeats | 57 × 3 | **171** |
| full set, greedy | 94 × 1 | **94** |
| full set, 3 repeats | 94 × 3 | **282** |
| full set, 5 repeats | 94 × 5 | **470** |

The lab's price sheet records **$0.02244** a call for the `Qwen3 1.7B · Rubric · 0 shots` judge, so 282
calls of that shape is **$6.33** on that sheet, and 57 is **$1.28**. Those are the course's recorded prices
for its educational model, not an Ollama bill — a local call costs no money at all. **It costs wall-clock,
and this repository has never been run against Ollama, so there is no number here for you to copy.** Measure
it yourself: run the dev split once with the container up, time it, and divide by 57.

What you can price without running anything is the second run. That is what the cache key is for:

| Second run of the same suite | Cache hits | New judge calls |
|---|---|---|
| nothing changed | every key matches | **0** |
| one character of the rubric | every key misses | 282 |
| container rebuilt from a moved tag | every key misses | 282 |

The middle and bottom rows are the entire cost of a discipline. A suite that keys on all nine components can
be re-run every night for the price of a lookup, and a suite that keys on the item id alone will serve you
last month's verdicts forever and call it a regression suite.

> [!IMPORTANT]
> The recorded judge runs in `evallab` come from the same seeded educational model as the browser labs in
> Modules 1–10, not from a real LLM. Every statistic printed from them is computed for real. The judge
> names in the menu — `Qwen3 1.7B`, `Llama 3.2 3B` — are the labels the recorded runs are filed under, not
> measurements of those models in the wild, and this lesson does not claim a single number that a live
> Ollama run would have to produce.

## Show me

Everything in this section is real output from this repository, on a Windows laptop, with no model
installed and no container running. That is the point: **this is what the lesson's default path looks like,
and it is a complete lesson.** Your `doctor` will print different lines for the last two, and that is the
command doing its job.

From `labs/common/`, with `PYTHONPATH=.`:

```console
$ py -m evallab.cli doctor
Python 3.14.3 on Windows 11

ok       datasets      support.json: 94 items (57 dev / 37 test), 16 recorded judges
ok       suite         eval: 59.6% pass on n=57
               kappa 0.79  TPR 96.7%  TNR 81.5%
optional live judge    ollama not installed - lessons 11.1, 11.2 and 11.4 do not need it
optional docker        installed but not running - lesson 11.3 only

Everything the required path needs is present. Start with lesson 11.1.
```

Two lines in that output are the design decision this module was built around, and they are the code saying
it rather than the prose: `live judge ... lessons 11.1, 11.2 and 11.4 do not need it` and
`docker ... lesson 11.3 only`. **Every other lesson in this course runs with no API key and no model
download.** If your machine cannot run containers, `doctor` says so in the first second instead of halfway
through a lab.

The suite itself, same recorded judge, dev split:

```console
$ py -m evallab.cli run --judge c-rubric-3b --variant v1 --split dev
eval: 59.6% pass on n=57  (dev, Llama 3.2 3B - Rubric - 0 shots)
  kappa 0.79   TPR 96.7%   TNR 81.5%   accuracy 89.5%

6 disagreement(s). These are the work:
  s01  human=0 judge=1  (no_citation)
  s38  human=1 judge=0  (correct)
  s60  human=0 judge=1  (wrong_fact)
  s64  human=0 judge=1  (no_citation)
  s73  human=0 judge=1  (no_citation)
  ... and 1 more
```

Six items out of 57 is the 10.5 points of pass rate from the opening of this lesson, and the ids are the
thing you would diff between two runs six weeks apart.

And the package's own tests, which include the executable version of this lesson's central claim:

```console
$ py -m pytest tests/ -q
17 passed, 1 warning in 0.64s
```

> [!NOTE]
> Two of those 17 are the whole argument. `test_cache_key_changes_when_the_prompt_changes` changes one
> character of `prompt_hash` and asserts the key changes; `test_cache_key_varies_by_every_component` walks
> all seven non-trivial components of the key, including `model_build` going from `qwen3-1.7b` to
> `qwen3-1.7b-q4`, and asserts each one produces a different key. Read them in
> `labs/common/tests/test_suite.py` — they are the cheapest correct description of lesson 5.3 anywhere in
> the course.

Here are the four keys, computed for real, for one item. Item `s01`, variant `v1`, judge `c-rubric-1.7b`:

```console
>>> cache_key(it, "v1", "c-rubric-1.7b",
...           model_build="qwen3-1.7b",
...           decoding="temperature=0.0",
...           prompt_hash="grade-the-answer-against-these-rules-9f2c")
'da7165eb'
>>> cache_key(it, "v1", "c-rubric-1.7b", ..., prompt_hash="...9f2d")
'436d942a'          # one character of the prompt
>>> cache_key(it, "v1", "c-rubric-1.7b", ..., model_build="qwen3-1.7b-q4_K_M")
'7a2e821d'          # same weights, different quantisation
>>> cache_key(it, "v1", "c-rubric-1.7b", ..., sample_index=1)
'd9716458'          # the second repeat of the same question
```

One item, four questions, four keys. The third one is the failure at the top of this lesson expressed in
eight characters: **a re-quantisation is a different judge, and the key is what says so.**

## Try it

**Predict first**, before you start anything:

1. Your dev split is 57 items. You rebuild the judge container and four items change verdict. What does the
   pass rate do, and is that move bigger or smaller than the run's own 95% half-width?
2. You edit one character of the rubric. How many of a 282-call run's cache keys survive, and why is the
   answer not "most of them"?
3. `docker compose up -d` returns successfully. You immediately fire the first judge call and get a
   connection error. Name the thing the healthcheck is for and what would have happened without it.
4. If a live judge costs no money per call, why is it not the default in `evallab`?

[Lab: evallab package](../../labs/common/)

1. **Run `doctor` first and write down what it says.** Do this before installing anything. Record which of
   the three lines — datasets, suite, live judge, docker — reports `ok`, `missing` or `optional`. That list
   is the answer to "which lessons of this module can this machine run", and you should have it in writing
   before you discover it from an error.
2. **Compute the keys yourself and check the arithmetic.** From `labs/common/`, get one dev item, then call
   `cache_key` four times: the recorded configuration, one character of `prompt_hash` changed, one
   `model_build` quantisation changed, and `sample_index=1`. Write the four eight-character keys next to
   each other. That table is your answer to prediction 2, and it is the same table the test file asserts.
3. **Prove the cache rule is worth having.** Take `calls = len(scored) * repeats` from `run_suite` and
   write out the five rows of the call-count table above for your own suite size. Then write the second-run
   table and say, for each of the three rows, which of the nine components you would have to lie about to
   make that row come out cheaper. The answer for all three is: cache on the item id, and report last
   month's verdicts.
4. **If you have Docker, start the pinned judge and time it.** `docker compose up -d`, then
   `docker compose run --rm pull-model`, then `docker compose ps` and read the `healthy` status rather than
   the `running` one. Time the pull, separately from the first call, and write both down. Then
   `docker compose down` and `docker compose up -d` again, and time how long until the healthcheck passes —
   that number is the gap this file's comment is about. If you do not have Docker, skip this and write down
   that you skipped it; `doctor` already told you which lessons it affects.
5. **Decide whether you would use it.** On your own dev split, with the measured seconds-per-call from step
   4 in hand if you have it and a stated guess if you do not, write the one sentence that would go in your
   ADR: *this suite runs the live judge on <schedule> because <reason>, and the recorded judge everywhere
   else because <reason>.* The reason has to be a sentence a reviewer can disagree with.

## Break it

**Float the tag.** Change `image: ollama/ollama:0.5.7` to `ollama/ollama:latest`, and change
`ollama pull qwen3:1.7b` to `ollama pull qwen3`. Nothing in the diff looks alarming; it looks like a
simplification. The lie: **a tag is a promise made by whoever published it, and a promise is not a version.**
The first CI runner to rebuild after a re-push gets a different judge with a green build attached to it.

**Pin the server and leave the model loose.** This is the realistic version, because it is the one where the
careful part got done. `image: ollama/ollama:0.5.7` is an immovable server build, and `qwen3:1.7b` is
whatever that server downloaded this morning. The lie: **a pinned server running an unpinned model is the
configuration that feels reproducible and is not**, because the thing that produces verdicts is the model,
not the process that serves it.

**Store the verdict without the key.** A live run that writes `s01: PASS` and a run that writes
`s01: PASS | qwen3-1.7b-q4_K_M | temp 0.0 | prompt 9f2c` are the same line of text until the week you need
to know which judge produced the first one. The lie: **a verdict without a key is a verdict you cannot
invalidate, so it is a verdict you have to believe forever.**

**Let the container be the readiness signal.** A healthcheck of `CMD ["true"]`, or a CI step that sleeps for
a fixed 20 seconds, both produce the same class of failure: a connection refused, a red build, and an
incident whose first twenty minutes were spent on something that was never broken. The lie: **a job that
starts successfully has not started; it has been scheduled**, and only a request to the thing you are about
to depend on can tell you the difference.

## Fix it

1. **Pin both things, and write the pin down where the numbers are.** `image: ollama/ollama:0.5.7` and
   `ollama pull qwen3:1.7b`, both in the repository, both reviewed in a pull request when they change. Then
   the tighter version: capture the digest `ollama list` reports and put *that* in the ADR next to the kappa,
   so the report names bytes rather than a name.
2. **Put `model_build` in the key, and let the key be the reason the cache is safe.**
   `cache_key(item, "v1", "c-rubric-1.7b", model_build="qwen3-1.7b-q4_K_M", ...)` is the same call with one
   more argument, and it is the difference between a re-quantised judge being a cache miss and being a
   silently wrong number. This is lesson 5.3's rule and the reason it existed.
3. **Make the readiness probe a real request.** The healthcheck in the shipped file asks the server
   something. Keep that. It is five seconds of configuration that removes an entire class of false incident.
4. **Record the pull, not just the run.** `docker compose run --rm pull-model` is idempotent and the
   dependency on `service_healthy` is the whole design. A model that arrives halfway through a judge run is
   a model that made the first twenty items slow and the rest fast, which is a run you cannot compare to
   anything.
5. **Keep `RecordedJudge` as the default, deliberately.** The live judge is an *instrument*, not a
   dependency. A suite that cannot run without a 1.7 GB download is a suite that will not be run by the
   person who needs to run it, and the cost of a live judge is not the dollars — it is the number of people
   who are able to check your work.

## How do I know it works?

**Challenge, on dev.** The 57-item dev split, and four conditions before a live judge is allowed near CI:

- **`doctor` output is committed next to the suite**, with its date. Not the answer you remember — the
  output, because the three optional lines are the ones that change.
- **The key for a fixed item is byte-identical across a full teardown.** `docker compose down`, then
  `docker compose up -d`, wait for `healthy`, and re-run one item. `cache_key` must return the same eight
  characters it returned before. If the tag moved, this is where you find out, on your machine, in a minute,
  instead of in CI six weeks later.
- **One character of the rubric changes every key.** This is `test_cache_key_changes_when_the_prompt_changes`,
  and it is the cheapest test in the package. If your key does not change when the prompt does, the cache is
  not a cache, it is a delay.
- **Your own TPR, TNR and kappa, on your data, from the live judge.** This is the one thing the recorded
  runs cannot give you. The recorded `c-rubric-3b` judge reads kappa **0.79**, TPR **96.7%**, TNR **81.5%**
  on these 57 dev items — that number belongs to the recorded judge, and if your live judge reads anything
  materially different, that is the finding this lesson exists to produce. Write down both, side by side,
  and say which one your gate is allowed to use.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, run once:

```console
$ py -m evallab.cli run --judge c-rubric-3b --variant v1 --split test
eval: 43.2% pass on n=37  (test, Llama 3.2 3B - Rubric - 0 shots)
  kappa 0.73   TPR 82.4%   TNR 90.0%   accuracy 86.5%

  1 slice(s) contain no failing items, so their true-negative rate is not measurable: out of scope
```

Three things in that output are the check, and all three are about honesty rather than the number:

- **The kappa fell from 0.79 to 0.73 and the TPR from 96.7% to 82.4%.** One human-passed item in thirty on
  dev, three in seventeen on test. On 37 items the interval is wide enough to absorb that, and the point of
  reading it once is that you now know your judge is not a 0.79 judge on data it was not tuned on.
- **A slice is reported as not measurable.** The `out_of_scope` slice has no failing items on the test split,
  so its true-negative rate cannot exist, and the run says so in words rather than printing a confident
  zero. A number that cannot fail is a number that will eventually be trusted.
- **The same command produced both rows.** The only difference is `--split`, and that is what makes the
  comparison a validation rather than a second opinion.

## Use / don't use

**Do run a live judge when the question is about your data.** "Does this rubric work on our support
questions" is not answerable from recorded runs of a different dataset, a different prompt and a modelled
judge. This is the one measurement the whole course cannot give you, and it is worth an afternoon.

**Do pin the server build, the model tag and the decoding settings together, or do not run it at all.** A
live judge that is not pinned produces a number with no provenance, which is exactly the state lesson 5.3
exists to prevent. Three of the nine key components are yours to hold still and the fourth is the
container's job.

**Do keep the recorded judge as the daily path.** It is instant, free, deterministic, and identical on
every machine, which makes it the only version of this suite that can gate a pull request on a CPU-only
runner. Its limits are real and named: it tells you how the suite behaves, not how your judge behaves.

**Don't make the live judge the default because you have one now.** The moment `evallab` needs a running
container, every other lesson in the module needs a running container, and the people most likely to
disagree with your judge are the ones with the least patience for a download.

**Don't quote a latency for a local judge you have not measured.** Not this lesson's, not a blog's, not a
vendor's number for a different machine. Write `not measured` and then measure it. The arithmetic to report
is one line: `57 calls at <n> s/call = <m> min on <hardware>`, and the hardware is part of the number.

What teams actually do in production: the CI job runs the recorded judge, keyed on all nine components,
which makes every run after the first a cache lookup. A live judge runs on a schedule — nightly, or weekly —
and its only job is to re-record, and to raise a flag when its kappa against the frozen human set has moved
far enough that the recorded data no longer describes today's judge. That is a small, scheduled, pinnable
job, and it is the whole reason Docker is in the production path.

## Reflect

1. The dev run prints 6 disagreements out of 57 items, and a rebuild of the judge container moved the pass
   rate by 10.5 points. Write the two sentences you would put in the incident channel, and name the field
   of the cache key you would print next to every number in the report.
2. `qwen3:1.7b` is a tag. Write the two sentences that explain to a reviewer why you are willing to ship a
   release gate whose judge is named by a mutable string, and what one extra command would make that
   objection go away.
3. This is the only lesson in the course that runs a model and it is optional. Write the argument you would
   give a learner on a locked-down corporate laptop for keeping it that way — and say what they would miss
   by skipping it.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Ollama, [Docker](https://docs.ollama.com/docker) — running the server in a container and what that does
  and does not pin; the compose file in `labs/common/` is built on this.
- The Ollama project, [releases](https://github.com/ollama/ollama/releases) — the build numbers that
  `ollama/ollama:0.5.7` refers to, and the reason a server build has to be in the key as well as the
  model tag.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — why a judge is identified by its full configuration
  rather than by a name, and what changes when the configuration changes quietly.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath fix 1: a
  number you cannot reproduce is not a measurement, it is a memory of one.
