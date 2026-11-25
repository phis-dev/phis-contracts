/**
 * A Site's CDN: files published once, served from a host of their own, never through a serving process.
 *
 * Three roads lead into Core's catalogue, and all three run one pipeline in Core: the operator's
 * `phis cdn publish`, a Maintainer's upload on the Admin page `CDN` (`cdn-admin:v1`), and an Add-on's
 * import through `cdn-publish:v1`. The catalogue holds every file offered under the Site's name, so Core
 * knows all of them and can withdraw any of them -- a file Core copied into the CDN bucket
 * (`storage: "cdn"`) and a file Core only links to where its source keeps it (`storage: "link"`).
 *
 * What an Add-on reads is that catalogue, through `cdn:v1`: it can list, link and count. What it may put
 * into it is bounded by Core and not by the Add-on: `cdn-publish:v1` hands Core an address, a size and a
 * SHA-256, and Core fetches the bytes itself, from hosts the operator allowed, under a name no other
 * origin holds, and of a type the CDN serves (`PhisCdnPublishCapabilityV1`). An Add-on never streams
 * bytes onto the public host, because a package that could would be a package that could plant them.
 *
 * A file's key is `<name>/<version>/<file>` and is its whole identity. A key is never written twice,
 * so a URL that delivered a file once delivers the same bytes for as long as it delivers anything.
 */

/**
 * One segment of a CDN key: a name or a file name, and the version as far as the version's own pattern
 * does not widen it (`PHIS_CDN_KEY_VERSION_PATTERN`).
 *
 * No slash, nothing a URL or a shell would have to escape beyond `+`, and no dot, tilde or colon as the
 * first character. A tilde is taken anywhere after the first character, because Debian versions sort a
 * prerelease with it (`1.0.0~beta.1-1`) and a file carries its version in its name
 * (`phis_1.0.0~beta.1-1+noble_amd64.deb`). Shared so a route that receives the three segments as path
 * parameters refuses exactly what publishing refuses: each segment against its own pattern.
 */
export const PHIS_CDN_KEY_SEGMENT_PATTERN = /^[A-Za-z0-9_+-][A-Za-z0-9._+~-]{0,199}$/u;

/**
 * The version segment of a CDN key: what `PHIS_CDN_KEY_SEGMENT_PATTERN` takes, and a colon as well,
 * neither as the first character.
 *
 * A colon stands where a Debian version names its epoch (`1:2.0-1`). It is a version's alone: a name or a
 * file name with one is refused, so the colon never reaches a file system or a download's file name. A
 * slash stays refused here as everywhere -- it would make a fourth segment.
 */
export const PHIS_CDN_KEY_VERSION_PATTERN = /^[A-Za-z0-9_+-][A-Za-z0-9._+~:-]{0,199}$/u;

/**
 * The operating systems a file is for, as bits (`PhisCdnFileV1.os`). Zero: not stated.
 *
 * Several bits are one file for several systems -- a script, an archive of Java. `Other` is a system this
 * list does not name. Bit 6 is free for one more before `Other`. iOS covers iPadOS.
 */
export const PhisCdnFileOs = {
  Linux: 1 << 0,
  Windows: 1 << 1,
  MacOS: 1 << 2,
  Android: 1 << 3,
  /** iOS and iPadOS. */
  IOS: 1 << 4,
  ChromeOS: 1 << 5,
  Other: 1 << 7,
} as const;

/** Every bit `PhisCdnFileOs` names. */
export const PHIS_CDN_FILE_OS_MASK =
  PhisCdnFileOs.Linux | PhisCdnFileOs.Windows | PhisCdnFileOs.MacOS | PhisCdnFileOs.Android |
  PhisCdnFileOs.IOS | PhisCdnFileOs.ChromeOS | PhisCdnFileOs.Other;

/**
 * The processor architectures a file is for, as bits (`PhisCdnFileV1.arch`). Zero: not stated, which is
 * also what a file for every architecture states -- a script, a document, a universal binary named once.
 */
export const PhisCdnFileArch = {
  X64: 1 << 0,
  Arm64: 1 << 1,
  X86: 1 << 2,
  Arm32: 1 << 3,
  RiscV64: 1 << 4,
} as const;

/** Every bit `PhisCdnFileArch` names. */
export const PHIS_CDN_FILE_ARCH_MASK =
  PhisCdnFileArch.X64 | PhisCdnFileArch.Arm64 | PhisCdnFileArch.X86 | PhisCdnFileArch.Arm32 |
  PhisCdnFileArch.RiscV64;

