import { spawn, type ChildProcess } from "node:child_process";
import type { PiUsage } from "./pi-usage.ts";

export interface HostRunResult { ok: boolean; output?: unknown; diagnostics?: readonly { message: string }[] }
export interface PiHostHandlers {
  complete(request: { prompt: string; systemPrompt?: string; model?: string }): Promise<{ text: string; usage?: PiUsage }>;
  runAgent(request: { prompt: string; workingDirectory: string; excludedTools: readonly string[]; model?: string }): Promise<{ text: string; usage?: PiUsage }>;
  onProgress(event: unknown): void;
}

export async function runPipelineChild(input: { pipelineCli: string; cwd: string; request: { source: string } | { file: string; parameters: Readonly<Record<string, string | true>> }; handlers: PiHostHandlers; onChild(child: ChildProcess): void; onSettled(child: ChildProcess): void }): Promise<HostRunResult> {
  const child = spawn(process.execPath, [input.pipelineCli, "--host", "stdio"], { cwd: input.cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] });
  input.onChild(child);
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  try {
    return await new Promise<HostRunResult>((resolve, reject) => {
    let settled = false;
    const settle = (action: () => void) => { if (!settled) { settled = true; action(); } };
    const send = (message: unknown) => child.stdin?.write(`${JSON.stringify(message)}\n`);
    const rejectProtocol = (message: string) => {
      child.kill();
      settle(() => reject(new Error(message)));
    };
    let buffered = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      const lines = buffered.split("\n");
      buffered = lines.pop()!;
      for (const line of lines) {
        if (!line) continue;
        let message: { version?: unknown; id?: unknown; type?: unknown; request?: unknown; event?: unknown; result?: unknown; error?: { message?: unknown } };
        try { message = JSON.parse(line) as typeof message; } catch { rejectProtocol("Pipeline child emitted invalid host protocol JSON."); return; }
        if (message.version !== 1 || typeof message.id !== "string" || typeof message.type !== "string") { rejectProtocol("Pipeline child emitted an invalid host protocol envelope."); return; }
        if (message.type === "llm.complete" || message.type === "agent.run") {
          const request = message.request;
          const handler = message.type === "llm.complete" ? input.handlers.complete : input.handlers.runAgent;
          void handler(request as never).then((value) => send({ version: 1, id: message.id, type: "result", value }), (error) => send({ version: 1, id: message.id, type: "error", error: { message: error instanceof Error ? error.message : String(error) } }));
        } else if (message.type === "progress") {
          input.handlers.onProgress(message.event);
        } else if (message.type === "run.result") {
          settle(() => resolve(message.result as HostRunResult));
        } else if (message.type === "run.error") {
          settle(() => reject(new Error(typeof message.error?.message === "string" ? message.error.message : "Pipeline execution failed.")));
        } else {
          rejectProtocol(`Pipeline child emitted unsupported host message type \`${message.type}\`.`);
        }
      }
    });
    child.on("error", (error) => settle(() => reject(error)));
    child.on("exit", (code, signal) => settle(() => reject(new Error(`Pipeline child exited before returning a result (${signal ?? code ?? "unknown"}).${stderr ? ` ${stderr.trim()}` : ""}`))));
      send({ version: 1, id: "run-1", type: "run", ...input.request });
    });
  } finally {
    input.onSettled(child);
  }
}
