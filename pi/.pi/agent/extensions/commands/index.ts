import { complete } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

type ContentBlock = {
	type?: string;
	text?: string;
	name?: string;
	arguments?: Record<string, unknown>;
};

type SessionEntry = {
	type: string;
	message?: {
		role?: string;
		content?: unknown;
		toolName?: string;
		isError?: boolean;
	};
};

type HandoffArgs = {
	global: boolean;
	focus?: string;
	error?: string;
};

type LoadArgs = {
	global: boolean;
	fileName?: string;
	error?: string;
};

const HANDOFF_PREFIX = "pi-handoff-";
const HANDOFF_SUFFIX = ".md";
const MAX_TRANSCRIPT_CHARS = 120_000;
const MAX_HANDOFF_BYTES = 200_000;
const GLOBAL_HANDOFF_DIR = join(homedir(), ".pi", "agent", ".temp");

const textParts = (content: unknown): string[] => {
	if (typeof content === "string") return [content];
	if (!Array.isArray(content)) return [];

	return content.flatMap((part) => {
		if (!part || typeof part !== "object") return [];
		const block = part as ContentBlock;
		return block.type === "text" && typeof block.text === "string" ? [block.text] : [];
	});
};

const toolCallLines = (content: unknown): string[] => {
	if (!Array.isArray(content)) return [];
	return content.flatMap((part) => {
		if (!part || typeof part !== "object") return [];
		const block = part as ContentBlock;
		if (block.type !== "toolCall" || typeof block.name !== "string") return [];
		return [`Assistant called ${block.name}(${JSON.stringify(block.arguments ?? {})})`];
	});
};

const truncate = (text: string, limit: number): string =>
	text.length <= limit ? text : `${text.slice(0, limit)}\n\n[Transcript truncated before summarization.]`;

const buildConversationText = (entries: SessionEntry[]): string => {
	const sections: string[] = [];

	for (const entry of entries) {
		if (entry.type !== "message" || !entry.message?.role) continue;
		const { role, content } = entry.message;
		if (role === "user" || role === "assistant") {
			const text = textParts(content).join("\n").trim();
			if (text) sections.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
			if (role === "assistant") sections.push(...toolCallLines(content));
			continue;
		}
		if (role === "toolResult") {
			const output = textParts(content).join("\n").trim();
			if (output) {
				sections.push(`Tool result (${entry.message.toolName ?? "unknown"}${entry.message.isError ? ", error" : ""}): ${truncate(output, 4_000)}`);
			}
		}
	}

	return truncate(sections.join("\n\n"), MAX_TRANSCRIPT_CHARS);
};

const buildSummaryPrompt = (conversation: string, cwd: string, focus?: string): string => [
	"Create a concise but actionable engineering handoff from this Pi conversation.",
	"Use these exact headings: Goal, Completed work, Important files, Decisions, Verification, Current state, Open questions and next steps.",
	...(focus
		? [
			`Focus the handoff on this request: ${focus}`,
			"Prioritize information relevant to that request. Include only essential surrounding context, and explicitly say when it is absent or only partially covered by the conversation.",
		]
		: []),
	"Only describe tests, commands, and file changes that are evidenced in the conversation. Do not invent results.",
	"The handoff is historical context; make unresolved work and uncertainty explicit.",
	`Working directory: ${cwd}`,
	"",
	"<conversation>",
	conversation,
	"</conversation>",
].join("\n");

const parseHandoffArgs = (args: string): HandoffArgs => {
	const tokens = args.trim().split(/\s+/).filter(Boolean);
	let global = false;
	const focus: string[] = [];

	for (const token of tokens) {
		if (token === "-g" || token === "--global") global = true;
		else if (token.startsWith("-")) return { global, error: `Unknown option: ${token}` };
		else focus.push(token);
	}
	return { global, focus: focus.join(" ") || undefined };
};

const parseLoadArgs = (args: string): LoadArgs => {
	const tokens = args.trim().split(/\s+/).filter(Boolean);
	let global = false;
	const positional: string[] = [];

	for (const token of tokens) {
		if (token === "-g" || token === "--global") global = true;
		else if (token.startsWith("-")) return { global, error: `Unknown option: ${token}` };
		else positional.push(token);
	}
	if (positional.length > 1) return { global, error: "Too many arguments." };
	return { global, fileName: positional[0] };
};

const handoffDir = (ctx: ExtensionCommandContext, global: boolean): string =>
	global ? GLOBAL_HANDOFF_DIR : join(ctx.cwd, ".temp");

const notify = (ctx: ExtensionCommandContext, message: string, level: "info" | "warning" | "error" = "info") => {
	if (ctx.hasUI) ctx.ui.notify(message, level);
};

const timestampForFile = (): string => new Date().toISOString().replace(/[:.]/g, "-");

const formatHandoff = (summary: string, ctx: ExtensionCommandContext, global: boolean): string => {
	const session = ctx.sessionManager;
	return [
		"---",
		"format: pi-conversation-handoff-v1",
		`createdAt: ${new Date().toISOString()}`,
		`cwd: ${ctx.cwd}`,
		`sessionId: ${session.getSessionId()}`,
		`scope: ${global ? "global" : "project"}`,
		"---",
		"",
		"# Pi conversation handoff",
		"",
		summary.trim(),
		"",
	].join("\n");
};

