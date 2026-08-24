---
name: pipeline-authoring
description: Helps agents discover, validate, connect, and create Pipeline types, connectors, modules, and decorators through the pipeline author CLI.
---

# Pipeline authoring

Use the authoring CLI before guessing Pipeline resources.

## Running the CLI

From a project with the `pipeline` command installed, run:

`pipeline author <command> --json`

When working inside the Pipeline repository and the command is not installed, use:

`node bin/pipeline.mjs author <command> --json`

Run commands from the user project root, or pass `--project-root <path>` explicitly.

## Workflow

1. Inspect the complete validated workspace:
   `pipeline author inspect --json`
2. Search existing resources before creating anything:
   `pipeline author search "summarize" --kind module --json`
3. Fetch complete contracts:
   `pipeline author get modules --json`
   `pipeline author get type text --json`
   `pipeline author get types --json`
4. Find valid downstream stages:
   `pipeline author compatible text --json`
5. Validate a proposed pipeline separately before running it:
   `pipeline author validate --source 'write-plan --prompt hello | review' --json`
6. Create a project-scoped resource only when no suitable resource exists:
   `pipeline author create module ./definition.json --json`
7. Re-inspect after creation and report the created paths and diagnostics.

## Type lookup

The complete type catalog includes system, project, and module-inline types. An unqualified ID is valid only when it resolves uniquely. For ambiguity, use the qualified reference returned by the catalog, such as `module:review#inputs[0]` or `project:text`.

Never silently choose between conflicting definitions. Module-inline types are associated with their declaring module and are not automatically reusable project types.

## Safety rules

- Prefer existing definitions over creating duplicates.
- Do not guess contracts, connector routes, required arguments, or type IDs.
- Treat project modules and decorators as executable TypeScript.
- Do not overwrite resources without explicit user approval and `--overwrite`.
- Do not execute a newly created resource automatically.
- Use `--json` when interpreting command results programmatically.
- Show diagnostics to the user instead of hiding invalid catalog entries.
