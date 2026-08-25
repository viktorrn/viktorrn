# Plan mode extension

The Plan Mode extension provides a real tool-level read-only mode for Pi. It is different from a prompt-only planning request: while enabled, the extension blocks mutating and executing tools.

## Commands

Use `/plan` to toggle the mode, `/plan <prompt>` to enable planning and immediately begin with a prompt, or `/act` to leave planning mode and immediately begin implementing the preceding plan:

```text
/plan on
/plan off
/plan status
/plan
/plan Explain the main architecture.
/plan "Trace the login flow"
/act
/act Also add unit tests and update the README.
```

`/plan <prompt>` switches to plan mode before it starts a new agent turn. The supplied prompt becomes the first user prompt in plan mode, so the read-only system instructions and tool restrictions apply to it. `/act` switches from plan mode to act mode before it starts a new agent turn. That turn instructs the agent to use the immediately preceding conversation—especially the plan and its underlying task—as its source of truth, plus any optional additional instructions. The mode is held in memory for the current extension runtime. It starts in normal mode after Pi restarts or extension reloads; act mode appears only after `/act` is run.

## Mode indicator

A compact widget above the editor always shows the current mode:

- **NORMAL MODE** — default mode with normal tool access and a reminder to use `/plan`
- **PLAN MODE** — read-only planning, with a reminder to use `/act` to implement
- **ACT MODE** — normal tool access after `/act`, with a reminder to use `/plan` to plan

## Enforcement

When plan mode is active, the extension:

- Appends planning instructions to the agent system prompt
- Blocks `bash`, `write`, and `edit`
- Blocks any tool not explicitly listed as read-only
- Blocks manually entered user shell commands
- Allows only `read`, `grep`, `find`, and `ls`

The agent is instructed to produce plans with:

1. Summary
2. Files and code areas likely affected
3. Ordered implementation steps
4. Testing plan
5. Risks and open questions

## Files

- `index.ts` — extension implementation
- `commands.md` — concise command reference
- `README.md` — detailed behavior and limitations

The original implementation was moved from the root-level `extensions/plan-mode.ts` without changing its runtime logic.
