---
id: "03.2"
module: 3
practice_minutes: 35
minutes: 15
prerequisites: ["03.1"]
objectives:
  - Choose between a regex and a JSON schema for a failure category, and say what each one cannot see.
  - Read a lenient JSON parser's recovery report and decide, out loud, whether a wrapper is a defect.
  - Turn a schema rejection into a fix by reading the path and the rule the validator names.
volatility: concept
sources:
  - title: "JSON Schema — Understanding JSON Schema: object"
    url: https://json-schema.org/understanding-json-schema/reference/object
  - title: "JSON Schema — Validation specification"
    url: https://json-schema.org/draft/2020-12/json-schema-validation
  - title: "MDN — Regular expression syntax cheat sheet"
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Cheatsheet
last_verified: "2026-10-01"
---

# 03.2 · Regex and JSON schema

Two code checks do most of the structural work in an eval suite, and they answer different questions.
A regex asks whether the output has the right shape. A schema asks whether the shape is the right
one. This lesson is about telling them apart, and about the parser in between that decides on your
behalf whether a wrapper is a defect.

## Why it matters

A team evaluates variant B of the recipe lab. The system was told "output JSON". The objects it
produces are mostly right. The team's check is a raw string comparison against the expected JSON, and
it reports **4/20 — 20.0%, with an interval of 8.1%–41.6%**.

Eleven of those sixteen failures are not model errors at all. The model wrapped the JSON in a code fence, exactly as thousands of models do when asked for JSON in a chat interface.
Strip the fence and **15 of the 20 objects are identical to the reference**. The team has spent a week
concluding that the prompt is bad, when the prompt has one small cost they never priced: the wrapper.

Now make it worse in the way teams usually do. The team adds a regex, `^\s*[\{\[]`, so at least
failures will have a reason attached. That regex reads **45.0% (25.8%–65.8%)** on variant B — it is
measuring the fence, not the answer. On variant A it reads 100.0%, and on variant C it reads 75.0%
(53.1%–88.8%). Three systems, three numbers, and none of the three tells you whether a single recipe
was extracted correctly. The regex is a perfectly good check pointed at the wrong question.

Both mistakes have the same cause: picking the tool before deciding what is being decided.

## How it works

### Regex: does it have the shape?

A regex answers one question — does this string look like the thing? It is one line, costs
microseconds, and is the right tool for a small, fixed set of surface facts:

- the output starts with `{` or `[` rather than a paragraph of prose;
- it contains a temperature, a currency symbol, a citation marker;
- it does not contain a refusal phrase.

What a regex cannot do is look inside. It cannot tell you that `ingredients` is a list, that the first
element has no `unit`, or that `prep_minutes` is 900. It can only tell you that the characters `unit`
appear somewhere, and "appears somewhere" is a much weaker claim than it sounds. Write `unit` and the
regex passes an object with the field in the wrong place, spelled wrong, or nested one level too deep.

The shipped default pattern on this lab's page is `^\s*[\{\[]` — anchored, so it requires the first
non-whitespace character to be a brace or a bracket. Anchoring is the whole design: without the `^`
and the `\s*`, the pattern `\{` passes **20 of 20 on all three variants**, including the one that
emits invalid JSON on four items, because a stray brace is somewhere in every one of them. Anchoring
turns a check that cannot fail into a check that can.

And a regex check must survive being wrong in your own code. The lab compiles your pattern inside a
`try`; an invalid pattern scores **0 on every item** instead of throwing into the page. That is a good
engineering decision and a bad scoreboard: a single unclosed bracket turns "the system passes" into
"the system fails everything", and from the number alone you cannot tell which happened. The page does
say "That is not a valid regular expression, so it scores zero on everything" — read the failure text,
never just the rate.

### Schema: is this the right shape?

A JSON Schema says what a valid object looks like, and it checks the structure rather than the surface.
The lab ships a deliberately small subset, and the subset is the lesson: `type`, `enum`, `minimum` and
`maximum`, `pattern`, `minItems`, `items`, `required`, and `additionalProperties`. It supports nothing
else, and when a keyword it does not implement appears in a schema it is silently ignored.

The property that earns a schema its place is that **every error names a path and a rule**. Here are
the strings the lab's own validator produces when you edit a real item, `r04 Chicken curry`, and each
of these has been run against the shipped code:

