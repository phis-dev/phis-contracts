/**
 * The membership ladder of a Site group, as both ends must count it.
 *
 * These numbers cross the wire. A membership row is written by `PATCH .../members/<userId>` carrying
 * `membershipFlags` as an integer, and the administration surface offers the levels to choose from, so
 * the site UI does arithmetic on the same bits phis stores. (The Add-on boundary is the other case:
 * there a level crosses by name, as `PHI_SERVER_GROUP_LEVELS`, because an Add-on has no reason to
 * know the bits at all.)
 *
 * They were declared on both sides and had drifted, which cost a level. phis counts four --
 * `GROUPS_AND_STORAGE.md` enforces `Manager => Editor => Author => Member` -- and the UI counted
 * three, calling `1|2` a Contributor and `1|2|4` a Manager. So the UI's Manager was phis's Editor:
 * granting it left out the bit that administers membership and deletes what others made, and the
 * viewer was shown a level they did not have. An actual Manager, at `1|2|4|8`, the UI could not name.
 *
 * The levels are cumulative, and that is the point of the ordering rather than an implementation
 * detail: "may edit only their own" is a narrowing of "may edit", so an Author sits below an Editor
 * on one ladder rather than beside them on another.
 */

export const PhiGroupMembershipFlags = {
  /** Reads what the group holds. */
  Member: 1,
  /** Creates, and may edit and delete what they created. */
  Author: 1 | 2,
  /** Reaches what others created. */
  Editor: 1 | 2 | 4,
  /** Deletes what anyone created, and administers the group's membership. */
  Manager: 1 | 2 | 4 | 8,
} as const;

export type PhiGroupMembershipFlagValue =
  (typeof PhiGroupMembershipFlags)[keyof typeof PhiGroupMembershipFlags];

/** Ascending, so a selector offers them in the order they widen. */
export const PHI_GROUP_MEMBERSHIP_LEVELS = [
  PhiGroupMembershipFlags.Member,
  PhiGroupMembershipFlags.Author,
  PhiGroupMembershipFlags.Editor,
  PhiGroupMembershipFlags.Manager,
] as const;

/**
 * The level a stored value amounts to, highest bit first, or `null` if it is not one.
 *
 * Reading downwards is what makes an unknown higher bit fail closed rather than round up.
 */
export function readPhiGroupMembershipLevel(value: unknown): PhiGroupMembershipFlagValue | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  if (value > PhiGroupMembershipFlags.Manager) return null;
  if ((value & 8) !== 0) return PhiGroupMembershipFlags.Manager;
  if ((value & 4) !== 0) return PhiGroupMembershipFlags.Editor;
  if ((value & 2) !== 0) return PhiGroupMembershipFlags.Author;
  return PhiGroupMembershipFlags.Member;
}
