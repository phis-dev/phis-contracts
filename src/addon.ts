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
  PhisAddonCapabilities,
  PhisAddonJobHandler,
  PhisSiteAccess,
} from "./capabilities.js";
import type {
  PhisCoreCapabilityId,
  PhisServiceKind,
} from "./core.js";
import type { PhisAddonQueryCatalog } from "./queries.js";
import type { PhisAddonSchemaDescriptor } from "./schema.js";

export const PHIS_ADDON_MANIFEST_VERSION = 1 as const;
export const PHIS_ADDON_ABI_VERSION = 1 as const;

export type PhisAddonAuthPolicy =
  | "internal"
  | "site-user"
  | "site-admin"
  | "operator";

export type PhisAddonHttpMethod =
  | "DELETE"
  | "GET"
  | "PATCH"
  | "POST"
  | "PUT";

export type PhisAddonApiRouteDescriptor = {
  id: string;
  method: PhisAddonHttpMethod;
  path: string;
  handler: string;
  auth: PhisAddonAuthPolicy;
  siteScoped: boolean;
  bodyLimitBytes?: number;
  rateLimitClass?: string;
  timeoutMs?: number;
};

export type PhisAddonHookDescriptor = {
  id: string;
  method: PhisAddonHttpMethod;
  path: string;
  handler: string;
  bodyLimitBytes: number;
  rateLimitClass: string;
  timeoutMs: number;
  /**
   * Whether this hook is told which Site it was called for, through `x-phis-site-key`.
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

export type PhisAddonCapabilityDescriptor = {
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
export type PhisAddonServiceProviderDescriptor = {
  serviceKind: PhisServiceKind;
  providerKey: string;
  interfaceDigest: string;
  factoryExport: string;
  requiredCoreCapabilities: PhisCoreCapabilityId[];
};

export type PhisAddonJobDescriptor = {
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
export type PhisAddonSettingDescriptor = {
  name: string;
  type: "text" | "integer" | "boolean";
  /** Shown by the CLI when it lists what an Add-on can be configured with. */
  description?: string;
  /** Answered when the operator has set nothing. Absent means the Add-on must handle null. */
  default?: string | number | boolean;
};

/**
 * Who may hand out one of this Add-on's roles.
 *
 * Declared rather than coded, which is the whole point: the Add-on's author decides the policy, and
 * Core enforces it. A running Add-on cannot rewrite what is in a manifest the digest covers, so "the
 * Add-on decides who may grant" and "an Add-on cannot widen what it was granted" stop contradicting
 * each other.
 *
 * `siteAccess` names one of the Site's own claims; `role` names another role of this same Add-on. A
 * Site Admin may always grant any role of any Add-on, so a graph that reaches nobody still has a way in.
 */
export type PhisAddonRoleGrantPolicy =
  | { siteAccess: PhisSiteAccess }
  | { role: string };

/**
 * One role this Add-on defines, in its own vocabulary.
 *
 * A role answers "may this person do this at all", where there is no row yet to judge -- may they submit
 * an offering, open the agent workspace, approve somebody else's work. What may be done to a particular
 * row stays the row's question: ownership for their own, the group ladder for shared ones.
 *
 * Core never interprets the name. It stores assignments, answers `has()`, and enforces `grantableBy`;
 * what `reviewer` means is the Add-on's business and stays there.
 */
export type PhisAddonRoleDescriptor = {
  name: string;
  description?: string;
  grantableBy: PhisAddonRoleGrantPolicy;
};

/**
 * A group this Add-on needs on every Site that runs it.
 *
 * Groups are Core's vocabulary about shared rows, so an Add-on cannot invent one at runtime and cannot
 * put anybody in it -- the groups capability reads and grants nothing. What it can do is say which ones
 * it needs, and Core creates them per Site when the Site asks for the Add-on. Who is in them stays with
 * whoever administers the Site, which is the point: a package should not be able to hand out standing.
 *
 * The group carries this Add-on's id as its provider, and Core already filters group claims against the
 * available providers -- so an Add-on's group stops granting anything the moment the Add-on is gone,
 * without anybody having to remember to clean up.
 */
export type PhisAddonGroupDescriptor = {
  /** Unique within this Add-on. Frozen once a Site has one: memberships point at it by key. */
  key: string;
  /** What an administrator sees in the Site's group list. */
  name: string;
  description?: string;
};

