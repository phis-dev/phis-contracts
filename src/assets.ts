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

export type PhiServerAddonAssetView = {
  id: string;
  slot: string;
  ownerId: string;
  /** The file itself, as Core records it. This is what a delivery URL is built from. */
  mediaAssetId: number;
  byteSize: number;
  contentType: string;
  /**
   * Present where the digest was established, absent where it could not be.
   *
   * Established means one of two things: the endpoint verified what the client stated and would have
   * refused anything else, or Core received the body and hashed it in flight. Absent is a truthful
   * "not established" -- an `etag` is an HTTP header and not a content hash, and a wrong digest here
   * would be worse than none, because it invites a comparison.
   */
  checksumSha256: string | null;
  createdAt: string;
};

/**
 * A place made for a file, and how to deliver it.
 *
 * The plan is the Provider's answer, not Core's: an endpoint that can take a body directly says so, and
 * one that cannot names a Core route to stream through. An Add-on passes it to its client unread.
 */
export type PhiServerAddonAssetReservationView = {
  /** What the transfer is carried out against, and what `finalize` is called with. */
  token: string;
  plan: PhiMediaUploadPlan;
  expiresAt: string;
};

export type PhiServerAssetsCapabilityV1 = {
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
  }): Promise<PhiServerAddonAssetReservationView>;
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
  }): Promise<PhiServerAddonAssetView>;
  /** Gives an unredeemed reservation up. An abandoned one expires on its own; this is the tidy path. */
  abandon(input: { table: string; token: string }): Promise<boolean>;
  /** The files of a row. A reservation in flight is not among them, because it is not a file yet. */
  list(input: {
    table: string;
    ownerId: string | number;
    slot?: string;
  }): Promise<PhiServerAddonAssetView[]>;
  /** Takes a file out of its slot, and the file with it. */
  remove(input: { table: string; id: string }): Promise<boolean>;
};
