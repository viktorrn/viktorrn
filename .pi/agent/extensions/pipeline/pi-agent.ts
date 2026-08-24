import { createAgentSession, SessionManager, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolvePiModel, type PiSettings } from "./pi-model.ts";
import { addUsage, emptyUsage, usageFrom, type PiUsage } from "./pi-usage.ts";

const TOOL_NAMES = ["read", "grep", "find", "ls", "edit", "write", "bash"] as const;
type AgentToolName = typeof TOOL_NAMES[number];

export interface PiAgentRequest { prompt: string; workingDirectory: string; excludedTools: readonly string[]; model?: string }

export async function runPiCodingAgent(ctx: ExtensionContext, request: PiAgentRequest, settings: PiSettings, lifecycle?: { onStart(agent: { abort(): Promise<void> }): void; onSettled(agent: { abort(): Promise<void> }): void }): Promise<{ text: string; usage?: PiUsage }> {
  const model = resolvePiModel(ctx, request.model, settings);
  if (request.excludedTools.some((tool): tool is string => !TOOL_NAMES.includes(tool as AgentToolName)) || new Set(request.excludedTools).size !== request.excludedTools.length) throw new Error("The coding-agent request contains invalid excluded tools.");
  const tools = TOOL_NAMES.filter((tool) => !request.excludedTools.includes(tool));
  const { session } = await createAgentSession({
    cwd: request.workingDirectory,
    model,
    tools: [...tools],
    sessionManager: SessionManager.inMemory(request.workingDirectory),
  });
  lifecycle?.onStart(session);
  try {
    await session.prompt(request.prompt);
    if (session.agent.state.errorMessage) throw new Error(session.agent.state.errorMessage);
    const usage = emptyUsage();
    let text: string | undefined;
    for (let index = session.messages.length - 1; index >= 0; index--) {
      const message = session.messages[index];
      if (message?.role !== "assistant") continue;
      addUsage(usage, usageFrom(message));
      text ??= message.content.filter((part): part is { type: "text"; text: string } => part.type === "text").map((part) => part.text).join("\n");
    }
    if (text !== undefined) return { text, usage };
    throw new Error("The Pi coding agent completed without an assistant response.");
  } finally {
    lifecycle?.onSettled(session);
    session.dispose();
  }
}
