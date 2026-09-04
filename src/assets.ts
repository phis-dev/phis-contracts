import type { PhiMediaUploadPlan } from "./media-storage.js";

/**
 * Files on a row: `@phis/server/assets:v1`.
 *
 * The slots are declared in the schema descriptor -- a name, a cardinality, a size ceiling, the media
 * types it takes, who may fetch it -- and this is how they are filled. An Add-on says which row and
 * which slot; where the object goes, what it is called and whether it arrived are Core's answers.
 *
 * There is one upload lifecycle in Core and this is not a second one. Core reserves, receives, measures
 * and hashes without knowing who asked; the purpose stated here is read back at the last step, where
 * the finished object becomes a row in the Add-on's table.
 *
 * **No method takes an object key and none returns one.** A key an Add-on chooses is a key Core cannot
 * recognise later, and an object Core cannot recognise is one it can neither deliver nor account for.
 * What comes back instead is a Media Asset id, which the delivery Core already has takes.
 */

export type PhisAddonAssetView = {
  id: string;
  slot: string;
  ownerId: string;
  /** The file itself, as Core records it. */
  mediaAssetId: number;
  /**
   * Where the file is served from, Site-relative, as Core addresses its own Media.
   *
   * Given rather than left to be composed, because composing it means knowing two things an Add-on has
   * no way to be told: the route, and the cache revision it carries. A path built without the revision
   * still delivers the file and never gets an immutable cache -- every viewer revalidates every time,
   * and nothing about the result looks wrong enough to investigate.
   *
   * Read at the moment it is used, never stored. The revision rotates whenever the file's delivery
   * changes, and a path kept from an earlier read would then be the stale one it exists to retire.
   *
   * What the path answers with is the slot's `delivery`: `public` to anyone, `authenticated` to a
   * session, `internal` only to Core's own caller. The address is not the permission.
   */
  contentPath: string;
  byteSize: number;
  contentType: string;
  /**
   * The digest that was established, with the algorithm that produced it -- or null where none was.
   *
   * Established means one of two things: the endpoint verified what the client stated and would have
   * refused anything else, or Core received the body and hashed it in flight. Null is a truthful "not
   * established" -- an `etag` is an HTTP header and not a content hash, and a wrong digest here would
   * be worse than none, because it invites a comparison.
   *
   * The algorithm is part of the answer and not an assumption. Which one an endpoint can attest to
   * differs between Providers, so a bare value would be a number whose meaning the reader has to guess.
   */
  checksum: { algorithm: string; value: string } | null;
  createdAt: string;
};

/**
 * A place made for a file, and how to deliver it.
 *
 * The plan is the Provider's answer, not Core's: an endpoint that can take a body directly says so, and
 * one that cannot names a Core route to stream through. An Add-on passes it to its client unread.
 */
export type PhisAddonAssetReservationView = {
  /** What the transfer is carried out against, and what `finalize` is called with. */
  token: string;
  plan: PhiMediaUploadPlan;
  expiresAt: string;
};

export type PhisAssetsCapabilityV1 = {
  /**
   * Reserves a place for a file, before any of it is sent.
   *
   * The size is stated now and held to later, and the space is charged now rather than at the end. A
   * ceiling decided at the end would bound the bookkeeping and not the store: ten clients could each
   * write a gigabyte and have five of them refused afterwards, with the bytes already paid for.
   *
   * `sha256` is the client's statement of what it is about to send. Where the Storage Profile was found
   * to verify one, it is signed into the plan and the endpoint refuses anything else -- so a wrong
   * digest never becomes an object, and Core can record the figure as true without having seen a byte.
   * Where it was not, the body comes through Core and Core hashes it instead.
   *
   * Refused where the slot is not declared, where the type is not one it takes, where the size is over
   * the slot's ceiling or the Site's, where the Space is full, and where the acting user may not change
   * the row. Attaching a file to a row changes it, so it is the row's authority that decides.
   */
  begin(input: {
    table: string;
    ownerId: string | number;
    slot: string;
    contentType: string;
    sizeBytes: number;
    sha256?: string;
    /** What the file was called where it came from. Core makes one up when there is nothing to use. */
    filename?: string;
  }): Promise<PhisAddonAssetReservationView>;
  /**
   * Settles a reservation once the bytes are there, and makes the file a row.
   *
   * Core looks at what actually landed rather than believing the report: nothing there is not a file,
   * and a different size than was reserved is not a file either. On a single-valued slot the file being
   * replaced goes in the same transaction -- there is no moment in which the row holds two.
   *
   * Repeating it is safe. A client whose answer was lost cannot tell a finished upload from a failed
   * one, so a second call answers with the same file rather than with an error.
   */
  finalize(input: {
    table: string;
    token: string;
    /** Whatever the plan's issuer asked the client to bring back. Core passes it through unread. */
    completion?: unknown;
  }): Promise<PhisAddonAssetView>;
  /** Gives an unredeemed reservation up. An abandoned one expires on its own; this is the tidy path. */
  abandon(input: { table: string; token: string }): Promise<boolean>;
  /**
   * The files of a row. A reservation in flight is not among them, because it is not a file yet.
   *
   * Refused where the acting user may not read the row. Asking what a row carries is reading the row,
   * and a slot's `delivery` does not answer it: a file whose id, name and size come back to anyone has
   * already given up most of what `internal` was keeping.
   */
  list(input: {
    table: string;
    ownerId: string | number;
    slot?: string;
  }): Promise<PhisAddonAssetView[]>;
  /**
   * Takes a file out of its slot, and the file with it.
   *
   * Refused where the acting user may not change the row, which is the same authority `begin` is
   * measured against -- taking a file away changes the row exactly as putting one there does. A file
   * that is not there answers `false` rather than refusing, because a refusal would say it exists.
   */
  remove(input: { table: string; id: string }): Promise<boolean>;
  /**
   * What this Add-on's files take up on this Site, and what they are allowed to.
   *
   * Here for the reason `storage:v1` has the same call: the ceiling is the operator's and Core enforces
   * it whether or not anybody read this first, so this exists to let an Add-on say *why*. A refusal an
   * interface can explain before a person picks a file beats one that arrives after they waited for the
   * upload, and a vendor who can see they are at their limit does not report it as a fault.
   *
   * The two figures are separate because both are spent. `bytes` is what is stored; `reservedBytes` is
   * held for uploads in flight and is as unavailable as stored bytes until they finish or lapse. Room
   * for one more file is `quotaBytes - (bytes + reservedBytes)`, which is the comparison `begin` makes.
   *
   * `quotaBytes` is the effective ceiling after inheritance -- the Space's own override where there is
   * one, the Site's default for Add-on Spaces otherwise -- so it is the figure that will actually be
   * applied and not a raw column. `null` means no ceiling. An explicit `0` is a revocation, not an
   * absence.
   *
   * No object count, unlike `storage:v1`. Core keeps a running total of bytes and none of files, and
   * counting them on demand would be the unbounded read the ceiling exists to prevent.
   */
  usage(): Promise<{
    bytes: number;
    reservedBytes: number;
    quotaBytes: number | null;
  }>;
};
