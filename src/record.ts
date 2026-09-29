/*
 * Shared by the parsers of this package and not exported from it: each consumer keeps its own, and
 * the one question they all answer is settled the same way -- an array is not a keyed record.
 */
export function isPhiRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * The value a dotted path names inside a record: `"author.name"` reads `input.author.name`.
 *
 * Empty segments are skipped, so `""` names the input itself, and only records are walked -- an array
 * or a primitive on the way ends the walk with `undefined` rather than being indexed into.
 */
export function readPhiDotPath(input: unknown, path: string): unknown {
  let current = input;
  for (const segment of path.split(".")) {
    if (!segment) continue;
    if (!isPhiRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}
