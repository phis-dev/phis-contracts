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

/**
 * The display properties an Asset may carry, as bits of `media_assets.presentation_flags`.
 *
 * Shared because the number itself travels: the site UI sends a mask as a list filter and an array of
 * these values when metadata is saved, and phis both answers the filter with `flags & mask <> 0` and
 * refuses a value it does not know. Two sides that must agree on a number is what this package is for,
 * and the copy that lived on each side had already drifted -- phis still carried `Private`, `Archived`
 * and `Restricted` long after lifecycle and delivery had become columns of their own.
 *
 * Display only. Access is `delivery_policy` and `lifecycle_status`, never a bit in here.
 *
 * Bits 1 and 2 are free, and before v1 a bit may be given a new meaning rather than kept vacant.
 */
export const PhiMediaAssetFlags = {
  /** Offered as a background. What an Asset is for; where it came from is `meta.source`. */
  Background: 1 << 0,
  Featured: 1 << 3,
  Locked: 1 << 4,
  Mask: 1 << 5,
} as const;

export type PhiMediaAssetFlag = (typeof PhiMediaAssetFlags)[keyof typeof PhiMediaAssetFlags];

/**
 * The rest of the Media vocabulary both sides speak.
 *
 * Kind names travel as `kind` in the list contract and are stored on the Asset; Folder flags travel in
 * the Folder payload; a variant key is a number in a delivery URL and the name phis generates the
 * rendition under. None of it is one side's private business, and all of it stood twice -- once here in
 * spirit, once in each repository in fact -- until a bit value drifted and showed what that costs.
 *
 * The two resolvers come along because a vocabulary without its total function is only half a contract:
 * a content type must land on the same kind in the browser and on the server, or an upload is filed as
 * one thing and listed as another.
 */

export const PhiMediaFolderFlags = {
  Collapsed: 1 << 0,
  Hidden: 1 << 1,
  Locked: 1 << 2,
} as const;

export const PhiMediaKind = {
  Image: "image",
  Video: "video",
  Audio: "audio",
  Pdf: "pdf",
  Markdown: "markdown",
  Document: "document",
  Archive: "archive",
  /*
   * A typeface, kept because a Site owns its lettering the way it owns its pictures.
   *
   * Neither `Document` nor `Binary` would do. A font is not read and not handed over as a download: a
   * stylesheet loads it, and the Theme that names it has to be able to find it again years later --
   * including after the Module that once brought it was switched off. A kind of its own is what makes
   * that a query rather than a guess about content types.
   */
  Font: "font",
  /*
   * Arbitrary bytes, offered as a download and nothing else.
   *
   * Separate from `Other` because the two mean opposite things to a declaration: `Binary` is a Module
   * saying it wants executables and disk images, while `Other` is the answer for a type nothing has
   * classified. Without it, a Module that legitimately distributes an installer would have to declare
   * the catch-all to get one.
   */
  Binary: "binary",
  Other: "other",
} as const;

export const PhiImageAssetVariantKey = {
  Thumbnail: 0,
  Preview: 1,
  Banner: 2,
  Header: 3,
  Card: 4,
  Hero: 5,
  Avatar: 6,
  Logo: 7,
  Landscape: 8,
  Portrait: 9,
} as const;

export const PhiImageAssetVariantKeyName = {
  [PhiImageAssetVariantKey.Thumbnail]: "thumbnail",
  [PhiImageAssetVariantKey.Preview]: "preview",
  [PhiImageAssetVariantKey.Banner]: "banner",
  [PhiImageAssetVariantKey.Header]: "header",
  [PhiImageAssetVariantKey.Card]: "card",
  [PhiImageAssetVariantKey.Hero]: "hero",
  [PhiImageAssetVariantKey.Avatar]: "avatar",
  [PhiImageAssetVariantKey.Logo]: "logo",
  [PhiImageAssetVariantKey.Landscape]: "landscape",
  [PhiImageAssetVariantKey.Portrait]: "portrait",
} as const;

export type PhiImageAssetVariantSpec = {
  width: number;
  height: number;
  fit: "cover" | "contain";
  quality: number;
  format: "webp";
};

export function normalizePhiMediaKind(kind: string | null | undefined) {
  const normalized = (kind ?? "").trim().toLowerCase();
  if (
    normalized === PhiMediaKind.Image ||
    normalized === PhiMediaKind.Video ||
    normalized === PhiMediaKind.Audio ||
    normalized === PhiMediaKind.Pdf ||
    normalized === PhiMediaKind.Markdown ||
    normalized === PhiMediaKind.Document ||
    normalized === PhiMediaKind.Archive ||
    normalized === PhiMediaKind.Font ||
    normalized === PhiMediaKind.Binary
  ) {
    return normalized;
  }

  return PhiMediaKind.Other;
}

