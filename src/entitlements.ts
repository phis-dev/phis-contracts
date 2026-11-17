import type { PhisProductId } from "./products.js";

/**
 * Entitlements: who holds which product, from when until when (`entitlements:v1`).
 *
 * The neutral fact between the one who sells and the one who supplies. A source -- a shop, later a
 * reconciler of App Store purchases -- states that a subject holds a product of the Site's directory
 * (`products:v1`); the product's supplier reads whether. Core owns the entries and the rules, so neither
 * needs to see the other's tables, and the Site's operator says which source may write.
 *
 * What holding a product *means* -- a licence key, a download, a seat -- is the business of the Add-on
 * that supplies it. Prices, keys and devices are not Core's words.
 */

/**
 * Who is entitled: a reference Core issues, one per person and Site, and never a user id.
 *
 * An Add-on learns the subject of the acting user and may store it -- a shop on an order, a licence
 * Add-on beside a key -- and two Add-ons of one Site hold the same reference for the same person, which
 * is what lets a purchase in one become a right in the other. Whose it is, only Core knows.
 */
export type PhisEntitlementSubject = string;

/** The source of an entry Core's operator wrote by hand; every other source is an Add-on's id. */
export const PHIS_ENTITLEMENT_CORE_SOURCE = "@phis/server" as const;

/**
 * What is true of one entry, as bit flags. An entry with either bit does not count.
 *
 * Two bits and not one, because they are taken back differently: a revoked entry is over, a suspended one
 * waits -- a period whose payment failed and is being retried.
 */
export const PhisEntitlementFlag = {
  Revoked: 1 << 0,
  Suspended: 1 << 1,
} as const;

/** One source's statement that a subject holds a product. */
export type PhisEntitlement = {
  readonly id: number;
  readonly product: PhisProductId;
  readonly subject: PhisEntitlementSubject;
  /** The Add-on that wrote it, or `PHIS_ENTITLEMENT_CORE_SOURCE`. */
  readonly source: string;
  /** The source's own name for it -- an order number -- unique per source and product. */
  readonly reference: string;
  readonly startsAt: string;
  /** Null: without an end. */
  readonly endsAt: string | null;
  /** Null on a product that does not count. */
  readonly quantity: number | null;
  readonly flags: number;
  /** Whether the entry counts now: neither flag, started, not ended, and its product not locked. */
  readonly valid: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * Whether a subject holds a product now.
 *
 * `entitled` is true while at least one entry is valid. `quantity` is the sum over the valid entries of a
 * counted product, null otherwise; Core counts no use. `until` is the latest end among the valid entries,
 * null when one of them has none or nobody is entitled.
 */
export type PhisEntitlementState = {
  readonly product: PhisProductId;
  readonly entitled: boolean;
  readonly quantity: number | null;
  readonly until: string | null;
};

/**
 * `entitlements:v1`.
 *
 * Reading is open to every Add-on that requires the capability. Writing is for a source the Site's
 * operator allowed -- for every product, or for the products of the suppliers the operator named -- and
 * for a supplier on its own product that is `free`, which needs nobody's leave. A source manages its own
 * entries and nobody else's: another source's entry is not found, never refused. An unverified hook
 * reaches none of it.
 *
 * A new entry is refused for a product that is not `active`. An entry that exists is changed and taken
 * back whatever became of its product.
 *
 * A subject may be left out where somebody is acting: it is then theirs.
 */
export type PhisEntitlementsCapabilityV1 = {
  /** The acting user's subject, issued on first asking; null when nobody is acting. */
  subject(): Promise<PhisEntitlementSubject | null>;
  check(input: { product: PhisProductId; subject?: PhisEntitlementSubject }): Promise<PhisEntitlementState>;
  /** The entries behind an answer, of every source, valid or not. */
  list(input: { subject?: PhisEntitlementSubject; product?: PhisProductId }): Promise<readonly PhisEntitlement[]>;
  /**
   * This source's statement. Idempotent on `(product, reference)`: a second grant answers the entry the
   * first one wrote and changes nothing, which is what lets a payment handler be delivered twice.
   */
  grant(input: {
    subject: PhisEntitlementSubject;
    product: PhisProductId;
    reference: string;
    /** Absent: now. */
    startsAt?: string;
    endsAt?: string | null;
    quantity?: number | null;
  }): Promise<PhisEntitlement>;
  /** Changes this source's own entry: a renewed period, a suspended one. Null where it has none by that name. */
  update(input: {
    product: PhisProductId;
    reference: string;
    endsAt?: string | null;
    quantity?: number | null;
    suspended?: boolean;
  }): Promise<PhisEntitlement | null>;
  /** Takes this source's own entry back for good. Null where it has none by that name. */
  revoke(input: { product: PhisProductId; reference: string }): Promise<PhisEntitlement | null>;
};

/**
 * Core's event when a subject's answer for a product may have changed: an entry was written, changed or
 * taken back, or one ended. It carries no state -- a handler reads the current answer through the
 * capability -- and reaches every enabled Add-on of the Site that declares a handler for it.
 */
export type PhisEntitlementChangedEventFacts = {
  event: "entitlement.changed";
  subject: { kind: "entitlement"; subject: PhisEntitlementSubject; product: PhisProductId };
};
