/**
 * The Site's Media library, as an Add-on may read it (`@phis/server/media:v1`) and give up an Asset it
 * used (`@phis/server/media-release:v1`).
 *
 * An Add-on that keeps Media Asset ids of its own -- a cover, an icon, a gallery, in columns that point
 * at `core.mediaAsset` -- has to show them and has to know, when one is saved, whether a visitor would
 * be served it. `assets:v1` answers only for the files in this Add-on's own slots, and `products:v1`
 * only for a product's picture; this answers for an Asset by its id. A slot is the file a row owns; a
 * `core.mediaAsset` column is an Asset a person chose from the Site's library -- phis's `ADDON_HOWTO.md`,
 * "A picture for an Add-on row", decides between them.
 *
 * What is in reach is what `products:v1` accepts as a picture: an Asset of the calling Site that lies in
 * the Site's Space or in this Add-on's own Add-on Space. An Asset of a User's or a Group's Space, of
 * another Add-on's Space, of another Site, or of no row at all is absent from the answer, the same way in
 * every case, so the answer tells nothing about what exists elsewhere.
 */

/** The most ids one `get` takes. */
export const PHIS_MEDIA_GET_MAX_IDS = 200;

/** One Asset of the Media library, as `media:v1` hands it over. */
export type PhisMediaAssetV1 = {
  id: number;
  /** The file name the Asset was uploaded or imported under. */
  name: string;
  /** The Asset's title in the Site's source language; null without one. */
  title: string | null;
  contentType: string;
  /** Null while the size is not known yet. */
  byteSize: number | null;
  /** In pixels, for an image whose dimensions Core measured; null otherwise. */
  width: number | null;
  height: number | null;
  /** The Asset's alternative text in the Site's source language; null without one. */
  alt: string | null;
  /** `PhisMediaAssetV1Flag`: whether Core serves the Asset to a visitor (`Servable`). */
  flags: number;
  /**
   * Where the Asset is served from, Site-relative, as Core addresses its own Media -- with the cache
   * revision, as `assets:v1` gives `contentPath` and `products:v1` gives `imagePath`. Null exactly where
   * `Servable` is not set.
   *
   * Read at the moment it is used and never stored: the revision rotates whenever the Asset's delivery
   * changes, and a path kept from an earlier read is then the stale one.
   */
  path: string | null;
  /**
   * Where Core serves the Asset's thumbnail and its preview, Site-relative, as the Media library's own
   * listing addresses them -- with the cache revision and the variant version, so read them when used and
   * never store them, as `path`. Core makes these variants of an image Asset only: null for any other
   * kind, and null wherever `Servable` is not set.
   */
  thumbnailPath: string | null;
  previewPath: string | null;
  /** A tiny blurred stand-in for an image Asset, as a `data:` URL, to show while it loads; null without one. */
  blurDataUrl: string | null;
};

/** Bit flags of `PhisMediaAssetV1.flags`. */
export const PhisMediaAssetV1Flag = {
  /**
   * Core serves the Asset to a visitor: it is ready and delivered publicly. The check `products:v1` makes
   * before it takes an Asset as a product's picture, and the one to make before an Asset id is saved for
   * something a visitor will see.
   */
  Servable: 1 << 0,
} as const;

/**
 * The Media library capability: `@phis/server/media:v1`.
 *
 * Bound to the Site and to the calling Add-on; neither is an argument. Read-only.
 *
 * An unverified hook -- a public read point, where nobody is signed in -- is answered only the Assets a
 * visitor is served (`Servable` set); the others are absent there, as an Asset out of reach is.
 */
export type PhisMediaCapabilityV1 = {
  /**
   * The Assets in reach among `ids`, at most `PHIS_MEDIA_GET_MAX_IDS`, each once, in the order of their
   * first mention. An id out of reach is left out, never refused; an id that is not a positive integer
   * is refused.
   */
  get(input: { ids: readonly number[] }): Promise<PhisMediaAssetV1[]>;
};

/**
 * The most ids one `release` takes, the bound `get` has. Each is its own transaction and, where it goes,
 * its own store delete, so the bound keeps one call inside a request; a longer list is released in parts.
 */
export const PHIS_MEDIA_RELEASE_MAX_IDS = 200;

/**
 * What became of one released Asset.
 *
 * `deleted`: nothing referenced it any more, and Core deleted it the way the Media library does. `kept`:
 * something still references it, or it lies in a locked Folder; nothing happened, which is not an error,
 * and what holds it is not said. `not-found`: no Asset of the Site's Space by that id -- whether it never
 * existed, is gone, belongs to another Site or lies in another Space is not said either.
 */
export type PhisMediaReleaseOutcome = "deleted" | "kept" | "not-found";

export type PhisMediaReleaseResultV1 = {
  id: number;
  released: PhisMediaReleaseOutcome;
};

/**
 * Giving up Assets of the Site's Media library: `@phis/server/media-release:v1`.
 *
 * A grant of its own, apart from `media:v1`, because it may delete what the Site's people uploaded: an
 * operator reads in the manifest's `requiredCoreCapabilities` that this Add-on can, and an Add-on that
 * only shows Assets declares `media:v1` alone.
 *
 * Bound to the Site and to the calling Add-on. Only Assets of the Site's Space are in reach; a file of
 * this Add-on's own slots goes the `assets:v1` way, and every other Space answers `not-found`. Refused
 * to an unverified hook.
 */
export type PhisMediaReleaseCapabilityV1 = {
  /**
   * Gives up this Add-on's use of the Assets among `ids`, at most `PHIS_MEDIA_RELEASE_MAX_IDS`, each
   * answered once, in the order of its first mention.
   *
   * **Clear your own references first.** Core counts every reference there is -- a Page, Navigation,
   * Content, an Area or a Theme (in any revision still pointed at), a product's picture, a message's
   * attachment, and every `core.mediaAsset` column of every installed Add-on, the caller's own included --
   * and deletes an Asset only where that count is zero. An Add-on that still names the Asset in one of
   * its rows has not given it up, and the Asset is `kept`.
   *
   * The check and the delete are one transaction holding the Asset's row lock. Every counted reference
   * is a foreign key on the Asset, and writing one waits for that lock, so a reference cannot slip in
   * between: it either was there before (`kept`) or fails afterwards because the Asset is gone. An Asset
   * id an Add-on keeps where no foreign key holds it -- a plain number, a text -- is not a reference Core
   * can see.
   */
  release(input: { ids: readonly number[] }): Promise<PhisMediaReleaseResultV1[]>;
};
