/**
 * What Core hands an Add-on, as opposed to what it checks about one.
 *
 * A capability reaches an Add-on already bound to the request it belongs to: the Site and the acting
 * user are closed over, not passed in. There is therefore no argument through which an Add-on could
 * name another Site or ask about somebody else -- the restriction is the shape of the thing rather
 * than a check inside it. `PhisMediaStorageServiceContext` binds a Provider to its own secret in the
 * same way and for the same reason.
 *
 * Only the capabilities an Add-on's manifest declared, and this release offers, are present. The rest
 * are absent rather than throwing: an Add-on that reaches for one it did not declare finds `undefined`
 * at the point where it made the mistake.
 */

import type { PhiServerDataCapabilityV1 } from "./queries.js";

/**
 * The cumulative group levels, by name.
 *
 * Names rather than numbers cross this boundary. The bits are Core's business, an Add-on has no reason
 * to do arithmetic on them, and a value that never leaves Core is one an Add-on cannot come to depend
 * on. Each level does everything the one before it does and one thing more.
 */
export const PHI_SERVER_GROUP_LEVELS = ["member", "author", "editor", "manager"] as const;

export type PhiServerGroupLevel = (typeof PHI_SERVER_GROUP_LEVELS)[number];

/**
 * What an actor wants to do to one row.
 *
 * Creating is absent on purpose. There is no row to ask about yet, and whether an Add-on may write at
 * all is settled before its handler runs.
 */
export type PhiServerRowIntent = "read" | "update" | "delete";

/**
 * A Site capability an Add-on may ask after, named symbolically.
 *
 * An Add-on never states a role flag. Which capabilities are askable is then a decision, and Core is
 * free to change what a role means without an installed Add-on holding a stale bitmask.
 */
export const PHI_SERVER_SITE_ACCESS = {
  siteAdmin: "site-admin",
  developerTools: "developer-tools",
  structureAuthoring: "structure-authoring",
  contentEditing: "content-editing",
  publishing: "publishing",
  siteMedia: "site-media",
  support: "support",
  accounting: "accounting",
} as const;

export type PhiServerSiteAccess = (typeof PHI_SERVER_SITE_ACCESS)[keyof typeof PHI_SERVER_SITE_ACCESS];

/**
 * The authorization capability: `@phis/phi-server/authorization:v1`.
 *
 * It answers questions and grants nothing. There is no operation here that changes a role, a
 * membership, or an owner, and there must not be one -- a single capability declaration would then be
 * permission to rewrite the authorization model rather than permission to consult it.
 *
 * `mayActOnRow` is the reason this exists. The scope columns on an Add-on's tables are Core's:
 * `ownerScoped` and `groupScoped` mean Core wrote `owner_user_id` and `group_id`, so Core can read
 * them back and apply the ladder itself. The Add-on names a row and an intent; it never reproduces the
 * rule, which is what keeps one rule from becoming one implementation per package.
 *
 * A table that is neither owner- nor group-scoped has nothing for this to decide and always answers
 * false: absence of a scope is not absence of a restriction.
 */
export type PhiServerAuthorizationCapabilityV1 = {
  /**
   * Whether the acting user may do this to one row of one of this Add-on's own tables.
   *
   * `table` is a table of this Add-on's schema under the name its descriptor gave it; another
   * Add-on's table is not addressable, because the schema is derived from the caller rather than
   * taken from the argument. A row that does not exist answers false rather than raising -- "may I"
   * about something absent has no other honest answer.
   */
  mayActOnRow(input: {
    table: string;
    id: number | string;
    intent: PhiServerRowIntent;
  }): Promise<boolean>;

  /** The level the acting user effectively holds in one group, or null when they are not in it. */
  groupLevel(groupId: number): Promise<PhiServerGroupLevel | null>;

  /** Whether the acting user holds one Site capability, with the Core Admin override applied. */
  hasSiteAccess(access: PhiServerSiteAccess): Promise<boolean>;
};

/**
 * The capabilities a handler may find on its context, keyed as the Core catalog keys them.
 *
 * Optional throughout: presence follows the manifest, and a capability this release does not offer
 * stops the Add-on at the dispatcher rather than arriving as a broken object.
 */
export type PhiServerAddonCapabilities = {
  authorization?: PhiServerAuthorizationCapabilityV1;
  data?: PhiServerDataCapabilityV1;
  storage?: PhiServerStorageCapabilityV1;
  secrets?: PhiServerSecretsCapabilityV1;
  groups?: PhiServerGroupsCapabilityV1;
  settings?: PhiServerSettingsCapabilityV1;
};

