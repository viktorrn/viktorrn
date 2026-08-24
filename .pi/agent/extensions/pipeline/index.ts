import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ChildProcess } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { runPiCodingAgent } from "./pi-agent.ts";
import { runPipelineChild } from "./pi-host.ts";
import { completeWithPiModel } from "./pi-llm.ts";
import type { PiSettings } from "./pi-model.ts";
import { addUsage, emptyUsage, formatUsage } from "./pi-usage.ts";

export default function (pi: ExtensionAPI) {
  const children = new Set<ChildProcess>();
  const agents = new Set<{ abort(): Promise<void> }>();

  pi.on("session_shutdown", () => {
    for (const child of children) child.kill();
    children.clear();
    for (const agent of agents) void agent.abort();
    agents.clear();
  });

  pi.registerCommand("pipeline", {
    description: "Run a pipeline expression or --file source through Pi host capabilities",
    handler: async (args, ctx) => {
      let request: PipelineRequest;
      try { request = readRequest(args, ctx.cwd); }
      catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); return; }
      let configuration: PipelineConfiguration;
      try {
        configuration = await configuredPipeline();
      } catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); return; }
      const usage = emptyUsage();
      let usedHostCapability = false;
      const display: PipelineDisplay = { steps: [] };
      setPipelineWidget(ctx, display);
      try {
        const result = await runPipelineChild({
          pipelineCli: configuration.pipelineCli,
          cwd: ctx.cwd,
          request,
          handlers: {
            complete: async (request) => {
              const response = await completeWithPiModel(ctx, request, configuration.settings);
              addUsage(usage, response.usage);
              usedHostCapability ||= response.usage !== undefined;
              return response;
            },
            runAgent: async (request) => {
              const response = await runPiCodingAgent(ctx, request, configuration.settings, { onStart: (agent) => agents.add(agent), onSettled: (agent) => agents.delete(agent) });
              addUsage(usage, response.usage);
              usedHostCapability ||= response.usage !== undefined;
              return response;
            },
            onProgress: (event) => updatePipelineDisplay(display, event, ctx),
          },
          onChild: (child) => children.add(child),
          onSettled: (child) => children.delete(child),
        });
        if (!result.ok) { ctx.ui.notify(result.diagnostics?.map((diagnostic) => diagnostic.message).join("\n") || "Pipeline validation failed.", "error"); return; }
        const output = result.output === undefined ? "Pipeline completed." : formatOutput(result.output);
        ctx.ui.notify(usedHostCapability ? `${output}\n\nUsage: ${formatUsage(usage)}` : output, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      } finally {
        setPipelineWidget(ctx, undefined);
      }
    },
  });
}

interface PipelineConfiguration { pipelineCli: string; settings: PiSettings }

async function configuredPipeline(): Promise<PipelineConfiguration> {
  const piDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  const configurationPath = join(piDir, "pipeline.json");
  let configuration: { pipelineCli?: unknown };
  try { configuration = JSON.parse(await readFile(configurationPath, "utf8")) as typeof configuration; }
  catch { throw new Error(`Could not read Pipeline configuration: ${configurationPath}`); }
  if (typeof configuration.pipelineCli !== "string" || !configuration.pipelineCli.trim()) throw new Error(`Set pipelineCli to the standalone pipeline bin/pipeline.mjs path in ${configurationPath}.`);
  const pipelineCli = resolve(configuration.pipelineCli);
  try { await access(pipelineCli); } catch { throw new Error(`pipelineCli does not exist: ${pipelineCli}`); }
  let settings: PiSettings = {};
  try { settings = JSON.parse(await readFile(join(piDir, "settings.json"), "utf8")) as PiSettings; } catch { /* Pi settings are only used for optional model aliases. */ }
  return { pipelineCli, settings };
}

interface PipelineStep { index: number; total: number; kind: "module" | "parallel"; label: string }
interface PipelineDisplay { steps: PipelineStep[]; current?: PipelineStep; decorator?: string }

function updatePipelineDisplay(display: PipelineDisplay, event: unknown, ctx: ExtensionContext): void {
  if (!isProgressEvent(event)) return;
  if (event.type === "plan") display.steps = event.steps;
  else if (event.type === "step-start") display.current = event.step;
  else if (event.type === "decorator-start") display.decorator = event.name;
  else if (event.type === "decorator-invoke") display.decorator = `${event.name} · attempt ${event.attempt}${event.attempts === undefined ? "" : `/${event.attempts}`}`;
  else if (event.type === "decorator-complete") display.decorator = undefined;
  setPipelineWidget(ctx, display);
}

function setPipelineWidget(ctx: ExtensionContext, display: PipelineDisplay | undefined): void {
  if (!ctx.hasUI) return;
  ctx.ui.setWidget("pipeline", display ? (_tui, theme) => {
    const current = display.current;
    const activity = display.decorator ? `Processing ${display.decorator}` : current ? `${current.kind === "parallel" ? "Parallel" : "Module"} ${current.index}/${current.total}: ${current.label}` : "Executing pipeline";
    const path = display.steps.length === 0 ? "" : `\n${display.steps.map((step) => step.index === current?.index ? `[${step.label}]` : step.label).join("  |  ")}`;
    return new Text(`${theme.fg("accent", theme.bold(" ● PIPELINE RUNNING "))} ${theme.fg("muted", activity + path)}`, 0, 0);
  } : undefined);
}

function isProgressEvent(value: unknown): value is { type: string; steps: PipelineStep[]; step: PipelineStep; name: string; attempt: number; attempts?: number } {
  return typeof value === "object" && value !== null && "type" in value && typeof (value as { type?: unknown }).type === "string";
}

type PipelineRequest = { source: string } | { file: string; parameters: Readonly<Record<string, string | true>> };

function readRequest(args: string, cwd: string): PipelineRequest {
  const value = args.trim();
  if (!value) throw new Error("Usage: /pipeline <pipeline expression> | /pipeline --file <path> [--parameter <value> | --flag].");
  if (!/^--file(?:\s|$)/.test(value)) return { source: value };
  const tokens = splitArguments(value);
  if (tokens[0] !== "--file" || !tokens[1]) throw new Error("Usage: /pipeline --file <path> [--parameter <value> | --flag].");
  const parameters: Record<string, string | true> = {};
  for (let index = 2; index < tokens.length; index++) {
    const flag = tokens[index]!;
    if (!flag.startsWith("--") || flag.length === 2) throw new Error(`Expected a template parameter flag, received \`${flag}\`.`);
    const name = flag.slice(2);
    if (parameters[name] !== undefined) throw new Error(`Template parameter \`--${name}\` was supplied more than once.`);
    const next = tokens[index + 1];
    if (next === undefined || next.startsWith("--")) parameters[name] = true;
    else { parameters[name] = next; index += 1; }
  }
  return { file: resolve(cwd, tokens[1]), parameters };
}

function splitArguments(value: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: "\"" | "'" | undefined;
  for (const character of value) {
    if (quote) { if (character === quote) quote = undefined; else token += character; }
    else if (character === "\"" || character === "'") quote = character;
    else if (/\s/.test(character)) { if (token) { tokens.push(token); token = ""; } }
    else token += character;
  }
  if (quote) throw new Error("Unterminated quoted command argument.");
  if (token) tokens.push(token);
  return tokens;
}

function formatOutput(value: unknown): string { return typeof value === "string" ? value : JSON.stringify(value); }
