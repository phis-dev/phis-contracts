/**
 * The authorization vocabulary phi-server and the site UI share.
 *
 * Two processes decide the same question. phi-server decides it in its guards, its Add-on capabilities
 * and its API routes; the site decides it while rendering -- per navigation entry, per tree node, per
 * menu item, and in the browser, where phi-server is not reachable without a round trip. Neither can
 * defer to the other, so both evaluate, and the only way both can agree is that both compile the same
 * source.
 *
 * They did not agree before this file existed. `flags: -1` on a stored claim admitted everything on the
 * server and nothing in the UI, because one side normalised the value and the other did not. Nothing was
 * wrong with either copy on its own, which is exactly why it went unnoticed.
 *
 * What belongs here is what two ends of one agreement must both know. Not what both happen to use.
 */

export const PHI_CORE_ROLE_PROVIDER_ID = "@phis/phi-server/core" as const;

/**
 * The Site roles Core itself grants, as bit flags.
 *
 * Flags rather than names, because these are Core's own and finite, they are stored on a membership row,
 * and a viewer is checked against several at once. An Add-on's roles are the opposite case and are
 * carried by name.
 */
export const PhiBaseRole = {
  Admin: 1 << 0,
  Builder: 1 << 1,
  Publisher: 1 << 2,
  Author: 1 << 3,
  Developer: 1 << 4,
  Supporter: 1 << 5,
  Accountant: 1 << 6,
} as const;

export type PhiRoleProviderId = `@${string}/${string}`;
export type PhiGroupProviderId = `@${string}/${string}`;

export type PhiViewerRoleClaim = {
  providerId: PhiRoleProviderId;
  flags: number;
};

export type PhiViewerGroupClaim = {
  providerId: PhiGroupProviderId;
  key: string;
  flags: number;
};

/**
 * The roles a Server Add-on declared, held by this viewer, by name.
 *
 * An Add-on's roles are frozen from the first assignment and declared in its own manifest, so a bit
 * position would have to be handed out and kept forever -- reordering the manifest would silently change
 * what a policy means, and thirty-two would be the ceiling. Core never interprets these names.
 */
export type PhiViewerAddonRoleClaim = {
  providerId: PhiRoleProviderId;
  roles: readonly string[];
};

export type PhiViewerAccessPolicy =
  | { access: "anyone" }
  | { access: "anonymous" }
  | { access: "authenticated" }
  | {
      access: "roles";
      providerId: PhiRoleProviderId;
      allowedRoleFlags: number;
    }
  | {
      access: "groups";
      providerId: PhiGroupProviderId;
      allowedGroupKeys: readonly string[];
    }
  | {
      access: "addon-roles";
      providerId: PhiRoleProviderId;
      allowedRoles: readonly string[];
    };

/**
 * The least a viewer has to be for a policy to be decided about them.
 *
 * Deliberately smaller than either side's own viewer. phi-server carries `authenticated: boolean` and
 * the UI carries an `access` that also drives rendering; making one of those shapes the shared one would
 * have pushed a foreign concern into the other package. Each side keeps its own and passes a projection.
 */
export type PhiAccessSubject = {
  authenticated: boolean;
  roleClaims?: readonly PhiViewerRoleClaim[];
  groupClaims?: readonly PhiViewerGroupClaim[];
  /** Absent means none are known here, not that none are held: an `addon-roles` policy then denies. */
  addonRoleClaims?: readonly PhiViewerAddonRoleClaim[];
};

/**
 * Flags as they may be trusted.
 *
 * A stored claim is data, and data can be wrong. A negative value passes a bitwise test against every
 * mask there is, so reading it as written turns one bad row into every permission. Anything that is not
 * a non-negative integer is read as no flags at all.
 */
