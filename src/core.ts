/**
 * What Core offers, named once so both sides can spell it the same way.
 *
 * An Add-on declares which Core capabilities it needs and which Core-owned service kinds it
 * implements. Those names are an agreement between two artifacts that ship separately, which is
 * exactly what this package is for -- and until they lived here, an Add-on author had to read them out
 * of phi-server, a private application they never receive. The S3 Storage Add-on carried the media
 * storage digest as a copied hex literal for that reason.
 *
 * This list is a promise, not a plan. A capability appears here when Core delivers it, never before:
 * an Add-on that finds a name here must be able to rely on it. `images:v1` is therefore absent.
 *
 * Still no node builtins. The digests are stated rather than derived, so a manifest stays readable
 * without hashing anything -- Core recomputes them and checks, which is where that belongs.
 */

/** The Core capabilities an Add-on may require. */
export const PHI_SERVER_CORE_CAPABILITIES = {
  authentication: "@phis/phi-server/authentication:v1",
  /**
   * "May this actor", in all three of its sources: does the row belong to them, what level do they
   * hold in its group, and what may they do on this Site at all. It is spelled out rather than
   * shortened to `auth` because the shortening would sit one letter away from `authentication` and
   * mean the opposite half of the same word.
   */
  authorization: "@phis/phi-server/authorization:v1",
  threads: "@phis/phi-server/threads:v1",
  resourceLinks: "@phis/phi-server/resource-links:v1",
  support: "@phis/phi-server/support:v1",
  /** Group facts -- which groups exist, who is in them. What follows from them is `authorization`. */
  groups: "@phis/phi-server/groups:v1",
  storage: "@phis/phi-server/storage:v1",
} as const;

export type PhiServerCoreCapabilityId =
  (typeof PHI_SERVER_CORE_CAPABILITIES)[keyof typeof PHI_SERVER_CORE_CAPABILITIES];

/**
 * The Core-owned service kinds an Add-on may implement.
 *
 * A service kind is not a capability. A capability is something Core offers an Add-on; a service kind
 * is something Core already owns and an Add-on supplies an implementation of -- S3 for Media Storage,
 * LDAP for a Directory. Core keeps selecting the configured implementation itself.
 */
export const PHI_SERVER_SERVICE_KINDS = {
  mediaStorage: "@phis/phi-server/service/media-storage",
  directory: "@phis/phi-server/service/directory",
} as const;

export type PhiServerServiceKind =
  (typeof PHI_SERVER_SERVICE_KINDS)[keyof typeof PHI_SERVER_SERVICE_KINDS];

/**
 * The digest of the interface each service kind currently has.
 *
 * An Add-on puts the digest of the interface it was built against into its manifest. Core compares it
 * with what this release offers and refuses the Add-on when they differ -- at install, with the value
 * quoted back, rather than at the first call. Whoever changes the shape of an interface raises its
 * version and replaces the digest here, and every Add-on built against the old one is refused.
 *
 * The digest is `sha256("phi-server-service-kind:<kind>:v<interface version>")`. That recipe is
 * documented for whoever has to produce the next value; nothing needs to run it to read a manifest.
 */
export const PHI_SERVER_SERVICE_INTERFACE_VERSIONS: Readonly<Record<PhiServerServiceKind, number>> = {
  [PHI_SERVER_SERVICE_KINDS.mediaStorage]: 1,
  [PHI_SERVER_SERVICE_KINDS.directory]: 1,
};

export const PHI_SERVER_SERVICE_INTERFACE_DIGESTS: Readonly<Record<PhiServerServiceKind, string>> = {
  [PHI_SERVER_SERVICE_KINDS.mediaStorage]:
    "66cb9728bdcfc4d2b97ef33db5b3de9934659ec5dd94b5ef1e35cf9030586ae2",
  [PHI_SERVER_SERVICE_KINDS.directory]:
    "ed8c179c64b07ea93ab24c26f7cfea237c409c879549ac4ed6cd74af356c2d6a",
};
