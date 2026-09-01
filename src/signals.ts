/**
 * The signal vocabulary phi-server and the site UI must both know.
 *
 * A widget declares what it emits and listens for; the Builder stores that wiring; phi-server validates
 * it on the way in. Two sides, one list -- and when they were two lists, they drifted: `@phis/ui` had
 * grown `date`, `time` and `length`, phi-server had not, and a length control's change signal was
 * rejected on save with "valueType is invalid". Nothing was wrong with either list on its own.
 *
 * Only the closed vocabularies and the value-schema format live here. Which schemas exist is a catalogue
 * of widget shapes that belongs to the UI: phi-server checks that a JSON signal names *a* schema, never
 * which one, so the catalogue is not something the two must agree on.
 */

export const PHI_SIGNAL_SCOPES = [
  "widget",
  "layout",
  "region",
  "page",
  "area",
  "site",
] as const;
export type PhiSignalScope = (typeof PHI_SIGNAL_SCOPES)[number];

export const PHI_SIGNAL_ACTIONS = [
  "activate",
  "change",
  "toggle",
  "start",
  "stop",
  "clear",
  "open",
  "close",
  "reload",
  "flush",
  "filter",
  "drop",
] as const;
export type PhiSignalAction = (typeof PHI_SIGNAL_ACTIONS)[number];

export const PHI_SIGNAL_VALUE_TYPES = [
  "none",
  "boolean",
  "string",
  "number",
  "date",
  "time",
  "enum",
  "color",
  "path",
  "length",
  "size",
  "image",
  "icon",
  "string[]",
  "number[]",
  "enum[]",
  "json",
] as const;
export type PhiSignalValueType = (typeof PHI_SIGNAL_VALUE_TYPES)[number];

export const PHI_SIGNAL_VALUE_SCHEMA_NAMESPACE = "signals";
export const PHI_SIGNAL_VALUE_SCHEMA_SEPARATOR = "/";

/** `<package name>/signals/<schema key>` -- who defined it, and which of theirs it is. */
export type PhiSignalValueSchema =
  `${string}/${typeof PHI_SIGNAL_VALUE_SCHEMA_NAMESPACE}/${string}`;

export function isPhiSignalScope(value: unknown): value is PhiSignalScope {
  return typeof value === "string" && (PHI_SIGNAL_SCOPES as readonly string[]).includes(value);
}

export function isPhiSignalAction(value: unknown): value is PhiSignalAction {
  return typeof value === "string" && (PHI_SIGNAL_ACTIONS as readonly string[]).includes(value);
}

export function isPhiSignalValueType(value: unknown): value is PhiSignalValueType {
  return typeof value === "string" && (PHI_SIGNAL_VALUE_TYPES as readonly string[]).includes(value);
}

/**
 * Whether a string is shaped like a value schema at all.
 *
 * Shape, and deliberately not membership. The site UI can ask the stricter question -- it holds the
 * module registry and checks that the package part names a module it knows. phi-server holds no such
 * registry and must not: refusing a schema because it had never heard of the package would refuse every
 * third party's. So the two ask different questions, and this is the one both can ask.
 *
 * The last separator wins, because a scoped package name contains one too.
 */
export function isPhiSignalValueSchemaShape(value: unknown): value is PhiSignalValueSchema {
  if (typeof value !== "string") {
    return false;
  }
  const marker = value.lastIndexOf(
    `${PHI_SIGNAL_VALUE_SCHEMA_SEPARATOR}${PHI_SIGNAL_VALUE_SCHEMA_NAMESPACE}${PHI_SIGNAL_VALUE_SCHEMA_SEPARATOR}`,
  );
  if (marker <= 0) {
    return false;
  }
  const leaf = value.slice(
    marker + PHI_SIGNAL_VALUE_SCHEMA_NAMESPACE.length + PHI_SIGNAL_VALUE_SCHEMA_SEPARATOR.length * 2,
  );
  return leaf.length > 0 && !leaf.includes(PHI_SIGNAL_VALUE_SCHEMA_SEPARATOR);
}
