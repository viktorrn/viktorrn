import { complete, type UserMessage } from "@earendil-works/pi-ai/compat";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolvePiModel, type PiSettings } from "./pi-model.ts";
import { usageFrom, type PiUsage } from "./pi-usage.ts";

export interface PiLlmRequest { prompt: string; systemPrompt?: string; model?: string }

export async function completeWithPiModel(ctx: ExtensionContext, request: PiLlmRequest, settings: PiSettings): Promise<{ text: string; usage?: PiUsage }> {
  const model = resolvePiModel(ctx, request.model, settings);
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) throw new Error(auth.ok ? `No API key is configured for ${model.provider}.` : auth.error);
  const message: UserMessage = { role: "user", content: [{ type: "text", text: request.prompt }], timestamp: Date.now() };
  const response = await complete(model, { ...(request.systemPrompt === undefined ? {} : { systemPrompt: request.systemPrompt }), messages: [message] }, { apiKey: auth.apiKey, headers: auth.headers, env: auth.env });
  if (response.stopReason === "aborted") throw new Error("Pi model completion was aborted.");
  return { text: response.content.filter((part): part is { type: "text"; text: string } => part.type === "text").map((part) => part.text).join("\n"), usage: usageFrom(response) };
}