/**
 * Where a catalogued file's bytes are. `cdn`: Core copied them into the Site's CDN bucket, and the CDN
 * host serves them. `link`: Core keeps the entry and the source keeps the bytes; whoever offers the file
 * sends a visitor to the source's address.
 */
export type PhisCdnFileStorage = "cdn" | "link";

/** One published file, as `cdn:v1` hands it over. */
export type PhisCdnFileV1 = {
  /** `<name>/<version>/<file>`. */
  key: string;
  name: string;
  version: string;
  fileName: string;
  sizeBytes: number;
  /**
   * Lowercase hex of the whole file's SHA-256: computed by Core for a file it stored, stated by the source
   * for a link -- a link is never recorded without one.
   */
  sha256: string;
  contentType: string;
  /** ISO instant. */
  publishedAt: string;
  /**
   * The file's public address: for `storage: "cdn"` the CDN's base URL and the encoded key, for
   * `storage: "link"` the source's address, which Core recorded when the file was linked.
   */
  url: string;
  /**
   * Where the bytes are (`PhisCdnFileStorage`). A server from 0.8.1 on always states it; absent, from an
   * older one, the file is `cdn` -- the only kind there was.
   */
  storage?: PhisCdnFileStorage;
  /**
   * The operating systems the file is for, as `PhisCdnFileOs` bits; 0 where nobody stated them. A server
   * from 0.8.1 on always states it; absent reads as 0.
   */
  os?: number;
  /**
   * The architectures the file is for, as `PhisCdnFileArch` bits; 0 where nobody stated them. A server
   * from 0.8.1 on always states it; absent reads as 0.
   */
  arch?: number;
};

/**
 * The CDN capability: `@phis/server/cdn:v1`.
 *
 * Bound to the Site of the call. A Site without a CDN is not an error: `configured()` answers false and
 * every read answers empty, so an Add-on can offer CDN files wherever the operator set one up and stay
 * silent elsewhere. A file somebody withdrew is not listed and reads as null, whether or not its bytes
 * are still anywhere. Copied and linked files are read alike; `storage` tells them apart.
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

/**
 * A file an Add-on asks Core to fetch and publish (`PhisCdnPublishCapabilityV1.import`).
 *
 * Core fetches `url` itself: https on port 443 only, no credentials in the address, at most five
 * redirects, every host on the way on the operator's import host list, never a private, loopback or
 * link-local address. What the source answers is read once, hashed as it is read, and compared before
 * the upload is completed; nothing of it is kept where it does not match.
 *
 * A private source -- a release asset of a private repository -- is not supported yet. It is meant to
 * arrive as a further optional field, `credential`, naming one of the calling Add-on's own declared
 * secrets (never the value), which Core would send to the first host alone. Adding an optional field
 * breaks no caller, so the field is not reserved here; until it exists, a source that needs a credential
 * fails as `source-failed`. A link (`PhisCdnLinkRequestV1`) can never be private: a visitor follows it
 * without the Site's credentials.
 *
 * A request that is not of this shape -- a size that is not a positive integer, a `sha256` that is not
 * 64 lowercase hex digits, an address that does not parse, bits `PhisCdnFileOs` or `PhisCdnFileArch` do
 * not name -- is a fault of the caller and throws; a refusal answers what the caller could not know.
 */
export type PhisCdnImportRequestV1 = {
  /** Checked against `PHIS_CDN_KEY_SEGMENT_PATTERN`; `api` is reserved and refused as `invalid-key`. */
  name: string;
  /** Checked against `PHIS_CDN_KEY_VERSION_PATTERN`. */
  version: string;
  /** Checked against `PHIS_CDN_KEY_SEGMENT_PATTERN`. */
  fileName: string;
  /** Where Core fetches the file: https only, every hop on the operator's import host list. */
  url: string;
  /** What the source states. A different length aborts the import as `size-mismatch`. */
  sizeBytes: number;
  /**
   * Lowercase hex of the SHA-256 as the source states it; null where the source states none (an older
   * GitHub release asset). A different hash aborts the import as `checksum-mismatch`. Core records the
   * hash it computed either way.
   */
  sha256: string | null;
  /**
   * Absent: the type the file name's extension stands for. HTML, SVG, XML and JavaScript are refused as
   * `content-type-refused`, as `phis cdn publish` refuses them, and so is a source that answers HTML.
   */
  contentType?: string;
  /** `PhisCdnFileOs` bits. Absent: 0, not stated. */
  os?: number;
  /** `PhisCdnFileArch` bits. Absent: 0, not stated. */
  arch?: number;
};