export type PhisAddonManifestV1 = {
  manifestVersion: typeof PHIS_ADDON_MANIFEST_VERSION;
  addonId: string;
  packageName: string;
  packageVersion: string;
  serverAbi: string;
  capabilities: PhisAddonCapabilityDescriptor[];
  serviceProviders: PhisAddonServiceProviderDescriptor[];
  requiredCoreCapabilities: PhisCoreCapabilityId[];
  apiRoutes: PhisAddonApiRouteDescriptor[];
  hooks: PhisAddonHookDescriptor[];
  jobs: PhisAddonJobDescriptor[];
  /**
   * What an operator may configure. Absent means nothing is.
   *
   * Optional, like every field added after this manifest version was already in the wild. A required
   * addition would make an installed Add-on's stored manifest unreadable the moment Core is upgraded --
   * and its author had not forgotten anything, the field did not exist when they built it. The initial
   * fields may demand an explicit `null`, because no stored manifest predates them; later ones must
   * define what absence means and accept it.
   */
  settings?: PhisAddonSettingDescriptor[];
  /**
   * The roles this Add-on defines. Absent means it defines none.
   *
   * Optional for the same reason `settings` is: a manifest built before the field existed had not
   * forgotten it. A name is frozen from the first assignment -- renaming one orphans every grant that
   * points at it, silently, because the grant is stored as text and text does not follow a rename.
   */
  roles?: PhisAddonRoleDescriptor[];
  /**
   * The groups this Add-on needs. Absent means none.
   *
   * Optional like every field added after the manifest version was in the wild, and absent means the
   * Add-on asks for no group rather than that it forgot to say so.
   */
  groups?: PhisAddonGroupDescriptor[];
  /**
   * The Modules this package's other half contributes. Absent means it has no Module half.
   *
   * Each id is `<package name>/<module key>`, and the package name is this manifest's own -- one package
   * carries one product, so there is nothing to resolve. What the field adds is the one thing Core
   * cannot see from an artifact: whether a Module half exists at all. An Add-on that is only an Add-on,
   * like a storage provider, says nothing here and is complete on its own.
   *
   * It is what lets enabling an Add-on for a Site check that the Site actually has the other half. A
   * Site with the Add-on and not the Module has routes with no surface: nothing is broken, but an
   * operator who thinks they switched a feature on finds nothing.
   */
  modules?: string[];
  /**
   * The tables this Add-on owns, or null when it owns none.
   *
   * There is no list of migration steps beside it. The descriptor is the desired shape; what has been
   * applied is recorded in the database, and Core derives the difference.
   */
  schema: PhisAddonSchemaDescriptor | null;
  /**
   * The statements this Add-on may run against its own tables, or null when it runs none.
   *
   * Declared for the same reason the tables are: Core derives the SQL once, so what an installed
   * Add-on can do to its data is readable before it does it, and nothing is assembled per request.
   *
   * Optional for the reason `settings` is: it arrived after the manifest version was in the wild.
   */
  queries?: PhisAddonQueryCatalog | null;
  /** The version of `schema`, or 0 when there is none. */
  migrationVersion: number;
};

export type PhisAddonRequestContext = {
  addonId: string;
  requestId: string;
  method: PhisAddonHttpMethod;
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
  capabilities: PhisAddonCapabilities;
  signal: AbortSignal;
};

export type PhisAddonHandler = (
  context: PhisAddonRequestContext,
) => Promise<Response> | Response;

/**
 * A service factory, as the runtime exports it.
 *
 * Core states the shape of `config` and `context` per service kind; the manifest's interface digest is
 * what makes that agreement checkable. The factory receives schema-validated profile configuration and
 * a restricted context, never a database handle or a general secret accessor.
 */
export type PhisAddonServiceFactory = (
  config: unknown,
  context: unknown,
) => unknown;

export type PhisAddonRuntimeV1 = {
  manifest: PhisAddonManifestV1;
  apiHandlers?: Readonly<Record<string, PhisAddonHandler>>;
  hookHandlers?: Readonly<Record<string, PhisAddonHandler>>;
  serviceFactories?: Readonly<Record<string, PhisAddonServiceFactory>>;
  jobHandlers?: Readonly<Record<string, PhisAddonJobHandler>>;
};

export type PhisAddonRuntimeModuleV1 = {
  phiServerAddon: PhisAddonRuntimeV1;
};

export type PhisAddonBuildEntry = {
  enabled: boolean;
  manifestDigest: string;
  manifest: PhisAddonManifestV1;
  load: () => Promise<PhisAddonRuntimeModuleV1>;
};

export type PhisAddonBuildManifest = Readonly<
  Record<string, PhisAddonBuildEntry>
>;

/**
 * One installed Add-on, as the operator's desired state records it.
 *
 * The entry carries the descriptors as well as the digests. Code and description then travel together
 * as one per-instance unit, and the database is left to say only whether the Add-on may run. The two
 * digests bind the three apart: `manifestDigest` covers the descriptors below, `artifactDigest` covers
 * the file in the install root, and the loader refuses a file that no longer matches.
 */
export type PhisAddonDesiredStateEntry = {
  addonId: string;
  packageName: string;
  packageVersion: string;
  manifestDigest: string;
  /** SHA-256 of the installed artifact, and the cache key its load address carries. */
  artifactDigest: string;
  /** The validated descriptors, as read from the artifact at installation. */
  manifest: PhisAddonManifestV1;
  enabled: boolean;
};

export type PhisAddonDesiredState = {
  formatVersion: 1;
  addons: PhisAddonDesiredStateEntry[];
};
