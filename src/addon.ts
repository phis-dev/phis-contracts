/**
 * What a phi-server Add-on declares or implements.
 *
 * This package exists so an Add-on has something to build against that is not phi-server itself.
 * phi-server is a private application without an export surface; an Add-on published to a registry
 * could not depend on it, and a type import into the application's internals would bind an Add-on to a
 * file path that can move without anybody noticing.
 *
 * The admission rule is strict, and it is the only thing keeping this from becoming a junk drawer:
 * nothing enters unless at least one Add-on must declare or implement it. No validation, no helpers,
 * no node builtins -- the Add-on states, and Core checks. If something here ever does more than hand
 * back a constant, it is in the wrong package.
 */

import type {
  PhiServerAddonCapabilities,
  PhiServerAddonJobHandler,
} from "./capabilities.js";
import type {
  PhiServerCoreCapabilityId,
  PhiServerServiceKind,
} from "./core.js";
import type { PhiServerAddonQueryCatalog } from "./queries.js";
import type { PhiServerAddonSchemaDescriptor } from "./schema.js";

export const PHI_SERVER_ADDON_MANIFEST_VERSION = 1 as const;
export const PHI_SERVER_ADDON_ABI_VERSION = 1 as const;

export type PhiServerAddonAuthPolicy =
  | "internal"
  | "site-user"
  | "site-admin"
  | "operator";

export type PhiServerAddonHttpMethod =
  | "DELETE"
  | "GET"
  | "PATCH"
  | "POST"
  | "PUT";

export type PhiServerAddonApiRouteDescriptor = {
  id: string;
  method: PhiServerAddonHttpMethod;
  path: string;
  handler: string;
  auth: PhiServerAddonAuthPolicy;
  siteScoped: boolean;
  bodyLimitBytes?: number;
  rateLimitClass?: string;
  timeoutMs?: number;
};

export type PhiServerAddonHookDescriptor = {
  id: string;
  method: PhiServerAddonHttpMethod;
  path: string;
  handler: string;
  bodyLimitBytes: number;
  rateLimitClass: string;
  timeoutMs: number;
  /**
   * Whether this hook is told which Site it was called for, through `x-phi-site-key`.
   *
   * A hook is unauthenticated by construction -- that is what makes it reachable by a payment provider
   * or by somebody else's Core. Without a Site it also has no capabilities at all, because every one of
   * them is Site-scoped, so a hook could until now verify a signature and touch no data. Stating the
   * Site is what makes a public read possible; it grants nothing else, and the caller is still nobody.
   *
   * Optional, and absent means false: a hook written before this field existed had not forgotten it.
   */
  siteScoped?: boolean;
};

export type PhiServerAddonCapabilityDescriptor = {
  id: string;
  interfaceDigest: string;
};

/**
 * One implementation of a Core-owned service kind.
 *
 * `providerKey` is what a Storage Profile row stores, so it must stay stable across releases of the
 * Add-on; `factoryExport` names the entry in the runtime's `serviceFactories` map, which is how Core
 * reaches the implementation without a dynamic import. The interface digest is checked against what
 * this release offers, so an Add-on built for an older interface is refused rather than called.
 */
export type PhiServerAddonServiceProviderDescriptor = {
  serviceKind: PhiServerServiceKind;
  providerKey: string;
  interfaceDigest: string;
  factoryExport: string;
  requiredCoreCapabilities: PhiServerCoreCapabilityId[];
};

export type PhiServerAddonJobDescriptor = {
  id: string;
  handler: string;
  /**
   * How often this job expects to run, for the operator to read -- never a schedule Core keeps.
   *
   * phi-server serves from several instances, so an in-process timer would fire once per instance for
   * one intended run. The operator schedules `phis addon job run`, which is one runner by construction,
   * and this field tells them what the Add-on had in mind.
   */
  suggestedInterval?: "hourly" | "daily" | "weekly";
};

/**
 * One setting an operator may configure for this Add-on.
 *
 * Declared so `phis addon config` can list what is configurable, refuse a name nobody declared, and
 * check a value against its type before it is stored -- the same bargain as the schema and query
 * descriptors, one step smaller.
 */
export type PhiServerAddonSettingDescriptor = {
  name: string;
  type: "text" | "integer" | "boolean";
  /** Shown by the CLI when it lists what an Add-on can be configured with. */
  description?: string;
  /** Answered when the operator has set nothing. Absent means the Add-on must handle null. */
  default?: string | number | boolean;
};

