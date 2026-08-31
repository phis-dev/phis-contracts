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
};
