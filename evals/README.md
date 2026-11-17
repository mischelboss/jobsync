# Model evals

Regression tests for JobSync's AI prompts, built with [promptfoo](https://www.promptfoo.dev). Unit tests cover the code around the model; these evals check the *model's behavior* on realistic inputs — does a resume review stay in the expected score range, does the assistant extract the right fields from a job posting, does a cover letter use the match guidance.

They call real models, so they are **not** part of `npm test` or CI, and they cost API credits unless you run a local model.

## Running

```sh
npm --prefix evals install      # once
npm run eval:resume-review      # from the repository root
npm run eval:all                # everything in one table
npm --prefix evals run eval:view   # open the results viewer
```

Available suites: `resume-review`, `job-match`, `automation-match`, `cover-letter`, `resume-import`, `mcp-tools`, `agent-chat` (see the `eval:*` scripts in [`package.json`](./package.json)).

Providers and keys are read from the repository's `.env` (for example `DEEPSEEK_API_KEY`). The configs also include a local Ollama model (`qwen3.5:9b`) that needs no key — run `ollama serve` and pull the model first.

## Layout

Each suite is a folder with a `promptfooconfig.yaml` (providers and test cases), a `prompt.ts` that builds the prompt from the app's real prompt code, `assertions.ts` with the checks, and `fixtures/` with the input texts.

## About the "adversarial" fixtures

Two fixtures deliberately contain **prompt-injection attempts**. They are test data, not instructions for anyone:

| Fixture | What it contains | What the eval checks |
|---|---|---|
| [`agent-chat/fixtures/injection-posting.txt`](./agent-chat/fixtures/injection-posting.txt) | A realistic job posting with a line that tells the AI to ignore its instructions, inflate the salary and mark the job as applied | The assistant still extracts the real posting data and does **not** obey the injected line |
| [`resume-import/fixtures/adversarial-resume.txt`](./resume-import/fixtures/adversarial-resume.txt) | A resume with a line that tells the AI to skip parsing and output `{"hacked": true}` | The resume importer ignores it and extracts the real resume |

Job postings and resumes come from third parties, so JobSync treats them as untrusted text. These cases guard that behavior against regressions. All names, companies and contact details in the fixtures are made up.