/**
 * Why Core did not publish a file it was asked to import.
 *
 * - `not-configured`: the Site has no CDN.
 * - `invalid-key`: a segment does not hold its pattern, or the name is reserved (`api`).
 * - `name-not-yours`: the name holds files of another origin -- the operator's, a Maintainer's upload,
 *   another Add-on's. An Add-on imports only under a name that is new or holds nothing but its own.
 * - `key-taken`: the key is published with other bytes (another SHA-256), or was and has been withdrawn.
 *   Keys are never written twice; asking again answers the same.
 * - `busy`: an upload of this key is open elsewhere.
 * - `host-not-allowed`: the address, or a redirect, leaves https or the operator's import host list.
 * - `content-type-refused`: a type the CDN does not serve.
 * - `too-large`: larger than one object the Site's Media settings allow (`max_object_bytes`).
 * - `quota-exceeded`: storing it would pass the quota of the Site's Space, which copied CDN files count
 *   in. No quota, no such refusal.
 * - `size-mismatch`, `checksum-mismatch`: the source delivered other bytes than it stated.
 * - `source-failed`: the source did not deliver -- an HTTP status, a timeout, DNS, too many redirects.
 * - `storage-failed`: the CDN's storage did not take it.
 */
export type PhisCdnImportRefusalV1 =
  | "not-configured"
  | "invalid-key"
  | "name-not-yours"
  | "key-taken"
  | "busy"
  | "host-not-allowed"
  | "content-type-refused"
  | "too-large"
  | "quota-exceeded"
  | "size-mismatch"
  | "checksum-mismatch"
  | "source-failed"
  | "storage-failed";

/** What an import or a link that succeeded says besides the file, as bits (`flags` of the result). */
export const PhisCdnPublishResultFlags = {
  /**
   * The key was in the catalogue already with the same SHA-256 -- and, for a link, as a link -- so nothing
   * was fetched, stored or recorded; the file answered is the one that was there. What makes a call safe to
   * repeat: a job that lost its lease asks again and is told so.
   */
  Already: 1 << 0,
} as const;

/** What an import answers. `flags`: `PhisCdnPublishResultFlags`, 0 for a file published by this call. */
export type PhisCdnImportResultV1 =
  | { ok: true; file: PhisCdnFileV1; flags: number }
  | { ok: false; refusal: PhisCdnImportRefusalV1; message: string };

/**
 * A file an Add-on asks Core to record as a link (`PhisCdnPublishCapabilityV1.link`): the fields of an
 * import, without bytes moving.
 *
 * Core fetches nothing. It records the entry under the Site's name with the size and SHA-256 the source
 * states, so it knows every file offered there and can withdraw it like a copied one; whoever offers the
 * file sends a visitor to `url`. Without a SHA-256 there is no link: a visitor's download has to be
 * checkable against what the Site announced.
 *
 * A request that is not of this shape throws, as for `PhisCdnImportRequestV1`.
 */
export type PhisCdnLinkRequestV1 = Omit<PhisCdnImportRequestV1, "sha256"> & {
  /** Lowercase hex of the SHA-256 as the source states it. Required: a link is never recorded without. */
  sha256: string;
};

/**
 * Why Core did not record a link: those of an import that can apply where nothing is fetched or stored.
 *
 * `host-not-allowed` applies as for an import -- the address must be https and its host on the
 * operator's import host list -- because Core does not send a visitor under the Site's name anywhere the
 * operator has not named. `too-large` applies too (the Site's largest object); `quota-exceeded` does not,
 * because a link stores nothing.
 */
export type PhisCdnLinkRefusalV1 = Extract<
  PhisCdnImportRefusalV1,
  | "not-configured"
  | "invalid-key"
  | "name-not-yours"
  | "key-taken"
  | "busy"
  | "host-not-allowed"
  | "content-type-refused"
  | "too-large"
>;

/**
 * What a link answers. `flags`: `PhisCdnPublishResultFlags`; `Already` where the key was recorded with the
 * same SHA-256 before, as a link. A key published as a copy, or with another SHA-256, is `key-taken`.
 */
export type PhisCdnLinkResultV1 =
  | { ok: true; file: PhisCdnFileV1; flags: number }
  | { ok: false; refusal: PhisCdnLinkRefusalV1; message: string };

