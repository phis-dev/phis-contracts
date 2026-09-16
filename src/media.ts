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

/**
 * What a typeface says about its own proportions.
 *
 * Shared because the numbers cross: phis reads them out of the uploaded file once and keeps them on the
 * Asset, and the site UI turns them into the `size-adjust` and `*-override` descriptors of a fallback
 * `@font-face`. Without that face a browser sets the page in a local substitute and reflows when the
 * real file lands, which is the one thing a viewer actually sees.
 *
 * Everything is in font units on the `unitsPerEm` grid, so a reader divides rather than assumes 1000.
 */
export type PhiFontMetrics = {
  /** The container the numbers were read from. */
  format: "sfnt" | "woff" | "woff2";
  familyName: string | null;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  capHeight: number | null;
  xHeight: number | null;
  /**
   * How wide running text sets, as an advance width.
   *
   * `glyphs` is the frequency-weighted advance of the characters prose is made of. `os2` is the font's
   * own `xAvgCharWidth`, which averages every glyph in the file and is therefore wrong for a Latin page
   * in a family that also carries Greek -- the source travels so a reader can tell the two apart.
   */
  xWidthAvg: number | null;
  xWidthAvgSource: "glyphs" | "os2" | null;
  /**
   * What the file classifies itself as, and `null` where it classifies itself as nothing.
   *
   * Plenty of good fonts leave both PANOSE and the `OS/2` family class empty, so the absence is a fact
   * about the file rather than a reason to guess: whoever picks the local substitute decides instead.
   */
  category: "serif" | "sans-serif" | "monospace" | null;
  /**
   * Which unicode cuts the typeface has characters in, read out of its `cmap` at upload.
   *
   * Absent on a font uploaded before cuts existed; such a font is delivered whole.
   */
  coverage?: PhiFontCoverage | null;
};

/**
 * The cuts a typeface can be delivered in.
 *
 * The number stands in a delivery URL, so it is shared; the named cuts follow the unicode ranges Google
 * Fonts divides its families along, so a face declared here splits where fonts are commonly split.
 * `Rest` is not a range but everything a typeface has outside all of them -- its own characters, listed
 * per font in `PhiFontCoverage.restRanges`, so a page never loses a glyph and never fetches a cut for a
 * character the font does not have.
 */
export const PhiFontSubsetKey = {
  Latin: 0,
  LatinExt: 1,
  Cyrillic: 2,
  CyrillicExt: 3,
  Greek: 4,
  GreekExt: 5,
  Vietnamese: 6,
  Math: 7,
  Symbols: 8,
  Rest: 15,
} as const;

export type PhiFontSubsetKeyValue = (typeof PhiFontSubsetKey)[keyof typeof PhiFontSubsetKey];

/** An inclusive codepoint range. */
export type PhiUnicodeRange = readonly [start: number, end: number];

/**
 * Raised whenever the ranges below or the way a cut is produced changes, so every stored cut is made
 * again rather than served under a rule that no longer describes it.
 */
export const PHI_FONT_SUBSET_VERSION = 1;

const range = (text: string): PhiUnicodeRange[] =>
  text.split(",").map((part) => {
    const [start, end] = part.trim().replace(/^U\+/u, "").split("-");
    const first = Number.parseInt(start!, 16);
    return [first, end ? Number.parseInt(end, 16) : first] as const;
  });

