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

import { isPhiCmsInstanceId, type PhiCmsInstanceId } from "./cms.js";

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

/**
 * Whether a string can name an npm package.
 *
 * The lexical rule the controller address family starts from, and the one phi-server had copied under
 * a different name to validate the same addresses. It is the same test `@phis/ui` keeps beside its own
 * package name for the grammars that do not travel -- module ids, module-scoped keys. If a second
 * grammar in this package needs it, that is the moment to give it a subpath of its own.
 */
export function isPhiNpmPackageName(value: string) {
  if (!value || value.includes(":") || value.length > 214) {
    return false;
  }
  return value.startsWith("@")
    ? /^@[a-z0-9][a-z0-9._~-]*\/[a-z0-9][a-z0-9._~-]*$/.test(value)
    : /^[a-z0-9][a-z0-9._~-]*$/.test(value);
}

/**
 * The address families a signal may name, and nothing else.
 *
 * A wiring is stored by the Builder, validated by phi-server on the way in, and delivered by the site
 * UI at runtime. All three read the same string, so all three have to parse it alike -- and until
 * 2026-09-07 two of them did it from separate copies, one of which said in its own comment that it
 * "mirrors the grammar in @phis/ui" because it could not import it.
 *
 * `cms:` addresses a Widget or Layout instance, optionally one control inside it. `region:` addresses a
 * Region of the route's active context. `controller:` addresses one Controller instance in the
 * namespace of the Module that owns it.
 */
export type PhiSignalAddress =
  | `cms:${PhiCmsInstanceId}`
  | `cms:${PhiCmsInstanceId}:${string}`
  | `region:${string}`
  | `controller:${string}/${string}:${string}`;

export type PhiControllerSignalAddress = Extract<PhiSignalAddress, `controller:${string}`>;

export type PhiSignalSender = PhiSignalAddress | null;
export type PhiSignalReceiver = PhiSignalAddress | "broadcast" | null;

export type PhiSignalAddressFamily = "cms" | "region";

/**
 * The one address the Site scope privileges.
 *
 * Site-scoped signals reach across Areas, so nothing addressable inside one may be named in that scope
 * -- no CMS instance, no Region, no broadcast. The Core Runtime Controller is the exception, and both
 * sides have to name the same string for the rule to mean anything. `@phis/ui` builds it from its own
 * constants and asserts it matches this one.
 */
export const PHI_CORE_RUNTIME_CONTROLLER_ADDRESS =
  "controller:@phis/ui/modules/core/controller/default:default" as PhiControllerSignalAddress;

export function isPhiSignalAddressSegment(value: string) {
  return value.length > 0 && !value.includes("/") && !value.includes(":");
}

/**
 * A controller lives in the namespace of the Module that owns it, so a plugin key is either a bare
 * package name or that package followed by `/modules/<module>/<namespace>`. Foreign packages use
 * either form; the grammar does not privilege first-party keys.
 */
export function isPhiControllerPluginKey(value: string) {
  const marker = value.indexOf("/modules/");
  if (marker < 0) {
    return isPhiNpmPackageName(value);
  }
  const rest = value.slice(marker + "/modules/".length).split("/");
  return (
    isPhiNpmPackageName(value.slice(0, marker)) &&
    rest.length === 2 &&
    rest.every((part) => isPhiSignalAddressSegment(part))
  );
}

export function isPhiControllerSignalAddress(address: unknown): address is PhiControllerSignalAddress {
  if (typeof address !== "string" || !address.startsWith("controller:")) {
    return false;
  }

  const body = address.slice("controller:".length);
  const instanceSeparatorIndex = body.lastIndexOf(":");
  if (instanceSeparatorIndex <= 0 || instanceSeparatorIndex === body.length - 1) {
    return false;
  }

  const namespacedType = body.slice(0, instanceSeparatorIndex);
  const instanceKey = body.slice(instanceSeparatorIndex + 1);
  const controllerSeparatorIndex = namespacedType.lastIndexOf("/");
  if (controllerSeparatorIndex <= 0 || controllerSeparatorIndex === namespacedType.length - 1) {
    return false;
  }

  return (
    isPhiControllerPluginKey(namespacedType.slice(0, controllerSeparatorIndex)) &&
    isPhiSignalAddressSegment(namespacedType.slice(controllerSeparatorIndex + 1)) &&
    isPhiSignalAddressSegment(instanceKey)
  );
}

/** The instance a `cms:` address names, or null when the string is not one. */
export function readPhiCmsSignalAddressInstanceId(address: string): PhiCmsInstanceId | null {
  if (!address.startsWith("cms:")) {
    return null;
  }
  const parts = address.slice("cms:".length).split(":");
  if (
    (parts.length !== 1 && parts.length !== 2) ||
    !isPhiCmsInstanceId(parts[0]) ||
    (parts.length === 2 && !isPhiSignalAddressSegment(parts[1]!))
  ) {
    return null;
  }
  return parts[0];
}

export function isPhiRegionSignalAddress(address: string) {
  return address.startsWith("region:") && isPhiSignalAddressSegment(address.slice("region:".length));
}

export function isPhiSignalAddress(value: unknown): value is PhiSignalAddress {
  if (typeof value !== "string") {
    return false;
  }
  const address = value.trim();
  return readPhiCmsSignalAddressInstanceId(address) != null ||
    isPhiRegionSignalAddress(address) ||
    isPhiControllerSignalAddress(address);
}

export function readPhiSignalAddress(value: unknown): PhiSignalAddress | undefined {
  return isPhiSignalAddress(value) ? (value.trim() as PhiSignalAddress) : undefined;
}

export function isPhiSignalReceiver(value: unknown): value is PhiSignalReceiver {
  return value === null || value === "broadcast" || isPhiSignalAddress(value);
}

/**
 * Why a receiver may not be addressed in a scope, said in one sentence, or nothing when it may.
 *
 * The same sentence twice over until now: phi-server refused these on the way in, the site UI refused
 * to deliver them at runtime, and neither knew the other's wording. What the two still do differently
 * is what they do with the answer -- one rejects a write, the other drops a signal.
 */
export function readPhiSignalReceiverScopeProblem(
  scope: PhiSignalScope,
  receiver: PhiSignalReceiver,
): string | null {
  if (scope !== "site" || receiver === null) {
    return null;
  }
  if (receiver === "broadcast") {
    return "must not broadcast in Site scope";
  }
  if (readPhiCmsSignalAddressInstanceId(receiver) != null) {
    return "must not target a CMS instance in Site scope";
  }
  if (isPhiRegionSignalAddress(receiver)) {
    return "must not target a Region in Site scope";
  }
  return receiver === PHI_CORE_RUNTIME_CONTROLLER_ADDRESS
    ? null
    : "may target only the Core Runtime Controller in Site scope";
}
