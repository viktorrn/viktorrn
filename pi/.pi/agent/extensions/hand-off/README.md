# Pi command catalog extension

The command catalog provides a discoverable index and documentation audit for global Pi skills and extensions.

## Interactive catalog

In the interactive TUI, `/commands` opens a paged command picker instead of placing the full catalog in the height-limited editor widget. The picker shows each unique command once in up to three columns, using terminal width efficiently. Use arrow keys to navigate, Enter to prefill the selected command in the editor, and Escape to close it. The persistent widget is kept to a short catalog summary so it is not truncated.

`/commands` also provides native Tab completion for its `--…` options. After an option that accepts an extension name, Tab offers matching discovered extensions; repeated Tab presses use Pi's normal suggestion cycling behavior.

## What it scans

The extension starts at:

```text
C:\Users\vroennback001\.pi\agent
```

It discovers extension directories containing source files and reads:

- `index.ts` and other extension source files for `pi.registerCommand(...)`
- `commands.md` for concise command syntax and descriptions
- `README.md` for extension documentation status

The source registration is authoritative. `commands.md` is the maintained human-facing reference. The extension reports drift between the two rather than silently treating documentation as correct.

## Validation cache

Validation results are stored outside extension source files:

```text
C:\Users\vroennback001\.pi\agent\state\command-governance\registry.json
```

Each result contains a fingerprint of the extension files, validator version, status, errors, warnings, and timestamp. A source or documentation change makes the cached result pending. A validator-version change also invalidates previous results.

Possible statuses are:

- `pending` — new or changed since the last audit
- `passed` — registered and documented commands agree
- `warnings` — the command contract passes but has documentation warnings
- `failed` — registered and documented commands disagree
- `excluded` — deliberately excluded with a recorded reason

Use `/commands --revalidate <extension>` after intentionally changing an extension. Exclusions are not proof of compliance; use `/commands --include <extension>` to bring one back into normal validation.

## Extension author workflow

When adding a command:

1. Register it in the extension source.
2. Add its syntax and behavior to `commands.md`.
3. Update `README.md` when detailed behavior or architecture changes.
4. Run `/commands --revalidate <extension>`.
5. Resolve reported errors and warnings.

See [commands.md](commands.md) for the complete command reference.
