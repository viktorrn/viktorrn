# Pi Pipeline host adapter

This global Pi extension registers `/pipeline` and adapts Pi-only capabilities to the standalone pipeline engine. It is intentionally outside the pipeline repository's `src/core` boundary.

## Setup

Run `pipeline install pi` to install this bridge and write its configuration. The installer stores the absolute standalone engine entry script path in `~/.pi/agent/pipeline.json`, for example:

```json
{
  "version": 1,
  "pipelineCli": "C:/Users/vroennback001/pipeline/bin/pipeline.mjs"
}
```

Reload Pi extensions after installation or changes:

```text
/reload
```

## Behavior

`/pipeline` accepts an inline pipeline expression or `--file <path> [--parameter <value> | --flag]`. Parameterized `.pipe` files are passed to the standalone host with their named bindings, which uses the same safe typed binding logic as standalone CLI file mode. It spawns:

```text
node <PIPELINE_CLI> --host stdio
```

with Pi's current working directory. The child process owns discovery, parsing, semantic compilation, and pipeline execution. It exchanges line-framed JSON messages with this adapter for non-streaming LLM completion and coding-agent requests.

- LLM requests use Pi's selected active model and Pi-managed credentials unless a module supplies `--model`. A supplied selector is first resolved as a top-level string alias from global `settings.json`, then as a registered `provider/model` identifier; unknown selectors fail rather than silently falling back.
- Coding-agent requests create an isolated in-memory Pi agent session in the pipeline working directory, with only the standard coding tools not excluded by the pipeline module. They use the same optional `--model` selection behavior.
- A plan-mode-style widget indicates an active pipeline run. Completion output includes aggregate Pi-reported token usage and available pricing-derived cost across LLM and coding-agent calls.
- Session shutdown kills active pipeline child processes and aborts hosted coding agents.
- The adapter does not stream intermediate model tokens/tool activity and does not calculate Git diffs or changed paths.

See `commands.md` for command syntax.