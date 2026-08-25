# Plan mode commands

## `/plan [on|off|status|planning prompt…]`

Toggle the extension's read-only planning mode, explicitly enable or disable it, display its current status, or enable plan mode and immediately start a planning prompt.

- **Arguments:** Optional `on`, `off`, or `status`; any other argument is treated as the first planning prompt; no argument toggles the current state
- **Writes files:** No
- **Blocks while enabled:** `bash`, `write`, `edit`, manual user shell commands, and any other tool not in the read-only allowlist
- **Allowed tools while enabled:** `read`, `grep`, `find`, `ls`
- **Prompt behavior:** `/plan <prompt>` enables plan mode, waits for the current agent turn to finish, and sends the prompt as a new user message
- **Examples:**

  ```text
  /plan on
  /plan status
  /plan off
  /plan
  /plan Explain the main architecture.
  /plan "Trace the login flow"
  ```

## `/act [additional instructions…]`

Exit plan mode and immediately start implementing the plan and task from the preceding conversation. Optional plain-language instructions are added to the implementation request.

- **Arguments:** Optional additional implementation instructions
- **Writes files:** The command itself does not write files; it starts an agent turn with normal tool access, which may implement and verify the preceding plan
- **Mode:** Always switches to act mode before the implementation turn begins
- **Examples:**

  ```text
  /act
  /act Also add unit tests and update the README.
  ```