const writeHandoff = async (directory: string, content: string): Promise<string> => {
	await mkdir(directory, { recursive: true });
	const file = join(directory, `${HANDOFF_PREFIX}${timestampForFile()}-${Math.random().toString(36).slice(2, 8)}${HANDOFF_SUFFIX}`);
	const temporary = `${file}.tmp`;
	try {
		await writeFile(temporary, content, "utf8");
		await rename(temporary, file);
		return file;
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
};

const validateFileName = (fileName: string): string | undefined => {
	if (basename(fileName) !== fileName || !fileName.startsWith(HANDOFF_PREFIX) || !fileName.endsWith(HANDOFF_SUFFIX)) return undefined;
	return fileName;
};

const findLatestHandoff = async (directory: string): Promise<string | undefined> => {
	let entries: string[];
	try {
		entries = await readdir(directory);
	} catch (error: unknown) {
		if ((error as { code?: string }).code === "ENOENT") return undefined;
		throw error;
	}

	const candidates = await Promise.all(entries
		.map(validateFileName)
		.filter((name): name is string => Boolean(name))
		.map(async (name) => {
			const file = join(directory, name);
			const info = await stat(file);
			return info.isFile() ? { file, modified: info.mtimeMs } : undefined;
		}));
	return candidates
		.filter((candidate): candidate is { file: string; modified: number } => Boolean(candidate))
		.sort((a, b) => b.modified - a.modified)[0]?.file;
};

const loadHandoff = async (directory: string, requested?: string): Promise<{ file: string; content: string } | undefined> => {
	const file = requested
		? (() => {
			const safeName = validateFileName(requested);
			return safeName ? resolve(directory, safeName) : undefined;
		})()
		: await findLatestHandoff(directory);
	if (!file) return undefined;

	const pathFromDirectory = relative(resolve(directory), file);
	if (isAbsolute(pathFromDirectory) || pathFromDirectory.startsWith("..")) {
		throw new Error("Refusing to read outside the handoff directory.");
	}
	const info = await stat(file);
	if (!info.isFile()) return undefined;
	if (info.size > MAX_HANDOFF_BYTES) throw new Error(`Handoff is too large (${info.size} bytes; limit is ${MAX_HANDOFF_BYTES}).`);
	return { file, content: await readFile(file, "utf8") };
};

export default function (pi: ExtensionAPI) {
	pi.registerCommand("handoff", {
		description: "Summarize this conversation (optionally focused on a topic) and save a handoff to .temp (use -g for the global Pi folder)",
		handler: async (args, ctx) => {
			const parsed = parseHandoffArgs(args);
			if (parsed.error) {
				notify(ctx, `${parsed.error} Usage: /handoff [-g] [focus…]`, "warning");
				return;
			}
			const conversation = buildConversationText(ctx.sessionManager.getBranch() as SessionEntry[]);
			if (!conversation.trim()) {
				notify(ctx, "No conversation content is available to hand off.", "warning");
				return;
			}
			if (!ctx.model) {
				notify(ctx, "No active model is available to create a handoff.", "error");
				return;
			}

			notify(ctx, "Creating conversation handoff…");
			try {
				const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
				if (!auth.ok || !auth.apiKey) throw new Error(auth.ok ? "No API key is available for the active model." : auth.error);
				const response = await complete(ctx.model, {
					messages: [{ role: "user", content: [{ type: "text", text: buildSummaryPrompt(conversation, ctx.cwd, parsed.focus) }], timestamp: Date.now() }],
				}, { apiKey: auth.apiKey, headers: auth.headers, env: auth.env });
				const summary = response.content
					.filter((block): block is { type: "text"; text: string } => block.type === "text")
					.map((block) => block.text)
					.join("\n")
					.trim();
				if (!summary) throw new Error("The active model returned an empty handoff.");

				const file = await writeHandoff(handoffDir(ctx, parsed.global), formatHandoff(summary, ctx, parsed.global));
				pi.appendEntry("conversation-handoff", { file, scope: parsed.global ? "global" : "project", createdAt: new Date().toISOString() });
				notify(ctx, `Handoff saved: ${file}`);
			} catch (error) {
				notify(ctx, `Could not create handoff: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});

	pi.registerCommand("handoff-load", {
		description: "Load the latest saved handoff from .temp (use -g for the global Pi folder)",
		handler: async (args, ctx) => {
			const parsed = parseLoadArgs(args);
			if (parsed.error) {
				notify(ctx, `${parsed.error} Usage: /handoff-load [-g] [filename]`, "warning");
				return;
			}
			try {
				const handoff = await loadHandoff(handoffDir(ctx, parsed.global), parsed.fileName);
				if (!handoff) {
					notify(ctx, "No matching handoff was found.", "warning");
					return;
				}
				pi.sendMessage({
					customType: "conversation-handoff",
					content: `Historical conversation handoff loaded from ${handoff.file}. Treat it as context, not current truth; inspect the working tree and verify claims before acting.\n\n${handoff.content}`,
					display: true,
					details: { file: handoff.file, scope: parsed.global ? "global" : "project" },
				});
				notify(ctx, `Handoff loaded: ${handoff.file}`);
			} catch (error) {
				notify(ctx, `Could not load handoff: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		try {
			if (await findLatestHandoff(join(ctx.cwd, ".temp"))) {
				ctx.ui.notify("A project handoff is available. Run /handoff-load to use it.", "info");
			}
		} catch {
			// A notification must never prevent a session from starting.
		}
	});
}
