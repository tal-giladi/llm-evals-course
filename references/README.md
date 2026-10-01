# Readings

What this course is built on, and what to read when you want the primary source rather than the
working version. Everything here is free to read.

## Start here

- [Hamel Husain — Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) and
  [Evals](https://hamel.dev/blog/posts/evals/). The method this course teaches: error analysis first,
  binary judges, validate the validator. The best short thing written on the subject.
- [Shreya Shankar & Hamel Husain — AI Evals for Engineers and PMs](https://maven.com/parlance-labs/evals)
  (Maven, paid, cohort-based). The same method with more depth. The course is deliberately independent of
  it; nothing here is required reading.
- [Eugene Yan — Evaluating the Effectiveness of LLM-Evaluators](https://eugeneyan.com/writing/llm-evaluators/)
  and [Evals](https://eugeneyan.com/writing/evals/). The best synthesis of judge research, including why
  the measures in modules 6 and 7 are the ones they are.

## Judges and their failure modes

- [Zheng et al. — Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)
  (arXiv:2306.05685). The source of position bias, verbosity bias and self-enhancement bias — all three
  probes in module 7 come from this paper's findings.
- [LLM Evaluators Recognize and Favor Their Own Generations](https://arxiv.org/abs/2404.13076) — self-preference, measured.
- [LLM-as-a-Judge: A Survey](https://arxiv.org/abs/2411.15594) (arXiv:2411.15594). Broad survey; useful for
  the taxonomy of judge designs.
- [EvalGen — Who Validates the Validators?](https://arxiv.org/abs/2404.12272) (arXiv:2404.12272). Criteria
  drift: what happens to an eval set when the standards move.
- [Align Evals: Prompt-based judge calibration](https://www.langchain.com/blog/introducing-align-evals) —
  the commercial version of this course's judge lab, and a good picture of the workflow.

## Statistics without a maths background

- [The Bootstrap: Another Look at the Jackknife](https://projecteuclid.org/journals/annals-of-statistics/volume-07/issue-06/The-Bootstrap-Another-Look-at-the-Jackknife/10.1214/aos/1176345332.full)
  (Efron, 1979). The original paper. Harder than it needs to be; read it if you want the real thing.
- Brown, Cai & DasGupta — [Interval estimation for a binomial proportion](https://doi.org/10.1214/ss/1009213286)
  (Statistical Science, 2001). The paper that explains why the Wilson interval is used throughout this
  course instead of the normal approximation.
- [Wikipedia — Cohen's kappa](https://en.wikipedia.org/wiki/Cohen%27s_kappa). A reasonable plain-language
  treatment, including the critique that kappa depends on prevalence.

## Official guidance

- [Anthropic — Define success criteria and build evaluations](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests)
- [OpenAI Cookbook — Getting started with evals](https://developers.openai.com/cookbook/examples/evaluation/getting_started_with_openai_evals)
  and [logprobs for evaluation](https://developers.openai.com/cookbook/examples/using_logprobs) — the latter
  is where the probability-weighted threshold in lesson 6.4 comes from.

## Tools worth knowing about

- [promptfoo](https://github.com/promptfoo/promptfoo) (MIT), [Inspect AI](https://inspect.aisi.org.uk/) (MIT),
  [DeepEval](https://github.com/confident-ai/deepeval) (Apache-2.0). All three map onto the same concepts;
  the production path in this course uses plain pytest instead so the mechanisms stay visible.
- [RAGAS](https://github.com/explodinggradients/ragas) (Apache-2.0). RAG metrics, and module 8 is largely
  about which of them survive validation against human labels.
- [ChainForge](https://chainforge.ai/play/) (MIT) and [Potato judge calibration](https://potatoannotator.readthedocs.io/en/latest/ai-intelligence/judge_calibration/) — the closest existing things to this course's judge lab. Both are worth trying next to the course.

## Datasets this course's method is shaped by

- [MT-Bench human judgments](https://huggingface.co/datasets/lmsys/mt_bench_human_judgments) (CC-BY-4.0) — expert pairwise judgements.
- [HelpSteer2](https://huggingface.co/datasets/nvidia/HelpSteer2) (CC-BY-4.0) — multi-attribute human ratings.
- [JudgeBench](https://huggingface.co/datasets/ScalerLab/JudgeBench) (MIT) — where judges fail on correctness rather than style.

The datasets shipped with this course are generated and original; see
[the licences note](../COURSE-MAP.md). These are listed because they are what the method was tested on,
not because they are included.