export type PhiServerAddonManifestV1 = {
  manifestVersion: typeof PHI_SERVER_ADDON_MANIFEST_VERSION;
  addonId: string;
  packageName: string;
  packageVersion: string;
  serverAbi: string;
  capabilities: PhiServerAddonCapabilityDescriptor[];
  serviceProviders: PhiServerAddonServiceProviderDescriptor[];
  requiredCoreCapabilities: PhiServerCoreCapabilityId[];
  apiRoutes: PhiServerAddonApiRouteDescriptor[];
  hooks: PhiServerAddonHookDescriptor[];
  jobs: PhiServerAddonJobDescriptor[];
  /**
   * What an operator may configure. Absent means nothing is.
   *
   * Optional, like every field added after this manifest version was already in the wild. A required
   * addition would make an installed Add-on's stored manifest unreadable the moment Core is upgraded --
   * and its author had not forgotten anything, the field did not exist when they built it. The initial
   * fields may demand an explicit `null`, because no stored manifest predates them; later ones must
   * define what absence means and accept it.
   */
  settings?: PhiServerAddonSettingDescriptor[];
  /**
   * The tables this Add-on owns, or null when it owns none.
   *
   * There is no list of migration steps beside it. The descriptor is the desired shape; what has been
   * applied is recorded in the database, and Core derives the difference.
   */
  schema: PhiServerAddonSchemaDescriptor | null;
  /**
   * The statements this Add-on may run against its own tables, or null when it runs none.
   *
   * Declared for the same reason the tables are: Core derives the SQL once, so what an installed
   * Add-on can do to its data is readable before it does it, and nothing is assembled per request.
   *
   * Optional for the reason `settings` is: it arrived after the manifest version was in the wild.
   */
  queries?: PhiServerAddonQueryCatalog | null;
  /** The version of `schema`, or 0 when there is none. */
  migrationVersion: number;
};

export type PhiServerAddonRequestContext = {
  addonId: string;
  requestId: string;
  method: PhiServerAddonHttpMethod;
  url: string;
  headers: Headers;
  body: Uint8Array;
  path: string;
  pathParams: Readonly<Record<string, string>>;
  site:
    | {
        id: number;
        key: string;
      }
    | null;
  actor:
    | {
        kind: "operator";
        id: string;
      }
    | {
        kind: "user";
        id: number;
      }
    | {
        kind: "internal";
        id: null;
      }
    | null;
  /**
   * What Core hands this request, bound to the Site and actor above.
   *
   * Only what the manifest declared arrives. A capability is not fetched, looked up, or constructed by
   * the Add-on -- it is here or it is not, and it was already decided before the handler ran.
   */
  capabilities: PhiServerAddonCapabilities;
  signal: AbortSignal;
};

export type PhiServerAddonHandler = (
  context: PhiServerAddonRequestContext,
) => Promise<Response> | Response;

/**
 * A service factory, as the runtime exports it.
 *
 * Core states the shape of `config` and `context` per service kind; the manifest's interface digest is
 * what makes that agreement checkable. The factory receives schema-validated profile configuration and
 * a restricted context, never a database handle or a general secret accessor.
 */
export type PhiServerAddonServiceFactory = (
  config: unknown,
  context: unknown,
) => unknown;

export type PhiServerAddonRuntimeV1 = {
  manifest: PhiServerAddonManifestV1;
  apiHandlers?: Readonly<Record<string, PhiServerAddonHandler>>;
  hookHandlers?: Readonly<Record<string, PhiServerAddonHandler>>;
  serviceFactories?: Readonly<Record<string, PhiServerAddonServiceFactory>>;
  jobHandlers?: Readonly<Record<string, PhiServerAddonJobHandler>>;
};

export type PhiServerAddonRuntimeModuleV1 = {
  phiServerAddon: PhiServerAddonRuntimeV1;
};

export type PhiServerAddonBuildEntry = {
  enabled: boolean;
  manifestDigest: string;
  manifest: PhiServerAddonManifestV1;
  load: () => Promise<PhiServerAddonRuntimeModuleV1>;
};

export type PhiServerAddonBuildManifest = Readonly<
  Record<string, PhiServerAddonBuildEntry>
>;

/**
 * One installed Add-on, as the operator's desired state records it.
 *
 * The entry carries the descriptors as well as the digests. Code and description then travel together
 * as one per-instance unit, and the database is left to say only whether the Add-on may run. The two
 * digests bind the three apart: `manifestDigest` covers the descriptors below, `artifactDigest` covers
 * the file in the install root, and the loader refuses a file that no longer matches.
 */
export type PhiServerAddonDesiredStateEntry = {
  addonId: string;
  packageName: string;
  packageVersion: string;
  manifestDigest: string;
  /** SHA-256 of the installed artifact, and the cache key its load address carries. */
  artifactDigest: string;
  /** The validated descriptors, as read from the artifact at installation. */
  manifest: PhiServerAddonManifestV1;
  enabled: boolean;
};

export type PhiServerAddonDesiredState = {
  formatVersion: 1;
  addons: PhiServerAddonDesiredStateEntry[];
};
