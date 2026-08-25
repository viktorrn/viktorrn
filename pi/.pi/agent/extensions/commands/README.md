# Conversation handoff extension

This global Pi extension provides persistent, local conversation handoffs for switching to a fresh context.

## Storage

By default, handoffs are project-scoped and saved under:

```text
<current-working-directory>/.temp/
```

Use `-g` to save to or load from the global Pi-agent location:

```text
~/.pi/agent/.temp/
```

Handoff files are timestamped Markdown documents with metadata for the source directory, Pi session, creation time, and storage scope. By default, `/handoff` creates a general engineering handoff; optional focus text instructs the summarizer to prioritize a topic, decision, task, or unresolved issue. Focus is semantic rather than a strict transcript filter, so essential surrounding context can be retained and missing coverage is reported.

## Workflow

1. Run `/handoff` before ending or compacting a work session. Add plain-language focus text when the next session needs only a specific topic, for example `/handoff Focus on the deployment rollback decisions.`
2. Start a new session in the same project.
3. Run `/handoff-load` to add the most recent saved handoff as context.
4. Verify its claims against the current working tree before taking action.

The extension notifies interactive sessions when a project-local handoff exists, but it does not auto-load it. This avoids adding stale context to unrelated work.

## Privacy and retention

Handoffs may contain source paths, implementation details, tool output, or text pasted into the conversation. Keep them local and add project `.temp/` directories to `.gitignore` when they should not be committed. The extension currently retains all handoff files; remove old files manually when no longer needed.

## Commands

See [commands.md](commands.md).