export function resolvePhiMediaKindFromContentType(contentType: string | null | undefined) {
  const normalized = (contentType ?? "").trim().toLowerCase();
  if (!normalized) {
    return PhiMediaKind.Other;
  }

  if (normalized.startsWith("image/")) {
    return PhiMediaKind.Image;
  }
  if (normalized.startsWith("video/")) {
    return PhiMediaKind.Video;
  }
  if (normalized.startsWith("audio/")) {
    return PhiMediaKind.Audio;
  }
  /*
   * `font/*` is the registered tree (RFC 8081); the `application/...` spellings below it are what older
   * tools still send for the same bytes.
   */
  if (
    normalized.startsWith("font/") ||
    normalized === "application/font-woff" ||
    normalized === "application/x-font-woff" ||
    normalized === "application/x-font-ttf" ||
    normalized === "application/x-font-otf" ||
    normalized === "application/x-font-truetype" ||
    normalized === "application/x-font-opentype" ||
    normalized === "application/vnd.ms-fontobject"
  ) {
    return PhiMediaKind.Font;
  }
  if (normalized === "application/pdf") {
    return PhiMediaKind.Pdf;
  }
  if (normalized === "text/markdown") {
    return PhiMediaKind.Markdown;
  }
  if (
    normalized === "application/msword" ||
    normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalized === "application/rtf" ||
    normalized === "text/plain" ||
    normalized === "application/vnd.oasis.opendocument.text"
  ) {
    return PhiMediaKind.Document;
  }
  if (
    normalized === "application/zip" ||
    normalized === "application/x-7z-compressed" ||
    normalized === "application/x-rar-compressed" ||
    normalized === "application/x-tar"
  ) {
    return PhiMediaKind.Archive;
  }
  /*
   * `application/octet-stream` belongs here rather than with the unclassified: an unlabelled blob is
   * bytes, and a Module declaring `binary` is saying it accepts exactly that.
   */
  if (
    normalized === "application/octet-stream" ||
    normalized === "application/x-msdownload" ||
    normalized === "application/vnd.microsoft.portable-executable" ||
    normalized === "application/x-executable" ||
    normalized === "application/x-mach-binary" ||
    normalized === "application/x-msi" ||
    normalized === "application/x-apple-diskimage" ||
    normalized === "application/vnd.debian.binary-package" ||
    normalized === "application/x-rpm"
  ) {
    return PhiMediaKind.Binary;
  }

  return PhiMediaKind.Other;
}

export function normalizePhiImageAssetVariantKey(key: unknown) {
  const parsed =
    typeof key === "number"
      ? key
      : Number.parseInt(typeof key === "string" ? key.trim() : "", 10);
  if (
    Number.isInteger(parsed) &&
    Object.prototype.hasOwnProperty.call(PhiImageAssetVariantKeyName, parsed)
  ) {
    return parsed as (typeof PhiImageAssetVariantKey)[keyof typeof PhiImageAssetVariantKey];
  }

  return null;
}

export function resolvePhiImageAssetVariantKeyName(
  key: number | null | undefined,
): string | null {
  if (typeof key !== "number" || !Number.isInteger(key)) {
    return null;
  }

  return PhiImageAssetVariantKeyName[key as keyof typeof PhiImageAssetVariantKeyName] ?? null;
}

export function resolvePhiImageAssetVariantSpec(
  key: number | null | undefined,
): PhiImageAssetVariantSpec | null {
  switch (key) {
    case PhiImageAssetVariantKey.Thumbnail:
      return { width: 256, height: 256, fit: "cover", quality: 80, format: "webp" };
    case PhiImageAssetVariantKey.Preview:
      return { width: 640, height: 360, fit: "cover", quality: 82, format: "webp" };
    case PhiImageAssetVariantKey.Banner:
      return { width: 1600, height: 89, fit: "cover", quality: 82, format: "webp" };
    case PhiImageAssetVariantKey.Header:
      return { width: 1920, height: 144, fit: "cover", quality: 82, format: "webp" };
    case PhiImageAssetVariantKey.Card:
      return { width: 960, height: 640, fit: "cover", quality: 82, format: "webp" };
    case PhiImageAssetVariantKey.Hero:
      return { width: 1600, height: 900, fit: "cover", quality: 84, format: "webp" };
    case PhiImageAssetVariantKey.Avatar:
      return { width: 100, height: 100, fit: "cover", quality: 80, format: "webp" };
    case PhiImageAssetVariantKey.Logo:
      return { width: 512, height: 256, fit: "contain", quality: 82, format: "webp" };
    case PhiImageAssetVariantKey.Landscape:
      return { width: 640, height: 396, fit: "cover", quality: 82, format: "webp" };
    case PhiImageAssetVariantKey.Portrait:
      return { width: 396, height: 640, fit: "cover", quality: 82, format: "webp" };
    default:
      return null;
  }
}

/**
 * The two closed vocabularies that decide whether an Asset may be delivered at all.
 *
 * The numbers themselves reach the site UI: an Asset's detail payload carries `lifecycleStatus` and
 * `deliveryPolicy` as they stand in the row, and the UI decides from them whether `next/image` may be
 * pointed at the original. phis evaluates `delivery_policy` before any physical lookup, so a value that
 * means one thing on one side and another on the other would be a visibility bug, not a display bug.
 *
 * Unlike the Space kind next to them in phis, which stays a storage detail because the wire carries its
 * name instead of its number.
 */
export const PhiMediaLifecycleStatus = {
  Pending: 1,
  Ready: 2,
  Archived: 3,
  Quarantined: 4,
  Failed: 5,
} as const;

export const PhiMediaDeliveryPolicy = {
  Public: 1,
  Authenticated: 2,
  User: 3,
  Group: 4,
  Internal: 5,
} as const;