/**
 * The storage capability: `@phis/phi-server/storage:v1`.
 *
 * A private object store, bound to this Add-on and this Site. Keys are the Add-on's own and relative:
 * Core puts them under a prefix it derives, and never hands the physical key back. An Add-on therefore
 * cannot store an address, and cannot reach another Add-on's objects or another Site's by constructing
 * one -- the same rule the install root follows, where a stored string never becomes an import
 * specifier.
 *
 * This is not the Media library. Assets that a person uploads, browses, and references belong in a
 * Media Space with its folders, quotas and delivery policies. This is for what an Add-on keeps for
 * itself: a release artifact, a generated preview, an export waiting to be fetched.
 */
export type PhiServerStorageCapabilityV1 = {
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<{ key: string; byteSize: number }>;
  /** Null rather than throwing for an object that is not there. */
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  head(key: string): Promise<{ key: string; byteSize: number; contentType: string } | null>;
  /** Whether an object was removed. Removing what is not there is not an error. */
  remove(key: string): Promise<boolean>;
  /** The Add-on's own keys under a prefix, relative as they were given. */
  list(prefix?: string): Promise<string[]>;
};

/**
 * The secrets capability: `@phis/phi-server/secrets:v1`.
 *
 * An Add-on reads the secrets an operator set for it and no others. The owner is bound here, so there
 * is no argument through which another Add-on's reference could be named -- the resolver enforces the
 * same rule a second time, because the two are different kinds of mistake.
 *
 * There is no writer. An operator sets a secret with `phis secret set`; a package that could write its
 * own would be a package that could plant one.
 */
export type PhiServerSecretsCapabilityV1 = {
  /** The value, or null when the operator has not configured it. */
  read(name: string): Promise<string | null>;
};

/**
 * What an Add-on may learn about a person.
 *
 * Deliberately the same projection one group member gets of another: a display name, a company only
 * where the group discloses it, and never an address. An Add-on renders "listed by" and nothing more.
 */
export type PhiServerUserProjection = {
  userId: number;
  displayName: string | null;
  companyName: string | null;
};

/**
 * The groups capability: `@phis/phi-server/groups:v1`.
 *
 * Group facts. What follows from them -- may this actor do this -- is `authorization:v1`.
 *
 * Every answer is bounded by the acting user: an Add-on sees the groups its actor is in and the people
 * its actor could already see in them. It cannot become a directory of a Site's users, because there is
 * no question here that reaches past the actor's own membership.
 */
export type PhiServerGroupsCapabilityV1 = {
  /** The groups the acting user belongs to on this Site. */
  myGroups(): Promise<Array<{ id: number; key: string; name: string }>>;
  /** The members of one group the acting user is in, projected as a member sees them. */
  members(groupId: number): Promise<PhiServerUserProjection[]>;
  /**
   * One person, if the acting user shares a group with them.
   *
   * Null otherwise, and null is the whole point: it is what stops a row's owner id from becoming a
   * lookup into everybody.
   */
  user(userId: number): Promise<PhiServerUserProjection | null>;
};

/**
 * The settings capability: `@phis/phi-server/settings:v1`.
 *
 * What an operator configures and an Add-on reads: a commission rate, a moderation switch, an endpoint.
 * Distinct from `secrets:v1` on purpose -- a percentage is not a credential, and asking the secret store
 * to hold one would make "what is configured here" unreadable to the operator who configured it.
 *
 * There is no writer. Settings are the operator's, set with `phis addon config set`, and an Add-on that
 * could write its own would be able to widen what it was given.
 *
 * A setting the operator has not set answers with the declared default, so an Add-on has one shape to
 * handle rather than two, and `null` means genuinely unset with no default to fall back to.
 */
export type PhiServerSettingsCapabilityV1 = {
  read(name: string): Promise<string | number | boolean | null>;
  all(): Promise<Readonly<Record<string, string | number | boolean | null>>>;
};

/**
 * What a job receives.
 *
 * No request, no headers, and above all no actor: a job is the Add-on acting on its own data, not a
 * person acting through it. That is why the row-level ladder does not apply inside one, and why a job
 * is reachable only from `phis addon job run` and never from a route -- an Add-on that could start its
 * own job from a request would have built itself a way around the ladder.
 */
export type PhiServerAddonJobContext = {
  addonId: string;
  jobId: string;
  /** This run, for correlating what the job logs with what the operator started. */
  runId: string;
  /** The Site this run is for. A job always runs against exactly one. */
  site: { id: number; key: string };
  capabilities: PhiServerAddonCapabilities;
  signal: AbortSignal;
};

export type PhiServerAddonJobHandler = (
  context: PhiServerAddonJobContext,
) => Promise<void> | void;