/**
 * `@phis/server/cdn-publish:v1`: putting a file into the Site's CDN catalogue from an address.
 *
 * Bound to the Site and to the calling Add-on, which becomes the file's origin. A job, a route or a
 * command gets it; an unverified hook does not. There is no withdraw and no delete: a file an Add-on
 * published is withdrawn on the Site's CDN page or with `phis cdn withdraw`.
 */
export type PhisCdnPublishCapabilityV1 = {
  /**
   * Fetches `url`, uploads it to `<name>/<version>/<file>` and records it, before it resolves.
   *
   * Idempotent: the same key with the same SHA-256 answers `ok` with `PhisCdnPublishResultFlags.Already`. Honours the
   * caller's signal (a job's lease); an aborted import leaves nothing behind, and the next one starts
   * from the beginning.
   */
  import(request: PhisCdnImportRequestV1, options?: { signal?: AbortSignal }): Promise<PhisCdnImportResultV1>;
  /**
   * Records `url` under `<name>/<version>/<file>` as a link (`storage: "link"`), before it resolves.
   * Idempotent as `import` is.
   */
  link(request: PhisCdnLinkRequestV1): Promise<PhisCdnLinkResultV1>;
};

/**
 * Where a catalogued file came from, as Core stores it (numbers in the database, names on the wire:
 * `PhisCdnFileOriginKind`).
 */
export const PhisCdnFileOrigin = {
  /** The operator's `phis cdn publish`, or `phis cdn check --adopt`. */
  Cli: 1,
  /** A Maintainer's upload on the Site's CDN page. */
  Upload: 2,
  /** An Add-on's import or link through `cdn-publish:v1`. */
  Addon: 3,
} as const;

/** The name of a `PhisCdnFileOrigin`, as the Admin API answers it. */
export type PhisCdnFileOriginKind = "cli" | "upload" | "addon";

/**
 * A file's state on the CDN page. `offered`: listed through `cdn:v1`. `withdrawn`: no longer offered, the
 * key stays taken. `deleted`: withdrawn and its bytes removed -- for a link, withdrawn and the entry kept,
 * since there were no bytes to remove.
 */
export type PhisCdnAdminFileState = "offered" | "withdrawn" | "deleted";

/** One file as the CDN page shows it: what `cdn:v1` hands over, and its state and origin. */
export type PhisCdnAdminFileV1 = PhisCdnFileV1 & {
  storage: PhisCdnFileStorage;
  os: number;
  arch: number;
  state: PhisCdnAdminFileState;
  origin: {
    kind: PhisCdnFileOriginKind;
    /** The Add-on that imported or linked it; null otherwise. */
    addonId: string | null;
    /** The person who uploaded it; null otherwise, and where the account is gone. */
    actorUserId: number | null;
    /** The address an Add-on's file was fetched from or links to; null otherwise. */
    sourceUrl: string | null;
  };
};

/** What the CDN of a Site is, as bits (`PhisCdnAdminListV1.cdn.flags`). */
export const PhisCdnAdminFlags = {
  /** The CDN's storage checks a signed SHA-256 of every part it is sent. */
  VerifiesSha256: 1 << 0,
} as const;

/** The largest page `GET /api/site/admin/cdn` answers. */
export const PHIS_CDN_ADMIN_PAGE_SIZE_MAX = 200;
/** The page it answers where the query names none. */
export const PHIS_CDN_ADMIN_PAGE_SIZE_DEFAULT = 50;

/** What `GET /api/site/admin/cdn` is asked, as its query parameters. */
export type PhisCdnAdminListQueryV1 = {
  /** Searched in name and file name. */
  q?: string;
  /** Exactly this name. */
  name?: string;
  /** Absent: `offered`. */
  state?: PhisCdnAdminFileState | "all";
  /** Absent: `publishedAt`. */
  sort?: "publishedAt" | "name";
  /** Absent: `desc`. */
  dir?: "desc" | "asc";
  /** From 1. Absent: 1. */
  page?: number;
  /** At most `PHIS_CDN_ADMIN_PAGE_SIZE_MAX`. Absent: `PHIS_CDN_ADMIN_PAGE_SIZE_DEFAULT`. */
  pageSize?: number;
};

/**
 * What `GET /api/site/admin/cdn` answers. A Site without a CDN answers `cdn: null` and no files rather
 * than an error, so the page can say how one is attached.
 */
