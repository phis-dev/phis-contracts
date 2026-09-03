/**
 * How a Media Space names its kind on the wire.
 *
 * Only the name is shared. phis stores the kind as a smallint and that number is its own business --
 * the site UI never sees it, so putting it here would place a storage detail in a contract.
 *
 * What made this worth writing down is that the translation between the two was incomplete: phis knew
 * four kinds and mapped three, falling back to `"site"` for the rest, while the UI declared its own
 * union of the same three. An Add-on Space therefore reached the administration surface calling itself
 * a Site Space, in the one view that shows Add-on Spaces at all. With the names here, the map on the
 * server side is a total function from its own enum onto this one, and a kind that is added and not
 * mapped stops compiling.
 */

export const PHI_MEDIA_SPACE_KINDS = ["site", "user", "group", "addon"] as const;

export type PhiMediaSpaceKind = (typeof PHI_MEDIA_SPACE_KINDS)[number];

/**
 * The kinds a Module may declare a need for.
 *
 * The Site Space always exists and is governed by the Core Media role matrix, so declaring it could
 * only repeat what is already true. An Add-on Space belongs to its Add-on and comes with installing
 * it, rather than being asked for by a Module.
 */
export const PHI_DECLARABLE_MEDIA_SPACE_KINDS = ["user", "group"] as const;

export type PhiDeclarableMediaSpaceKind =
  (typeof PHI_DECLARABLE_MEDIA_SPACE_KINDS)[number];

export function isPhiDeclarableMediaSpaceKind(
  value: unknown,
): value is PhiDeclarableMediaSpaceKind {
  return (PHI_DECLARABLE_MEDIA_SPACE_KINDS as readonly string[]).includes(value as string);
}
