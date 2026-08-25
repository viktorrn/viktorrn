# Command catalog commands

Press Tab while editing a `/commands` invocation to choose or cycle its `--…` options. Options that take an extension name (`--extension`, `--check`, `--revalidate`, `--exclude`, and `--include`) offer discovered extension names after the option.

## `/commands [filter]`

Show the command catalog for global Pi extensions. In the interactive TUI, it opens a paged multi-column picker containing each unique command once; arrow keys navigate, Enter prefills the selected command in the editor, and Escape closes the picker. An optional filter searches command names, syntax, descriptions, and extension names.

- **Arguments:** Optional text filter
- **Writes files:** No
- **Examples:**

  ```text
  /commands
  /commands fusion
  ```

## `/commands --extension <extension>`

Show the command reference for one extension.

- **Arguments:** Extension name
- **Writes files:** No
- **Examples:**

  ```text
  /commands --extension fusion-harness
  ```

## `/commands --status`

Show cached command-documentation validation status for discovered extensions.

- **Arguments:** None
- **Writes files:** No

## `/commands --check [extension]`

Validate unknown or changed extensions. An optional extension name limits the audit.

- **Arguments:** Optional extension name
- **Writes files:** Yes; updates the global validation registry
- **Examples:**

  ```text
  /commands --check
  /commands --check fusion-harness
  ```

## `/commands --check-all`

Validate every discovered extension, including extensions that previously passed.

- **Arguments:** None
- **Writes files:** Yes; updates the global validation registry

## `/commands --revalidate <extension>`

Force a fresh validation of one extension, regardless of its cached status.

- **Arguments:** Extension name
- **Writes files:** Yes; updates the global validation registry
- **Examples:**

  ```text
  /commands --revalidate fusion-harness
  ```

## `/commands --exclude <extension> <reason>`

Exclude an extension from normal validation. The reason is retained in the registry.

- **Arguments:** Extension name and reason
- **Writes files:** Yes
- **Examples:**

  ```text
  /commands --exclude dynamic-extension "Commands are generated at runtime"
  ```

## `/commands --include <extension>`

Remove an extension exclusion and mark it for validation again.

- **Arguments:** Extension name
- **Writes files:** Yes

## `/commands --clear-cache`

Clear all cached validation results.

- **Arguments:** None
- **Writes files:** Yes; removes cached registry entries