export type PhisCdnAdminListV1 = {
  cdn: {
    publicBaseUrl: string;
    profileKey: string;
    /** `PhisCdnAdminFlags`. */
    flags: number;
  } | null;
  files: PhisCdnAdminFileV1[];
  total: number;
  page: number;
  pageSize: number;
};

/** What a Maintainer's upload starts with (`POST /api/site/admin/cdn/uploads`). */
export type PhisCdnUploadInitV1 = {
  /** Against `PHIS_CDN_KEY_SEGMENT_PATTERN`; `api` is reserved. */
  name: string;
  /** Against `PHIS_CDN_KEY_VERSION_PATTERN`. */
  version: string;
  /** Against `PHIS_CDN_KEY_SEGMENT_PATTERN`. */
  fileName: string;
  /** At most the Site's largest object (Media settings, `max_object_bytes`). */
  sizeBytes: number;
  /** Absent: the type of the extension. */
  contentType?: string;
  /** `PhisCdnFileOs` bits. Absent: 0. */
  os?: number;
  /** `PhisCdnFileArch` bits. Absent: 0. */
  arch?: number;
  /**
   * Lowercase hex of the SHA-256 of each part, in order, as the Media upload divides a file; one entry for
   * a file of one part. The same key, size and digests resume the upload that is open.
   */
  partSha256: string[];
};

/** Where an upload stands. `hashing`: all parts are in, and Core computes the whole file's SHA-256. */
export type PhisCdnUploadStatus = "pending" | "uploading" | "hashing" | "published" | "failed" | "aborted";

/** An upload, as every upload route answers it. */
export type PhisCdnUploadStateV1 = {
  token: string;
  state: PhisCdnUploadStatus;
  key: string;
  partSizeBytes: number;
  partCount: number;
  /** Part numbers the storage already holds. */
  uploaded: number[];
  /** ISO instant; an upload without a heartbeat until then is aborted. */
  expiresAt: string;
  heartbeatIntervalMs: number;
  /** Set once `published`. */
  file: PhisCdnAdminFileV1 | null;
  /** Set once `failed`. */
  error: { code: string; message: string } | null;
};

/** What a withdraw says besides the file, as bits (`PhisCdnAdminWithdrawResultV1.flags`). */
export const PhisCdnAdminWithdrawResultFlags = {
  /** The file was withdrawn already, and nothing changed. */
  AlreadyWithdrawn: 1 << 0,
} as const;

/** What `POST /api/site/admin/cdn/files/{name}/{version}/{file}/withdraw` answers. */
export type PhisCdnAdminWithdrawResultV1 = {
  file: PhisCdnAdminFileV1;
  /** `PhisCdnAdminWithdrawResultFlags`; 0 for a file this call withdrew. */
  flags: number;
};

/** What the CDN check found as a whole, as bits (`PhisCdnCheckReportV1.flags`). */
export const PhisCdnCheckReportFlags = {
  /** Bucket and catalogue agree: nothing unrecorded, nothing missing, no size differs. */
  Consistent: 1 << 0,
} as const;

/** What the check says of one object the catalogue does not hold, as bits (`unrecorded[].flags`). */
export const PhisCdnCheckObjectFlags = {
  /** `check/adopt` can take it into the catalogue; else `reason` says why not. */
  Adoptable: 1 << 0,
} as const;

/** What the CDN check finds (`POST /api/site/admin/cdn/check`, `phis cdn check`). Links are not checked. */
export type PhisCdnCheckReportV1 = {
  /** `PhisCdnCheckReportFlags`. */
  flags: number;
  /** Objects in the bucket. */
  objects: number;
  /** Copied files in the catalogue. */
  recorded: number;
  /** Objects the catalogue does not hold; `flags` as `PhisCdnCheckObjectFlags`. */
  unrecorded: { key: string; sizeBytes: number; flags: number; reason: string | null }[];
  /** Keys the catalogue offers and the bucket does not hold. */
  missing: string[];
  sizeMismatch: { key: string; recorded: number; stored: number }[];
};

/** The most keys one `POST /api/site/admin/cdn/check/adopt` takes. */
export const PHIS_CDN_ADOPT_KEYS_MAX = 20;

/** What `POST /api/site/admin/cdn/check/adopt` is asked. */
export type PhisCdnAdoptRequestV1 = { keys: string[] };

/** What it answers: the keys now in the catalogue (origin `cli`), and the others with the reason. */
export type PhisCdnAdoptResultV1 = {
  adopted: string[];
  refused: { key: string; reason: string }[];
};
