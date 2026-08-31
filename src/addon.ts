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

import type { PhiServerAddonCapabilities } from "./capabilities.js";
import type {
  PhiServerCoreCapabilityId,
  PhiServerServiceKind,
} from "./core.js";
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
   * The tables this Add-on owns, or null when it owns none.
   *
   * There is no list of migration steps beside it. The descriptor is the desired shape; what has been
   * applied is recorded in the database, and Core derives the difference.
   */
  schema: PhiServerAddonSchemaDescriptor | null;
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
