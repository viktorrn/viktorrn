export interface PiUsage { input: number; output: number; cacheRead: number; cacheWrite: number; cost?: number }

export function emptyUsage(): PiUsage { return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }; }

export function addUsage(total: PiUsage, value: PiUsage | undefined): void {
  if (!value) return;
  total.input += value.input;
  total.output += value.output;
  total.cacheRead += value.cacheRead;
  total.cacheWrite += value.cacheWrite;
  if (value.cost !== undefined) total.cost = (total.cost ?? 0) + value.cost;
}

export function usageFrom(message: { usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; cost?: { total?: number } } }): PiUsage | undefined {
  const usage = message.usage;
  if (!usage) return undefined;
  return { input: usage.input ?? 0, output: usage.output ?? 0, cacheRead: usage.cacheRead ?? 0, cacheWrite: usage.cacheWrite ?? 0, ...(usage.cost?.total === undefined ? {} : { cost: usage.cost.total }) };
}

export function formatUsage(usage: PiUsage): string {
  const tokens = `${usage.input.toLocaleString()} in / ${usage.output.toLocaleString()} out`;
  return usage.cost === undefined ? tokens : `${tokens} / $${usage.cost.toFixed(4)}`;
}
