# Pipeline commands

## `/pipeline`

Runs an inline pipeline expression or a pipeline source file using the active Pi model and, when requested, an isolated Pi coding agent.

```text
/pipeline <pipeline expression>
/pipeline --file <path> [--parameter <value> | --flag]
```

Examples:

```text
/pipeline llm-complete --prompt "Summarize this repository"
/pipeline llm-complete --model architect-ai --system-prompt "Be terse." --prompt "Summarize this repository"
/pipeline prompt --text "Add parser tests" | code-agent --model builder-ai --exclude-tools bash
/pipeline --file .pipeline/pipelines/codebase-review.pipe --input "Review this repository" --output docs/codebase-review.md --overwrite
```

Run `pipeline install pi` first. It writes the absolute path of the standalone engine's `bin/pipeline.mjs` to `~/.pi/agent/pipeline.json`. The extension starts it as `node <pipelineCli> --host stdio` in Pi's current working directory. `--model` on `llm-complete` and `code-agent` accepts either a top-level string alias from Pi's global `settings.json` (such as `architect-ai` or `builder-ai`) or a registered `provider/model` identifier. An unknown explicit selector is an error; omitting it uses Pi's active model without changing that selection.

While a pipeline is running, a small widget appears above the editor. The completion notification includes aggregate Pi-reported input/output tokens and, when model pricing is available, cost. For parameterized `.pipe` files, `$name` placeholders are bound from matching command options before pipeline validation. Bare `$flag` placeholders represent presence-only flags. The command does not stream model tokens or tool activity.
