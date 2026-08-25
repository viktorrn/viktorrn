/**
 * Pi plan-mode extension
 *
 * @version 1.1.0
 * @lastUpdated 2026-02-12
 * @platform windows
 * @mode read-only
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const VERSION = "1.1.0";
const LAST_UPDATED = "2026-02-12";

const READ_ONLY_TOOLS = new Set(["read", "grep", "find", "ls"]);
const EXECUTING_OR_MUTATING_TOOLS = new Set(["bash", "write", "edit"]);

const normalizeCommandArgument = (args: string): string => {
  const value = args.trim();
  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
  return value.length >= 2 && (isDoubleQuoted || isSingleQuoted)
    ? value.slice(1, -1)
    : value;
};

type Mode = "normal" | "plan" | "act";

const updateModeWidget = (ctx: ExtensionContext, mode: Mode): void => {
  if (!ctx.hasUI) return;

  ctx.ui.setWidget("plan-mode", (_tui, theme) => {
    const text = mode === "plan"
      ? `${theme.fg("warning", theme.bold(" ◈ PLAN MODE "))} ${theme.fg("muted", "Read-only planning · /act to implement")}`
      : mode === "act"
        ? `${theme.fg("success", theme.bold(" ▶ ACT MODE "))} ${theme.fg("muted", "Implementing a preceding plan · /plan to plan")}`
        : `${theme.fg("accent", theme.bold(" ● NORMAL MODE "))} ${theme.fg("muted", "Normal tool access · /plan to plan")}`;
    return new Text(text, 0, 0);
  });
};

export default function (pi: ExtensionAPI) {
  let mode: Mode = "normal";

  pi.registerCommand("plan", {
    description: `Toggle read-only planning mode or start planning with a prompt (v${VERSION})`,
    handler: async (args, ctx) => {
      const rawArgument = args.trim();
      const value = rawArgument.toLowerCase();
      const planningPrompt = normalizeCommandArgument(rawArgument);
      const hasPlanningPrompt = !["on", "off", "status"].includes(value) && Boolean(planningPrompt);

      if (value === "on") {
        mode = "plan";
      } else if (value === "off") {
        mode = "normal";
      } else if (value === "status") {
        updateModeWidget(ctx, mode);
        ctx.ui.notify(
          mode === "plan"
            ? `Plan mode is enabled (v${VERSION}, updated ${LAST_UPDATED}).`
            : mode === "act"
              ? `Act mode is enabled (v${VERSION}, updated ${LAST_UPDATED}).`
              : `Normal mode is enabled (v${VERSION}, updated ${LAST_UPDATED}).`,
          "info",
        );
        return;
      } else if (hasPlanningPrompt) {
        mode = "plan";
      } else {
        mode = mode === "plan" ? "normal" : "plan";
      }

      updateModeWidget(ctx, mode);
      ctx.ui.notify(
        mode === "plan"
          ? hasPlanningPrompt
            ? `Plan mode enabled (v${VERSION}). Starting planning prompt.`
            : `Plan mode enabled (v${VERSION}). Only read-only inspection is allowed.`
          : `Normal mode enabled (v${VERSION}). Normal tool access restored.`,
        mode === "plan" ? "info" : "warning",
      );

      if (hasPlanningPrompt) {
        await ctx.waitForIdle();
        pi.sendUserMessage(planningPrompt);
      }
    },
  });

  pi.registerCommand("act", {
    description: `Exit plan mode and implement the preceding plan (v${VERSION})`,
    handler: async (args, ctx) => {
      mode = "act";
      updateModeWidget(ctx, mode);

      const additionalPrompt = normalizeCommandArgument(args);
      const implementationPrompt = [
        "Act mode is now active. Implement the plan and underlying task described in the immediately preceding conversation.",
        "Use the preceding conversation as the source of truth, inspect the working tree as needed, make the requested changes, and run relevant verification.",
        ...(additionalPrompt ? [`Additional instructions: ${additionalPrompt}`] : []),
      ].join("\n\n");

      ctx.ui.notify(
        additionalPrompt
          ? `Act mode enabled (v${VERSION}). Starting implementation with additional instructions.`
          : `Act mode enabled (v${VERSION}). Starting implementation.`,
        "info",
      );
      await ctx.waitForIdle();
      pi.sendUserMessage(implementationPrompt);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    updateModeWidget(ctx, mode);
  });

  pi.on("before_agent_start", async (event) => {
    if (mode !== "plan") return;

    return {
      systemPrompt: `${event.systemPrompt}

PLANNING MODE IS ACTIVE (plan-mode v${VERSION}).

You are working in a Windows development environment.

Only inspect the repository and produce a plan. Do not:
- modify files
- execute shell commands
- run tests
- install packages
- start development servers
- generate files
- apply patches

Only use these read-only tools:
- read
- grep
- find
- ls

The grep tool may use ripgrep internally. Do not invoke ripgrep through bash.

If the user asks you to make a change, explain what should be changed and where, but do not perform it.

Produce plans with:
1. Summary
2. Files and code areas likely affected
3. Ordered implementation steps
4. Testing plan
5. Risks and open questions
`,
    };
  });

  pi.on("tool_call", async (event) => {
    if (mode !== "plan") return;

    if (EXECUTING_OR_MUTATING_TOOLS.has(event.toolName)) {
      return {
        block: true,
        reason:
          "Plan mode is active. Shell execution and file modifications are disabled.",
      };
    }

    if (!READ_ONLY_TOOLS.has(event.toolName)) {
      return {
        block: true,
        reason:
          "Plan mode only permits read-only repository inspection tools.",
      };
    }
  });

  pi.on("user_bash", async (_event, _ctx) => {
    if (mode !== "plan") return;

    return {
      result: {
        output:
          "Blocked: plan mode does not allow manually executed shell commands.",
        exitCode: 1,
        cancelled: false,
        truncated: false,
      },
    };
  });
}
