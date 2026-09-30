# BUILD_PROGRESS — Eval Lab: LLM Evals & Observability by Experiment

Working file. Not imported into the Academy.

## Goal

Build the **fundamentals path (Modules 1–10, 43 lessons)** of the course described in
`plan.md`, import-ready per `tals-academy/docs/new-course-instructions.md` (binding), so that
`npm run check-course` reports `0 problems`.

Modules 11–15 (production path: Python, Docker, tracing UI, CI, online monitoring) are
**deferred** — see `TODO_FOR_TAL.md`.

## Decisions taken (2026-10-01, with Tal)

| # | Decision |
|---|---|
| Name | `Eval Lab: LLM Evals & Observability by Experiment` (plan §12.1) |
| Data | Seeded **educational model** generates the judge-run records; every simulation is labelled "educational model". Real recordings replace the data files later without touching the engine. |
| Scope of this pass | Modules 1–10 (browser-only fundamentals path) |
| Production path | M11–M15 deferred; plan §12.6/§12.7/§12.8 still open |
| Tiers | Tier A embedded simulations for every lesson. Tier B standalone playground (live WebLLM/Ollama judges) deferred with M11+. |

## Units

- [x] Repo spine (`BUILD_PROGRESS.md`, `curriculum/`, `.gitignore`, status logs)
- [ ] Lab kit — statistics engine (`simulations/common/stats.js`)
- [ ] Lab kit — code evaluators (`simulations/common/codemetrics.js`)
- [ ] Lab kit — shared UI + trace viewer (`simulations/common/ui.js`, `sim.css`)
- [ ] Build pipeline (`build/`) + `datasets/`
- [ ] Simulation `judge-lab` (M5, M6, M7) — reference implementation
- [ ] Simulation `tour` (M1)
- [ ] Simulation `error-analysis` (M2)
- [ ] Simulation `code-checks` (M3)
- [ ] Simulation `eval-set` (M4)
- [ ] Simulation `rag-evals` (M8)
- [ ] Simulation `agent-evals` (M9)
- [ ] Simulation `ab-gates` (M10)
- [ ] Simulation `device-check` (setup)
- [ ] Shared docs: `README.md`, `_sidebar.md`, `glossary.md`, `templates/`, `references/`, `COURSE-MAP.md`, `TODO_FOR_TAL.md`
- [ ] Module 1 — Why evals (4 lessons)
- [ ] Module 2 — Error analysis (4)
- [ ] Module 3 — Code-based checks (4)
- [ ] Module 4 — Building the eval set (4)
- [ ] Module 5 — Designing an LLM judge (5)
- [ ] Module 6 — Validating the judge (5)
- [ ] Module 7 — Judge biases, models and cost (5)
- [ ] Module 8 — Evaluating RAG answers (4)
- [ ] Module 9 — Evaluating agents and conversations (4)
- [ ] Module 10 — Comparing systems and release gates (4)
- [ ] Module quizzes M1–M10 (`assessments/`)
- [ ] Capstone brief (`projects/`)
- [ ] Final QA — `npm run check-course` → `0 problems`

## Who is working on what right now

*(main session = the orchestrator; one sub-agent max, per instructions §9)*

- main session: lab kit → data pipeline → `judge-lab` → shared docs.
- sub-agent: idle.

## Resume procedure

1. `git status` — see what is uncommitted.
2. Read this file.
3. Read `curriculum/status/module-NN.log` for each module; skip `lesson-MM done` entries.
4. Check `_sidebar.md` for which lessons exist.
5. Continue the first unchecked unit above.

## Rules being followed

- Instructions file is binding; `plan.md` loses to it on any conflict.
- One lesson at a time to completion: `lesson-MM.md` **and** `lesson-MM.quiz.yaml`.
- After each lesson append `lesson-MM done` to `curriculum/status/module-NN.log`; after the module, `module done`.
- Commit to git after every finished module.
- Never more than two writing agents. Agents never touch `_sidebar.md`, `glossary.md`, `README.md`, `simulations/`, `datasets/`, `templates/` — shared files are the main session's job.

## Open questions

- Plan §12.6 (tracing UI), §12.7 (eval framework), §12.8 (Python package) — deferred with M11–M15.
- Plan §12.5 (who labels our datasets) — our educational-model labels are synthetic; real labelling pass is Tal's call.
- Plan §12.9 (Hebrew judging set) — not in this pass.
- Plan §12.2/§12.3 (shared lab kit with rag-course, Academy network access) — this pass vendors a standalone copy into `simulations/common/`; sharing is not decided.
