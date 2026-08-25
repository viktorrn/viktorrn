import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, type AutocompleteItem, type Component } from "@earendil-works/pi-tui";

type Status = "unknown" | "pending" | "passed" | "warnings" | "failed" | "excluded";
type Command = { name: string; syntax: string; extension: string; source: string; description?: string };
type ExtensionInfo = { name: string; dir: string; files: string[]; sourceCommands: Command[]; documented: Command[] };
type RecordEntry = { path: string; fingerprint: string; validatorVersion: number; status: Status; checkedAt?: string; reason?: string; errors?: string[]; warnings?: string[] };
type Registry = { version: 1; extensions: Record<string, RecordEntry> };

const ROOT = join(homedir(), ".pi", "agent");
const EXT_ROOT = join(ROOT, "extensions");
const STATE_DIR = join(ROOT, "state", "command-governance");
const REGISTRY_FILE = join(STATE_DIR, "registry.json");
const VALIDATOR_VERSION = 1;

function allFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allFiles(path));
    else out.push(path);
  }
  return out;
}

function text(path: string): string {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

function extensionName(file: string): string {
  const rel = relative(EXT_ROOT, file).replaceAll("\\", "/");
  const first = rel.split("/")[0];
  return rel.includes("/") ? first : basename(rel).replace(/\.(ts|tsx|js|mjs|cjs)$/, "");
}

function parseDocumented(file: string, extension: string): Command[] {
  const source = relative(ROOT, file).replaceAll("\\", "/");
  const body = text(file);
  const matches = [...body.matchAll(/^##\s+(`(\/[^`]+)`|(\/[^\s]+))(?:\s*)$/gm)];
  return matches.map((match, i) => {
    const syntax = match[2] ?? match[3];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[i + 1]?.index ?? body.length;
    const section = body.slice(start, end).trim();
    const description = section.split(/\n\s*[-*] /)[0]?.trim().split("\n")[0];
    return { name: syntax.split(/\s+/)[0], syntax, extension, source, description };
  });
}

function discover(): ExtensionInfo[] {
  const files = allFiles(EXT_ROOT);
  const dirs = new Map<string, { dir: string; files: string[] }>();
  for (const file of files) {
    const ext = extensionName(file);
    const dir = join(EXT_ROOT, ext);
    const item = dirs.get(ext) ?? { dir, files: [] };
    item.files.push(file);
    dirs.set(ext, item);
  }
  const result: ExtensionInfo[] = [];
  for (const [name, item] of dirs) {
    const sourceFiles = item.files.filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
    const sourceCommands: Command[] = [];
    for (const file of sourceFiles) {
      const source = relative(ROOT, file).replaceAll("\\", "/");
      for (const match of text(file).matchAll(/registerCommand\(\s*["'`]([^"'`]+)["'`]/g)) {
        sourceCommands.push({ name: `/${match[1]}`, syntax: `/${match[1]}`, extension: name, source });
      }
    }
    const docs = item.files.find((f) => basename(f).toLowerCase() === "commands.md");
    result.push({ name, dir: item.dir, files: item.files, sourceCommands, documented: docs ? parseDocumented(docs, name) : [] });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function fingerprint(info: ExtensionInfo): string {
  const hash = createHash("sha256");
  for (const file of [...info.files].sort()) hash.update(relative(ROOT, file)).update("\0").update(text(file));
  return `sha256:${hash.digest("hex")}`;
}

function loadRegistry(): Registry {
  try {
    const value = JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
    if (value?.version === 1 && value.extensions) return value as Registry;
  } catch { /* first run or invalid cache */ }
  return { version: 1, extensions: {} };
}

function saveRegistry(registry: Registry) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

function audit(info: ExtensionInfo): { status: Status; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const actual = new Set(info.sourceCommands.map((c) => c.name));
  const documented = new Set(info.documented.map((c) => c.name));
  for (const command of actual) if (!documented.has(command)) errors.push(`${command} is registered but missing from commands.md`);
  for (const command of documented) if (!actual.has(command)) errors.push(`${command} is documented but not registered in source`);
  if (actual.size && !info.documented.length) errors.push("commands.md is missing or contains no command headings");
  if (actual.size && !info.files.some((f) => basename(f).toLowerCase() === "readme.md")) warnings.push("README.md is missing");
  for (const command of info.documented) if (!command.description) warnings.push(`${command.name} has no short description`);
  return { status: errors.length ? "failed" : warnings.length ? "warnings" : "passed", errors, warnings };
}

function refreshStatus(info: ExtensionInfo, registry: Registry): RecordEntry {
  const old = registry.extensions[info.name];
  const fp = fingerprint(info);
  if (old?.status === "excluded" && old.fingerprint === fp) return old;
  if (!old || old.fingerprint !== fp || old.validatorVersion !== VALIDATOR_VERSION) {
    return { path: relative(ROOT, info.dir).replaceAll("\\", "/"), fingerprint: fp, validatorVersion: VALIDATOR_VERSION, status: "pending", errors: [], warnings: [] };
  }
  return old;
}

function parseArgs(raw: string): { mode: string; target?: string; filter?: string } {
  const args = raw.trim().split(/\s+/).filter(Boolean);
  const option = args.find((a) => a.startsWith("--"));
  if (option === "--check-all") return { mode: "check-all" };
  if (option === "--check") return { mode: "check", target: args[args.indexOf(option) + 1] };
  if (option === "--revalidate") return { mode: "revalidate", target: args[args.indexOf(option) + 1] };
  if (option === "--status") return { mode: "status" };
  if (option === "--clear-cache") return { mode: "clear" };
  if (option === "--exclude") return { mode: "exclude", target: args[args.indexOf(option) + 1], filter: args.slice(args.indexOf(option) + 2).join(" ") };
  if (option === "--include") return { mode: "include", target: args[args.indexOf(option) + 1] };
  if (option === "--extension") return { mode: "extension", target: args[args.indexOf(option) + 1] };
  return { mode: "catalog", filter: args.join(" ") };
}

const COMMAND_OPTIONS = [
  { value: "--extension", description: "Show commands for one extension", takesExtension: true },
  { value: "--status", description: "Show cached validation status", takesExtension: false },
  { value: "--check", description: "Validate changed extensions (optionally one extension)", takesExtension: true },
  { value: "--check-all", description: "Validate every extension", takesExtension: false },
  { value: "--revalidate", description: "Force validation of one extension", takesExtension: true },
  { value: "--exclude", description: "Exclude an extension with a reason", takesExtension: true },
  { value: "--include", description: "Include an excluded extension", takesExtension: true },
  { value: "--clear-cache", description: "Clear cached validation results", takesExtension: false },
] as const;

function commandArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
  const hasTrailingSpace = /\s$/.test(argumentPrefix);
  const tokens = argumentPrefix.trim().split(/\s+/).filter(Boolean);
  const option = tokens[0] ?? "";

  if (tokens.length === 0 || (tokens.length === 1 && !hasTrailingSpace)) {
    const matches = COMMAND_OPTIONS.filter((candidate) => candidate.value.startsWith(option));
    return matches.length > 0
      ? matches.map(({ value, description }) => ({ value, label: value, description }))
      : null;
  }

  const optionDefinition = COMMAND_OPTIONS.find((candidate) => candidate.value === option);
  if (!optionDefinition?.takesExtension || tokens.length > 2) return null;

  const extensionPrefix = tokens[1] ?? "";
  const extensions = discover()
    .map((info) => info.name)
    .filter((name) => name.toLowerCase().startsWith(extensionPrefix.toLowerCase()));
  return extensions.length > 0
    ? extensions.map((name) => ({
      value: `${option} ${name}`,
      label: name,
      description: `Extension for ${option}`,
    }))
    : null;
}

type PickerItem = { command: string; description: string; extension: string };

class CommandPicker implements Component {
  private selected = 0;
  private columns = 1;

  constructor(
    private readonly items: PickerItem[],
    private readonly style: (text: string, selected: boolean) => string,
    private readonly onSelect: (command: string) => void,
    private readonly onCancel: () => void,
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, Key.enter)) {
      this.onSelect(this.items[this.selected]!.command);
      return;
    }
    if (matchesKey(data, Key.escape)) {
      this.onCancel();
      return;
    }

    if (matchesKey(data, Key.left) && this.selected % this.columns > 0) this.selected -= 1;
    else if (matchesKey(data, Key.right) && this.selected + 1 < this.items.length) this.selected += 1;
    else if (matchesKey(data, Key.up) && this.selected >= this.columns) this.selected -= this.columns;
    else if (matchesKey(data, Key.down) && this.selected + this.columns < this.items.length) this.selected += this.columns;
  }

  render(width: number): string[] {
    this.columns = Math.max(1, Math.min(3, Math.floor(width / 32)));
    const columnWidth = Math.max(1, Math.floor(width / this.columns));
    const rows = Math.ceil(this.items.length / this.columns);
    const selectedRow = Math.floor(this.selected / this.columns);
    const pageSize = 10;
    const firstRow = Math.floor(selectedRow / pageSize) * pageSize;
    const lastRow = Math.min(rows, firstRow + pageSize);
    const lines = [truncateToWidth("Pi command catalog — select a command to prefill the editor", width)];

    for (let row = firstRow; row < lastRow; row += 1) {
      let line = "";
      for (let column = 0; column < this.columns; column += 1) {
        const index = row * this.columns + column;
        const item = this.items[index];
        const raw = item ? `${item.command}  ${item.description || item.extension}` : "";
        const cell = truncateToWidth(raw, columnWidth - 1).padEnd(columnWidth);
        line += this.style(cell, index === this.selected);
      }
      lines.push(line);
    }
    lines.push(truncateToWidth(rows > pageSize
      ? `Page ${Math.floor(firstRow / pageSize) + 1} of ${Math.ceil(rows / pageSize)} · ↑↓←→ navigate · Enter select · Esc close`
      : "↑↓←→ navigate · Enter select · Esc close", width));
    return lines;
  }

  invalidate(): void {}
}

function pickerItems(infos: ExtensionInfo[], filter = ""): PickerItem[] {
  const unique = new Map<string, PickerItem>();
  const query = filter.toLowerCase();

  for (const info of infos) {
    const commands = info.documented.length ? info.documented : info.sourceCommands;
    for (const command of commands) {
      const haystack = `${command.name} ${command.syntax} ${command.description ?? ""} ${info.name}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      if (!unique.has(command.name)) {
        unique.set(command.name, {
          command: command.name,
          description: command.description ?? "",
          extension: info.name,
        });
      }
    }
  }
  return [...unique.values()].sort((a, b) => a.command.localeCompare(b.command));
}

async function showCommandPicker(ctx: ExtensionCommandContext, items: PickerItem[]): Promise<void> {
  if (ctx.mode !== "tui" || items.length === 0) return;

  const selected = await ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
    const picker = new CommandPicker(
      items,
      (text, active) => active ? theme.bg("selectedBg", theme.fg("accent", text)) : theme.fg("text", text),
      (command) => done(command),
      () => done(undefined),
    );
    return {
      render: (width) => picker.render(width),
      invalidate: () => picker.invalidate(),
      handleInput: (data) => {
        picker.handleInput(data);
        tui.requestRender();
      },
    };
  });

  if (selected) ctx.ui.setEditorText(selected);
}

function renderCatalog(infos: ExtensionInfo[], registry: Registry, filter = ""): string[] {
  const lines = ["Pi command catalog", `Root: ${ROOT}`, ""];
  for (const info of infos) {
    const commands = info.documented.length ? info.documented : info.sourceCommands;
    const shown = commands.filter((c) => !filter || `${c.name} ${c.syntax} ${c.description ?? ""} ${info.name}`.toLowerCase().includes(filter.toLowerCase()));
    if (!shown.length) continue;
    const state = refreshStatus(info, registry).status;
    const glyph = state === "passed" ? "✓" : state === "warnings" ? "⚠" : state === "failed" ? "✗" : state === "excluded" ? "⊘" : "?";
    lines.push(`${glyph} ${info.name} [${state}]`);
    for (const command of shown) lines.push(`  ${command.syntax.padEnd(38)} ${command.description ?? "(see source)"}`);
    lines.push("");
  }
  return lines.length > 3 ? lines : ["No commands matched."];
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("commands", {
    description: "List, filter, and validate commands provided by global Pi skills and extensions",
    getArgumentCompletions: commandArgumentCompletions,
    handler: async (raw, ctx) => {
      const parsed = parseArgs(raw ?? "");
      const infos = discover();
      const registry = loadRegistry();
      let lines: string[];

      if (parsed.mode === "clear") {
        saveRegistry({ version: 1, extensions: {} });
        lines = ["Command-governance validation cache cleared."];
      } else if (parsed.mode === "catalog") {
        lines = renderCatalog(infos, registry, parsed.filter);
      } else if (parsed.mode === "extension") {
        const info = infos.find((x) => x.name === parsed.target);
        lines = info ? renderCatalog([info], registry) : [`Unknown extension: ${parsed.target ?? "(missing)"}`];
      } else if (parsed.mode === "status") {
        lines = ["Command-governance status", ""];
        for (const info of infos) lines.push(`${info.name.padEnd(28)} ${refreshStatus(info, registry).status}`);
      } else if (parsed.mode === "exclude") {
        const info = infos.find((x) => x.name === parsed.target);
        if (!info || !parsed.target) lines = [`Unknown extension: ${parsed.target ?? "(missing)"}`];
        else {
          registry.extensions[info.name] = { ...refreshStatus(info, registry), status: "excluded", reason: parsed.filter || "No reason supplied" };
          saveRegistry(registry);
          lines = [`Excluded ${info.name}: ${parsed.filter || "No reason supplied"}`];
        }
      } else if (parsed.mode === "include") {
        const info = infos.find((x) => x.name === parsed.target);
        if (!info || !parsed.target) lines = [`Unknown extension: ${parsed.target ?? "(missing)"}`];
        else {
          delete registry.extensions[info.name];
          saveRegistry(registry);
          lines = [`Included ${info.name}; it is now pending validation.`];
        }
      } else {
        const selected = parsed.mode === "check-all" ? infos : infos.filter((x) => !parsed.target || x.name === parsed.target);
        const force = parsed.mode === "revalidate";
        const results: string[] = [];
        for (const info of selected) {
          const current = refreshStatus(info, registry);
          if (current.status === "excluded" && !force) { results.push(`⊘ ${info.name}: excluded`); continue; }
          if (!force && parsed.mode === "check" && current.status !== "pending" && current.status !== "unknown") { results.push(`↷ ${info.name}: unchanged (${current.status}), skipped`); continue; }
          const result = audit(info);
          registry.extensions[info.name] = { path: relative(ROOT, info.dir).replaceAll("\\", "/"), fingerprint: fingerprint(info), validatorVersion: VALIDATOR_VERSION, status: result.status, checkedAt: new Date().toISOString(), errors: result.errors, warnings: result.warnings };
          results.push(`${result.status === "passed" ? "✓" : result.status === "warnings" ? "⚠" : "✗"} ${info.name}: ${result.status}`);
          for (const error of result.errors) results.push(`  ERROR: ${error}`);
          for (const warning of result.warnings) results.push(`  WARNING: ${warning}`);
        }
        saveRegistry(registry);
        lines = results.length ? results : ["No extensions required validation."];
      }

      const pickerSource = parsed.mode === "extension"
        ? (() => {
          const info = infos.find((x) => x.name === parsed.target);
          return info ? [info] : [];
        })()
        : parsed.mode === "catalog"
          ? infos
          : [];
      const items = pickerItems(pickerSource, parsed.mode === "catalog" ? parsed.filter : "");
      const widgetLines = items.length > 0
        ? [
          `Pi command catalog · ${items.length} unique command${items.length === 1 ? "" : "s"}`,
          "Use the command picker to browse · Enter prefills the editor",
        ]
        : lines.length > 4
          ? [lines[0] ?? "Command catalog updated.", `${lines.length - 1} result lines available.`]
          : lines;

      ctx.ui.setWidget("commands", widgetLines);
      ctx.ui.notify(widgetLines[0] ?? "Command catalog updated.", "info");
      await showCommandPicker(ctx, items);
    },
  });
}