| What you changed | What the validator prints |
|---|---|
| Delete `unit` from the first ingredient | `$.ingredients[0] required: missing "unit"` |
| Write `"qty": "700 g"` instead of a number | `$.ingredients[0].qty type: expected number` |
| Set `prep_minutes` to 900 | `$.prep_minutes maximum: must be ≤ 600` |
| Empty the `tags` array | `$.tags minItems: needs ≥ 1 items` |
| Add a top-level `"difficulty": "hard"` | `$ additionalProperties: unexpected "difficulty"` |
| Write `"oven_celsius": "180C"` | `$.oven_celsius type: expected number or null` |

Read the first row again: `$.ingredients[0]`. That is not "the JSON was wrong". That is *the second
element of the ingredients array is missing its unit field*, which is a bug report somebody can act on
at 4pm on a Friday. A judge asked the same question answers in a sentence of prose, differently on
every run, and never with a path.

<details>
<summary>What a schema still cannot see</summary>

Delete an ingredient altogether — remove the whole first element rather than one of its fields — and
the validator prints **nothing**. The schema has `minItems: 1`, and the array still has three items in
it. A schema checks that the shape is legal, not that the content is right. On variant B the schema
check passes **20/20 (83.9%–100.0%)** while **5 of those 20 objects differ from the reference**. On
variant C it passes 16/20 and catches 4 of the 14 real failures. A schema is a floor, never a ceiling.

</details>

You can reproduce that table yourself. On the lab page, paste this into the browser console:

```js
const m = await import("../common/codemetrics.js");
const D = window.EvalLabData.recipe;
const obj = m.parseJsonLoose(D.items.find(i => i.id === "r04").outputs.v1).data;
delete obj.ingredients[0].unit;
console.log(m.validateSchema(obj, D.schema));
// [{ path: "$.ingredients[0]", rule: "required", message: 'missing "unit"' }]
```

### The parser in between is making your decision for you

Model output that should be JSON is very often nearly JSON. The lab's `parseJsonLoose` tries three
things in order and **reports which one worked**:

1. the raw string, trimmed — recorded as `exact`;
2. the contents of the first markdown code fence — recorded as `fenced`;
3. the slice from the first `{` to the last `}` — recorded as `first-object`.

Across the twenty items, that is:

| System | exact | fenced | first-object | no recovery |
|---|---|---|---|---|
| A — schema in the prompt | 20 | 0 | 0 | 0 |
| B — "output JSON" | 9 | 8 | 3 | 0 |
| C — no format instruction | 11 | 0 | 5 | 4 |

Every number in that table is a decision somebody made about what counts as a failure. The parser
unwraps a fence and turns a string failure into a pass; the raw exact-match check does not, and reads
4 of 20 on the same items where this parser reads 20 of 20. Both are defensible. Only one of them is
a measurement.

The rule that keeps this honest: **recovery is a product decision, and it has to be written down
somewhere other than the parser.** Either the fence is a defect your importer must survive — in which
case a fenced output is a pass and the check downstream is what matters — or it is a defect the
system must not produce, in which case unwrapping it is hiding a bug you have decided to ignore. Pick
one, write it in the criterion, and then the parser's leniency is a choice you made instead of an
accident you inherited.

Print the table yourself on the lab page:

```js
const m = await import("../common/codemetrics.js");
const D = window.EvalLabData.recipe;
D.variants.map(v => {
  const c = { exact: 0, fenced: 0, "first-object": 0, failed: 0 };
  D.items.forEach(it => {
    const p = m.parseJsonLoose(it.outputs[v.id]);
    c[p.ok ? p.recovered : "failed"]++;
  });
  return `${v.id} ${v.label}: ${JSON.stringify(c)}`;
});
```

## Show me

Open the lab on the schema preset. It lands on **JSON matches the schema**, **variant C — no format
instruction**, all twenty recipes, and the scoreboard reads:

- **Pass rate 80.0% (58.4%–91.9%)**, four failing items.
- Every one of those four shows the same detail line: `Output is not JSON at all.` No path, because
  there is no object to walk yet.

Those four are `r01 Sourdough loaf`, `r03 Banana bread`, `r07 Roast chicken` and `r08 Mushroom
risotto`, and they fail for one reason that is worth reading twice. Each of them ends like this:

```text
"steps":["Mix flour, water and starter, rest 1 hour.", …, "Bake 45 minutes at 230 C with steam.",
  "notes": "Ask your mum" }
```

The model closed the `steps` array with a comma instead of with `]`, then started a new key. The
parser's error is `Expected ',' or ']' after array element`. Nothing about the recipe is wrong; the
bracket is.

Now put the missing `]` back by hand, in the console, on `r01`:

```js
const m = await import("../common/codemetrics.js");
const D = window.EvalLabData.recipe;
const bad = D.items.find(i => i.id === "r01").outputs.v3.replace(',\n  "notes"', '],\n  "notes"');
const p = m.parseJsonLoose(bad);
console.log(m.validateSchema(p.data, D.schema));
// [{ path: "$", rule: "additionalProperties", message: 'unexpected "notes"' }]
```

Same output, two bugs, two layers. The parse check found the missing bracket. The schema check found
the field nobody asked for — `"notes": "Ask your mum"`, which the reference does not have and the
downstream importer would ignore. Neither check sees the other layer's problem, and together they see
both.

## Try it

**Predict first.** On paper, before you open anything:

1. What does the default regex `^\s*[\{\[]` read on variant B, and why is it not a measure of whether
   the recipe was extracted correctly?
2. Strip the backtick-fence from variant B's outputs. How many of the twenty now match the reference
   object exactly, and how many matched the raw string before?
3. Of the 20 items, how many does the schema check pass on variant B, and how many of those objects
   are actually wrong?

[Simulation: code-checks](../../simulations/code-checks/index.html?preset=schema)

1. **Open the regex view and make the pattern fail on purpose.** Go to the same lab with the `regex`
   preset, or just switch Metric to Regex. Type `^\s*[a-z]`. Every variant reads 0.0% (0.0%–16.1%).
   Now delete the `[` so the pattern will not compile, and read the banner the page puts above the
   tiles. Write down why a check that cannot compile is more dangerous than one that returns false.
2. **Un-anchor the default pattern.** Change `^\s*[\{\[]` to `\{` and run it on all three systems. It
   reads 100.0% everywhere, including the system that emits invalid JSON on four items. That is a
   regex that cannot fail, and lesson [3.1](lesson-01.md) already explained what that looks like on a
   dashboard.
3. **Count the fence yourself.** Switch Metric to Exact match, variant B, and read **20.0%
   (8.1%–41.6%)**. Open four of the failing items and read the `Output:` line at the bottom. Every one
   begins with a code fence. Then switch to JSON parses on the same variant and watch it become
   100.0%. You have just moved eleven items from fail to pass without changing a single output, and
   the only honest description of what you did is "I decided the fence is not a defect".
4. **Read every recovery count.** Run the console snippet above and check your prediction 3 against the
   row for variant B. Then run it for variant C. The 5 `first-object` recoveries on C are items where
   the model wrote a sentence of chat around the object — that is a prompt bug the schema check cannot
   see and the recovery count quantifies exactly.
5. **Find the item the schema cannot see.** Switch to JSON matches the schema, variant B, and note
   the 100.0%. Five of those twenty objects are wrong. Open `r02 Tomato soup` and compare its
   `ingredients` and `steps` with the reference by eye. Legal shape, wrong content — and no code check
   at this level will ever tell you.

## Break it

Two ways, and the second one is the dangerous one.

The obvious one is the pattern. Delete a bracket, or type `^\s*[a-z]`, and the scoreboard goes to
**0.0% (0.0%–16.1%)** on every system. A typo in your own check is now indistinguishable from a total
system failure, and a release gate wired to this number will block every build for a reason that has
nothing to do with the build.

The dangerous one is to switch to **variant B** with Metric on **JSON matches the schema**. The page
reports **100.0% (83.9%–100.0%)**. Four words on the panel say "Every recipe passes this check." Five
of those twenty objects are wrong — `r02`, `r08`, `r12`, `r13`, `r20` differ from the reference — and
the check reports a clean sheet. The lie: **a schema check is being read as a correctness check.** It
is a legality check. It answers "could the downstream code read this?", not "is this the right
answer?", and the difference between those two questions is the entire gap between 100% and 75.0%
(53.1%–88.8%) on the same twenty items.

## Fix it