/** The named cuts, as Google Fonts' CSS2 API states them for a Latin, Cyrillic and Greek family. */
export const PHI_FONT_SUBSET_RANGES: Readonly<Record<Exclude<PhiFontSubsetKeyValue, 15>, readonly PhiUnicodeRange[]>> = {
  [PhiFontSubsetKey.Latin]: range(
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  ),
  [PhiFontSubsetKey.LatinExt]: range(
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  ),
  [PhiFontSubsetKey.Cyrillic]: range("U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"),
  [PhiFontSubsetKey.CyrillicExt]: range("U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F"),
  [PhiFontSubsetKey.Greek]: range("U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF"),
  [PhiFontSubsetKey.GreekExt]: range("U+1F00-1FFF"),
  [PhiFontSubsetKey.Vietnamese]: range(
    "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
  ),
  [PhiFontSubsetKey.Math]: range(
    "U+0302-0303, U+0305, U+0307-0308, U+0310, U+0312, U+0315, U+031A, U+0326-0327, U+032C, U+032F-0330, U+0332-0333, U+0338, U+033A, U+0346, U+034D, U+0391-03A1, U+03A3-03A9, U+03B1-03C9, U+03D1, U+03D5-03D6, U+03F0-03F1, U+03F4-03F5, U+2016-2017, U+2034-2038, U+203C, U+2040, U+2043, U+2047, U+2050, U+2057, U+205F, U+2070-2071, U+2074-208E, U+2090-209C, U+20D0-20DC, U+20E1, U+20E5-20EF, U+2100-2112, U+2114-2115, U+2117-2121, U+2123-214F, U+2190, U+2192, U+2194-21AE, U+21B0-21E5, U+21F1-21F2, U+21F4-2211, U+2213-2214, U+2216-22FF, U+2308-230B, U+2310, U+2319, U+231C-2321, U+2336-237A, U+237C, U+2395, U+239B-23B7, U+23D0, U+23DC-23E1, U+2474-2475, U+25AF, U+25B3, U+25B7, U+25BD, U+25C1, U+25CA, U+25CC, U+25FB, U+266D-266F, U+27C0-27FF, U+2900-2AFF, U+2B0E-2B11, U+2B30-2B4C, U+2BFE, U+3030, U+FF5B, U+FF5D, U+1D400-1D7FF, U+1EE00-1EEFF",
  ),
  [PhiFontSubsetKey.Symbols]: range(
    "U+0001-000C, U+000E-001F, U+007F-009F, U+20DD-20E0, U+20E2-20E4, U+2150-218F, U+2190, U+2192, U+2194-2199, U+21AF, U+21E6-21F0, U+21F3, U+2218-2219, U+2299, U+22C4-22C6, U+2300-243F, U+2440-244A, U+2460-24FF, U+25A0-27BF, U+2800-28FF, U+2921-2922, U+2981, U+29BF, U+29EB, U+2B00-2BFF, U+4DC0-4DFF, U+FFF9-FFFB, U+10140-1018E, U+10190-1019C, U+101A0, U+101D0-101FD, U+102E0-102FB, U+10E60-10E7E, U+1D2C0-1D2D3, U+1D2E0-1D37F, U+1F000-1F0FF, U+1F100-1F1AD, U+1F1E6-1F1FF, U+1F30D-1F30F, U+1F315, U+1F31C, U+1F31E, U+1F320-1F32C, U+1F336, U+1F378, U+1F37D, U+1F382, U+1F393-1F39F, U+1F3A7-1F3A8, U+1F3AC-1F3AF, U+1F3C2, U+1F3C4-1F3C6, U+1F3CA-1F3CE, U+1F3D4-1F3E0, U+1F3ED, U+1F3F1-1F3F3, U+1F3F5-1F3F7, U+1F408, U+1F415, U+1F41F, U+1F426, U+1F43F, U+1F441-1F442, U+1F444, U+1F446-1F449, U+1F44C-1F44E, U+1F453, U+1F46A, U+1F47D, U+1F4A3, U+1F4B0, U+1F4B3, U+1F4B9, U+1F4BB, U+1F4BF, U+1F4C8-1F4CB, U+1F4D6, U+1F4DA, U+1F4DF, U+1F4E3-1F4E6, U+1F4EA-1F4ED, U+1F4F7, U+1F4F9-1F4FB, U+1F4FD-1F4FE, U+1F503, U+1F507-1F50B, U+1F50D, U+1F512-1F513, U+1F53E-1F54A, U+1F54F-1F5FA, U+1F610, U+1F650-1F67F, U+1F687, U+1F68D, U+1F691, U+1F694, U+1F698, U+1F6AD, U+1F6B2, U+1F6B9-1F6BA, U+1F6BC, U+1F6C6-1F6CF, U+1F6D3-1F6D7, U+1F6E0-1F6EA, U+1F6F0-1F6F3, U+1F6F7-1F6FC, U+1F700-1F7FF, U+1F800-1F80B, U+1F810-1F847, U+1F850-1F859, U+1F860-1F887, U+1F890-1F8AD, U+1F8B0-1F8BB, U+1F8C0-1F8C1, U+1F900-1F90B, U+1F93B, U+1F946, U+1F984, U+1F996, U+1F9E9, U+1FA00-1FA6F, U+1FA70-1FA7C, U+1FA80-1FA89, U+1FA8F-1FAC6, U+1FACE-1FADC, U+1FADF-1FAE9, U+1FAF0-1FAF8, U+1FB00-1FBFF",
  ),
};

/** What a typeface has characters in: the named cuts, and its own characters outside all of them. */
export type PhiFontCoverage = {
  subsets: PhiFontSubsetKeyValue[];
  restRanges: PhiUnicodeRange[];
};

export function isPhiCodepointInRanges(codepoint: number, ranges: readonly PhiUnicodeRange[]) {
  return ranges.some(([start, end]) => codepoint >= start && codepoint <= end);
}

/** A `unicode-range` descriptor value. */
export function formatPhiUnicodeRange(ranges: readonly PhiUnicodeRange[]) {
  return ranges
    .map(([start, end]) => {
      const hex = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");
      return start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`;
    })
    .join(", ");
}

/** The ranges a cut covers for one typeface: the shared list for a named cut, the font's own for `Rest`. */
export function resolvePhiFontSubsetRanges(key: PhiFontSubsetKeyValue, coverage: PhiFontCoverage) {
  return key === PhiFontSubsetKey.Rest ? coverage.restRanges : PHI_FONT_SUBSET_RANGES[key];
}

export function isPhiFontSubsetKey(value: unknown): value is PhiFontSubsetKeyValue {
  return typeof value === "number" && (Object.values(PhiFontSubsetKey) as number[]).includes(value);
}
