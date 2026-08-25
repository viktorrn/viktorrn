# Conversation handoff commands

## `/handoff [-g] [focus…]`

Summarize the active conversation branch and save a timestamped Markdown handoff. An optional plain-language focus instruction targets the summary to a topic, decision, task, or unresolved issue.

- Without options, saves to `<current-project>/.temp/`.
- `-g` or `--global` saves to `~/.pi/agent/.temp/`; it may appear before or after the focus text.
- The target directory is created when necessary.
- The summary includes goals, completed work, important files, decisions, verification, current state, and next steps.
- Focus guides the summarizer; it does not mechanically filter the transcript. Essential surrounding context may be included, and absent or partially covered topics are called out.

Examples:

```text
/handoff
/handoff -g
/handoff Focus on unresolved deployment issues.
/handoff -g Summarize only the authentication decisions and next steps.
```

## `/handoff-load [-g] [filename]`

Loads a saved handoff into the current Pi session as historical context.

- Without a filename, loads the newest handoff in the selected directory.
- Without `-g`, reads from `<current-project>/.temp/`.
- `-g` or `--global` reads from `~/.pi/agent/.temp/`.
- A filename must be a `pi-handoff-*.md` file in the selected directory; paths outside that directory are rejected.
- Loaded handoffs must be verified against the actual working tree before acting on them.

Examples:

```text
/handoff-load
/handoff-load -g
/handoff-load pi-handoff-2026-02-12T14-35-22-123Z-abc123.md
/handoff-load -g pi-handoff-2026-02-12T14-35-22-123Z-abc123.md
```