1. **Run the two layers separately and let each failure name itself.** Parse first, then schema. The
   four items in variant C report a parser error with a character position; everything that parses but
   is wrong reports a `$.path` and a rule. One number can never carry both, and the parse-then-schema
   order is what turns "JSON is invalid" into a bug somebody can fix.
2. **Decide the fence policy and put it in the criterion, not in the parser.** If the importer cannot
   survive a fence, say so and fail it — variant B is then **4/20 (20.0%, 8.1%–41.6%)** and variant A
   is the fix, at 100.0%. If the importer can survive a fence, the fence is not a failure, and the
   number to report is the one after parsing: variant B at **15/20 (75.0%, 53.1%–88.8%)**. The
   current suite reports 4/20 and its author believes 20/20; both come from the same twenty strings.
3. **Report the recovery counts as their own number.** 9 exact / 8 fenced / 3 first-object on variant
   B and 11 / 0 / 5 / 4-failed on variant C is a prompt defect with a size attached: "the model wraps
   its answer in a code fence on 8 of 20 items" is fixable in one line of the prompt. "The JSON check
   is at 80%" is not.

## How do I know it works?

**Challenge, on dev.** Variant C, twenty items, two targets:

- **Every failure names something.** If a failing item says only "invalid", the check is not finished.
  The four parse failures here all carry `Expected ',' or ']' after array element` and a character
  position; that is the bar, and it is why the schema validator reports a path and a rule rather than
  a boolean.
- **The pair of layers catches at least 4 of the 14 real failures on variant C.** Parse-then-schema
  catches exactly 4, all of them format bugs. That is enough to keep it in the suite and not enough to
  gate a release on by itself, which is the correct place for it.

**Validation, once.** Switch the system from variant C to variant B and rerun both layers.
Prediction before you look: JSON parses reads 100.0% (83.9%–100.0%) — same as dev — while the raw
exact-match check reads 20.0% (8.1%–41.6%) and the truth is 75.0% (53.1%–88.8%). If your dev-tuned
schema check reads 100% on variant B, you have learned the thing this validation exists to teach:
the check holds across a system whose failures are a different kind, and it still cannot see
content. A check that only worked on the shape it was tuned on has not been validated.

## Use / don't use

**Use regex for** small, fixed, surface facts, and keep the patterns anchored and few. One pattern per
failure category, each with a comment naming the category. Anchoring is not optional; `\{` without
`^` is a check that cannot fail.

**Use a schema for** the contract between your system and the code that consumes it. That is what it is
for: if a downstream service is going to read `$.ingredients[0].unit`, the schema is the place that
promise is written down and enforced, in CI, for free. Keep the schema small enough that you can read
the whole thing. The lab's subset — type, required, additionalProperties, items, enum, bounds, minItems,
pattern — is roughly the right size for most eval suites, and a keyword the validator ignores is a
guarantee you do not have.

**Don't use either for** content. On this dataset both run at 100.0% on variant B while a fifth of the
objects are wrong. And don't use them where a definition of good is contested: a regex cannot decide
whether a recipe is a good idea for a dinner party, and a schema that pretends to will pass every time.

In production, both are free and belong in the pull request. The cost you should actually watch is
maintenance: a schema is a promise, so changing it is an API change, and a regex that quietly stops
matching after a model update is a silent regression in your eval suite. Pin the model version
alongside the check, or you will spend a week debugging the evaluator.

## Reflect

1. Your parse-then-schema check reads 100.0% on a system whose objects are correct on 15 of 20. Write
   the one sentence you would put at the top of that check's documentation so the next reader does not
   have to ask.
2. The lenient parser recovers variant B's eight fenced outputs and turns an 8-item failure into an
   8-item pass. List the things you would need to know before deciding the fence is not a defect.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- [JSON Schema — Understanding JSON Schema: object](https://json-schema.org/understanding-json-schema/reference/object) —
  `required`, `additionalProperties` and the error paths in the lab's validator.
- [JSON Schema — Validation specification](https://json-schema.org/draft/2020-12/json-schema-validation) —
  `minimum`/`maximum`, `minItems`, `enum` and `pattern`, and why a validator that ignores a keyword is
  worse than one that rejects the schema.
- [MDN — Regular expression syntax cheat sheet](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Cheatsheet) —
  the anchors and quantifiers a shape check needs, and the constructs that make patterns unreadable
  enough that nobody dares change them.