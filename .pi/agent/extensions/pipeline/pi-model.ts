import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export type PiSettings = Record<string, unknown>;

/** Resolves a Pi settings alias or registered provider/model identifier without changing Pi's active model. */
export function resolvePiModel(ctx: ExtensionContext, selector: string | undefined, settings: PiSettings) {
  if (selector === undefined) {
    if (!ctx.model) throw new Error("No Pi model is selected.");
    return ctx.model;
  }
  const identifier = typeof settings[selector] === "string" ? settings[selector] : selector;
  const slash = identifier.indexOf("/");
  const model = slash > 0 ? ctx.modelRegistry.find(identifier.slice(0, slash), identifier.slice(slash + 1)) : undefined;
  if (!model) throw new Error(`Unknown Pi model selector \`${selector}\`. Use a configured settings alias or registered \`provider/model\` identifier.`);
  return model;
}
