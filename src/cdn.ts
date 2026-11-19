/**
 * A Site's CDN: files published once, served from a host of their own, never through a serving process.
 *
 * The operator publishes with `phis cdn publish`, which uploads straight to the Site's CDN bucket and
 * records the file in Core's catalogue. What an Add-on gets is that catalogue, read-only: it can list,
 * link and count, and it cannot publish, for the reason it cannot write a secret -- a package that
 * could put bytes on a public host under the Site's name is a package that could plant them.
 *
 * A file's key is `<name>/<version>/<file>` and is its whole identity. A key is never written twice,
 * so a URL that delivered a file once delivers the same bytes for as long as it delivers anything.
 */

/**
 * One segment of a CDN key: a name, a version or a file name.
 *
 * No slash, no leading dot, nothing a URL or a shell would have to escape beyond `+`. Shared so a
 * route that receives the three segments as path parameters refuses exactly what publishing refuses.
 */
export const PHIS_CDN_KEY_SEGMENT_PATTERN = /^[A-Za-z0-9_+-][A-Za-z0-9._+-]{0,199}$/u;

/** One published file, as `cdn:v1` hands it over. */
export type PhisCdnFileV1 = {
  /** `<name>/<version>/<file>`. */
  key: string;
  name: string;
  version: string;
  fileName: string;
  sizeBytes: number;
  /** Lowercase hex of the whole file's SHA-256, computed by the publisher before the upload. */
  sha256: string;
  contentType: string;
  /** ISO instant. */
  publishedAt: string;
  /** The file's public address: the CDN's base URL and the encoded key. */
  url: string;
};

/**
 * The CDN capability: `@phis/server/cdn:v1`.
 *
 * Bound to the Site of the call. A Site without a CDN is not an error: `configured()` answers false and
 * every read answers empty, so an Add-on can offer CDN files wherever the operator set one up and stay
 * silent elsewhere. A file the operator withdrew is not listed and reads as null, whether or not its
 * bytes are still in the bucket.
 */
export type PhisCdnCapabilityV1 = {
  /** Whether this Site has a CDN at all. */
  configured(): Promise<boolean>;
  /** One file by its key, or null when it was never published or has been withdrawn. */
  file(key: string): Promise<PhisCdnFileV1 | null>;
  /**
   * The Site's offered files, ordered by name, then newest first within a name.
   *
   * `name` narrows to one name; `limit` defaults to and is capped at 500.
   */
  files(query?: { name?: string; limit?: number }): Promise<PhisCdnFileV1[]>;
};