function readRoleFlags(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function getPhiViewerRoleFlags(
  subject: Pick<PhiAccessSubject, "roleClaims">,
  providerId: PhiRoleProviderId,
) {
  return readRoleFlags(subject.roleClaims?.find((claim) => claim.providerId === providerId)?.flags);
}

export function hasProviderRole(
  subject: Pick<PhiAccessSubject, "roleClaims">,
  providerId: PhiRoleProviderId,
  roleFlag: number,
) {
  const wanted = readRoleFlags(roleFlag);
  return wanted !== 0 && (getPhiViewerRoleFlags(subject, providerId) & wanted) !== 0;
}

export function hasPhiBaseRole(
  subject: Pick<PhiAccessSubject, "roleClaims">,
  roleFlag: number,
) {
  return hasProviderRole(subject, PHI_CORE_ROLE_PROVIDER_ID, roleFlag);
}

export function hasProviderGroup(
  subject: Pick<PhiAccessSubject, "groupClaims">,
  providerId: PhiGroupProviderId,
  groupKey: string,
) {
  return subject.groupClaims?.some(
    (claim) => claim.providerId === providerId && claim.key === groupKey,
  ) === true;
}

export function hasProviderAddonRole(
  subject: Pick<PhiAccessSubject, "addonRoleClaims">,
  providerId: PhiRoleProviderId,
  role: string,
) {
  return subject.addonRoleClaims?.some(
    (claim) => claim.providerId === providerId && claim.roles.includes(role),
  ) === true;
}

/**
 * Whether this subject may reach something guarded by this policy.
 *
 * A missing policy is `anyone`: a surface that states no requirement has none. Site Admin passes
 * everything, which is the one shortcut in here and the reason a locked-out Site can always be reopened.
 */
export function canPhiAccessSubjectReach(
  subject: PhiAccessSubject,
  policy: PhiViewerAccessPolicy | null | undefined,
) {
  const resolved = policy ?? { access: "anyone" as const };
  if (resolved.access === "anyone") {
    return true;
  }
  if (resolved.access === "anonymous") {
    return !subject.authenticated;
  }
  if (!subject.authenticated) {
    return false;
  }
  if (resolved.access === "authenticated") {
    return true;
  }
  if (hasPhiBaseRole(subject, PhiBaseRole.Admin)) {
    return true;
  }
  if (resolved.access === "groups") {
    return resolved.allowedGroupKeys.some((key) =>
      hasProviderGroup(subject, resolved.providerId, key),
    );
  }
  if (resolved.access === "addon-roles") {
    return resolved.allowedRoles.some((role) =>
      hasProviderAddonRole(subject, resolved.providerId, role),
    );
  }
  return resolved.allowedRoleFlags > 0 &&
    (getPhiViewerRoleFlags(subject, resolved.providerId) & resolved.allowedRoleFlags) !== 0;
}

/**
 * Whether a policy names a provider its owner is allowed to name.
 *
 * A Module may gate on its own Add-on's roles and on Core's, and not on a stranger's -- otherwise one
 * package could make its surface depend on another's vocabulary, which nobody would be responsible for
 * keeping stable.
 */
export function isPhiAccessPolicyProviderOwned(
  policy: PhiViewerAccessPolicy,
  ownerProviderId?: PhiRoleProviderId | null,
) {
  return (
    policy.access !== "roles" &&
    policy.access !== "groups" &&
    policy.access !== "addon-roles"
  ) ||
    policy.providerId === PHI_CORE_ROLE_PROVIDER_ID ||
    (ownerProviderId != null && policy.providerId === ownerProviderId);
}

const PROVIDER_ID_PATTERN = /^@[^/]+\/[^/]+(?:\/[^/]+)*$/;
const GROUP_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,159}$/u;
/** The same shape an Add-on manifest may declare a role under. */
const ADDON_ROLE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * Reads a stored descriptor back into a policy, or null.
 *
 * Whatever does not read as a policy is refused rather than repaired: a half-understood requirement
 * would decide what somebody is shown, and guessing at it is how a stricter rule quietly becomes a
 * looser one.
 */
export function readPhiViewerAccessPolicy(value: unknown): PhiViewerAccessPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.access === "anyone" ||
    record.access === "anonymous" ||
    record.access === "authenticated"
  ) {
    return { access: record.access };
  }
  if (typeof record.providerId !== "string" || !PROVIDER_ID_PATTERN.test(record.providerId)) {
    return null;
  }
  const providerId = record.providerId as PhiRoleProviderId;

  if (
    record.access === "roles" &&
    typeof record.allowedRoleFlags === "number" &&
    Number.isInteger(record.allowedRoleFlags) &&
    record.allowedRoleFlags > 0
  ) {
    return { access: "roles", providerId, allowedRoleFlags: record.allowedRoleFlags };
  }
  if (
    record.access === "groups" &&
    Array.isArray(record.allowedGroupKeys) &&
    record.allowedGroupKeys.length > 0 &&
    record.allowedGroupKeys.every((key) => typeof key === "string" && GROUP_KEY_PATTERN.test(key))
  ) {
    return {
      access: "groups",
      providerId,
      allowedGroupKeys: [...new Set(record.allowedGroupKeys as string[])],
    };
  }
  if (
    record.access === "addon-roles" &&
    Array.isArray(record.allowedRoles) &&
    record.allowedRoles.length > 0 &&
    record.allowedRoles.every((role) =>
      typeof role === "string" && ADDON_ROLE_NAME_PATTERN.test(role),
    )
  ) {
    return {
      access: "addon-roles",
      providerId,
      allowedRoles: [...new Set(record.allowedRoles as string[])],
    };
  }
  return null;
}
