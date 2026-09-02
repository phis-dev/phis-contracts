import type { PhiMediaUploadPlan } from "./media-storage.js";

/**
 * Files on a row: `@phis/server/assets:v1`.
 *
 * The slots are declared in the schema descriptor -- a name, a cardinality, a size ceiling, the media
 * types it takes -- and this is how they are filled. What an Add-on does here is say which row and which
 * slot; where the object goes, what it is called and whether it arrived are Core's answers.
 *
 * That division is the whole reason the capability exists rather than an Add-on writing keys through
 * `storage:v1`. A key an Add-on chooses is a key Core cannot recognise later, and an object Core cannot
 * recognise is one it can neither collect nor account for. Here the key is derived, the row records it,
 * and the row cascades with the parent -- so the file of a deleted row stops being a file nobody
 * remembers and becomes one the sweep will find.
 *
 * There is no method that takes an object key, and none that returns one.
 */

export type PhiServerAddonAssetView = {
  id: string;
  slot: string;
  ownerId: string;
  byteSize: number;
  contentType: string;
  /** Present only where the endpoint that received the bytes verifies a digest. Never asserted. */
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
  id: string;
  plan: PhiMediaUploadPlan;
  expiresAt: string;
};

export type PhiServerAssetsCapabilityV1 = {
  /**
   * Reserves a place for a file, before any of it is sent.
   *
   * The size is stated now and held to later. A client that reserves a kilobyte and delivers a gigabyte
   * is refused by comparison rather than by trust, and the ceiling is charged against a figure that was
   * agreed before the first byte moved -- a size discovered afterwards is one the store has already
   * paid for.
   *
   * Refused where the slot is not declared, where the type is not one the slot takes, where the size is
   * over the slot's ceiling or the Site's, where the store is full, and where the acting user may not
   * change the row. Attaching a file to a row changes it, so it is the row's authority that decides.
   */
  begin(input: {
    table: string;
    ownerId: string | number;
    slot: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PhiServerAddonAssetReservationView>;
  /**
   * Settles a reservation once the bytes are there, and makes the file visible.
   *
   * Core looks at what actually landed rather than believing the report: an object that is not there, or
   * is a different size than was reserved, does not become a file. On a single-valued slot the file
   * being replaced is removed in the same transaction -- there is no moment in which the row has two.
   */
  finalize(input: {
    table: string;
    id: string;
    /** Whatever the plan's issuer asked the client to bring back. Core passes it through unread. */
    completion?: unknown;
  }): Promise<PhiServerAddonAssetView>;
  /** Gives an unredeemed reservation up. An abandoned one expires on its own; this is the tidy path. */
  abandon(input: { table: string; id: string }): Promise<boolean>;
  /** The finished files of a row. A reservation in flight is not among them, because it is not a file. */
  list(input: {
    table: string;
    ownerId: string | number;
    slot?: string;
  }): Promise<PhiServerAddonAssetView[]>;
  /** Removes one file and its object, and gives the space back. */
  remove(input: { table: string; id: string }): Promise<boolean>;
};
