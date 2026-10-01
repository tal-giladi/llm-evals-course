# BUILD_PROGRESS — Eval Lab: LLM Evals & Observability by Experiment

Working file. Not imported into the Academy.

## Goal

Build the full course described in `plan.md` — Modules 1–15 plus the capstone — import-ready
per `tals-academy/docs/new-course-instructions.md` (binding).

**COMPLETE.** 15 modules · 64 lessons · 64 lesson quizzes · 15 module quizzes · 9 simulations ·
4 lab folders · 1 capstone. The Academy dry-run import check reports **`0 problems`**:
17 modules, 64 lessons, 79 quiz files, 444 questions.

## Decisions taken with Tal (2026-10-01)

| Question | Decision |
|---|---|
| Name | `Eval Lab: LLM Evals & Observability by Experiment` |
| Judge data | **Ship the seeded educational model.** No real recordings; every lab and lesson says so, and every statistic is computed for real from those verdicts |
| Production path | Built in full: M11 Python, M12 tracing, M13 CI, M14 online, M15 optional |
| Tracing UI (plan §12.6) | MLflow Tracing — Apache-2.0, no Docker. JSONL is the default; MLflow is the optional path |
| Eval framework (plan §12.7) | Plain pytest, with a framework shown alongside |
| Python package (plan §12.8) | `labs/common/evallab`, vendored into each module zip |
| Live model | Optional everywhere. **No lesson requires an API key or a model download** |
| Capstone | The learner's own feature; the eval design review is the deliverable |

## Units

- [x] Repo spine, `.gitignore`/`.gitattributes` (LF), status logs
- [x] Lab kit: `simulations/common/stats.js` and `codemetrics.js`
- [x] Lab kit: accessible UI kit (`ui.js`, `sim.css`) and the 9 simulations
- [x] Dataset pipeline (`build/generate.mjs`, `build/lib/`) and the JSON twin for Python
- [x] Modules 1–10 — the browser-only fundamentals path
- [x] `evallab` Python package: parity-tested port, gate, tracing, online
- [x] Modules 11–15 — the production path
- [x] Four lab folders, each with a starter that fails on its named TODO and a solution that passes
- [x] The capstone brief
- [x] Shared docs: README, COURSE-MAP, glossary, templates, references, TODO_FOR_TAL
- [x] `curriculum/module-plans-11-15.md` and `curriculum/AGENT-BRIEF.md`

## Commands

```
node build/generate.mjs        # rebuild every dataset from build/lib/*
node build/verify.mjs          # the data supports the claims the lessons make
node build/parity-fixtures.mjs # regenerate the JavaScript-vs-Python fixtures
node build/fix-quiz-yaml.mjs   # repair quiz YAML the importer would drop
node build/check-lessons.mjs   # 64 lessons: format, links, presets, quiz rules
node build/smoke.mjs           # 9 simulations in a real browser
py -m pytest -q                # 186 Python tests
```

All five checks pass. The lab **starters** are meant to fail — 64 tests fail there, each on its
named TODO. That is the exercise, not a broken build.

The authority on importability is the Academy's own checker:

```
cd C:/Users/TalGiladi/OneDrive/repos/tals-academy
npm run check-course -- ../course-creator/llm-evals-course
```

## Open questions

None blocking. `TODO_FOR_TAL.md` records the known simplifications and the deliberate sharp edges
left in the labs on purpose, and the decisions a later revision might revisit.
