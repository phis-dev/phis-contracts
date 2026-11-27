import type { PhisPaymentSubscriptionId } from "./payments.js";
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
 * What is true of one entry, as bit flags (`PhisEntitlement.flags`). An entry with either bit does not
 * count. A source sets and clears `Suspended` through `update` (`setFlags`, `clearFlags`); `Revoked` only
 * `revoke` sets, and nothing clears.
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
  /**
   * Null: without an end. On an entry bound to a subscription it is not written by anybody: it is the end
   * of that subscription's latest paid period, as Core reads it now, without the grace -- the entry may
   * go on counting after it (`subscriptionId`), and `PhisEntitlementState.until` says until when.
   */
  readonly endsAt: string | null;
  /**
   * The subscription of `payments:v1` the entry follows, or null. A bound entry counts while the
   * subscription's paid period lasts and, as long as the subscription has not ended, for the
   * subscription's `graceDays` after it (0 to 30, set from what was sold and by an applied change) -- so a
   * renewal needs no write, a late payment does not switch anything off at once, and a period that stays
   * unpaid ends the entitlement by itself, as it ends the subscription. A change of the subscription's
   * terms needs no write either: the end is read from the latest paid period and the grace of then.
   */
  readonly subscriptionId: PhisPaymentSubscriptionId | null;
  /** Null on a product that does not count. */
  readonly quantity: number | null;
  /** `PhisEntitlementFlag`. */
  readonly flags: number;
  /**
   * Whether the entry counts now, and if not, why: `valid` -- neither flag, started, not ended (for a bound
   * entry: its subscription still carries it), and its product not locked. Otherwise the first that
   * applies, in this order: `revoked`, `suspended` (the flags), `product-locked`, `not-started` (`startsAt`
   * still ahead), `ended` (`endsAt` passed, or for a bound entry its subscription no longer carries it).
   */
  readonly standing: PhisEntitlementStanding;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Whether one entry counts now, and why not (`PhisEntitlement.standing`). */
export type PhisEntitlementStanding = "valid" | "not-started" | "ended" | "revoked" | "suspended" | "product-locked";

/**
 * Whether a subject holds a product now.
 *
 * Whoever holds a bundle holds each of its parts (`parts` of `products:v1`), also through a bundle inside a
 * bundle, so a supplier asks about its own product and never looks for the bundles it is sold in. The
 * entries that count are therefore the valid ones on the product itself and on every bundle that contains
 * it. A locked product passes nothing on: a locked part is held through no bundle, and a locked bundle --
 * held directly or inside another one -- gives none of its parts.
 *
 * `Entitled` (`flags`) is set while at least one of those entries is valid. `until` is the moment the answer
 * stops counting: the latest instant at which one of them stops counting, by the very rule that makes it
 * valid -- an entry's `endsAt`, and for an entry bound to a subscription its paid period's end plus the
 * subscription's `graceDays` while the subscription has not ended, the period's end once it has. So `until`
 * is never in the past while `Entitled` is set, also during the grace; it is null when one of them has no
 * end or nobody is entitled.
 * `quantity` is the product's own: on a counted product the sum over the valid entries on the product
 * itself -- 0 when it is held through bundles only, since a bundle is never counted -- and null on one that
 * does not count or when nobody is entitled; Core counts no use.
 */
export type PhisEntitlementState = {
  readonly product: PhisProductId;
  /** `PhisEntitlementStateFlag`. */
  readonly flags: number;
  readonly quantity: number | null;
  readonly until: string | null;
  /**
   * The products through which the subject holds this one now: the product itself when it has a valid
   * entry, then every bundle with a valid entry that contains it, directly or through nested bundles, in
   * id order. Empty when nobody is entitled.
   */
  readonly via: readonly PhisProductId[];
};

/** Bit flags of `PhisEntitlementState.flags`. */
export const PhisEntitlementStateFlag = {
  /** At least one counting entry, on the product or on a bundle containing it. */
  Entitled: 1 << 0,
} as const;

/** Bit flags of `list`'s `flags`. */
export const PhisEntitlementListFlag = {
  /**
   * With `product`: also the entries on every bundle that contains it, directly or through nested bundles,
   * whatever the bundle's state. Each entry is as it is -- its `product` is the bundle's id, its `standing`
   * the entry's own. Without `product` it changes nothing, since every entry of the subject is listed
   * already.
   */
  ResolveBundles: 1 << 0,
} as const;

/**
 * One entry named by what makes it unique -- its source, and that source's reference on that product --
 * and by whose it must be: `subject`, else the acting user's.
 */
export type PhisEntitlementEntryName = {
  source: string;
  reference: string;
  product: PhisProductId;
  subject?: PhisEntitlementSubject;
};

/** How many entries `listNamed` answers in one call: one page of a table. More are refused. */
export const PHIS_ENTITLEMENT_NAMED_MAX = 100;

/** How many entries `list` answers at most; a read that would answer more is refused rather than cut. */
export const PHIS_ENTITLEMENT_LIST_MAX = 500;

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
  /**
   * `check` for several products at once, in one read: one answer per product asked for, in the order
   * asked, duplicates answered once each where they stand. At most 100 products; more are refused. What
   * a licence for a bundle of twenty parts needs on every refresh, without twenty round trips.
   */
  checkMany(input: { products: readonly PhisProductId[]; subject?: PhisEntitlementSubject }): Promise<readonly PhisEntitlementState[]>;
  /**
   * The subject of another person of this Site, issued on first asking -- for staff acting on a
   * person's behalf, a licence granted by hand being the case that asked for it. Allowed only while the
   * acting user holds the Site access `accounting` or `support` (an Admin, an Accountant, a Supporter or
   * a Maintainer); refused otherwise, and refused with no acting user. Null for a user who is not a
   * member of this Site. The Add-on keeps the subject and never the user id, which it holds only for
   * this call.
   */
  subjectForUser(input: { userId: number }): Promise<PhisEntitlementSubject | null>;
  /**
   * Delivers `entitlement.changed` to this Add-on again, for every subject that holds `product` on this
   * Site now (directly or through a bundle containing it), in batches through Core's event outbox -- and
   * to no other Add-on. For an Add-on that starts acting on a product only later, such as a licence rule
   * added after purchases were made: its own handler then catches up on what it missed, and nobody has to
   * ask for it. Needs an acting user holding the Site access `accounting` (Admin, Accountant, Maintainer)
   * and a handler for `entitlement.changed` in the manifest; refused otherwise. Answers how many subjects
   * were queued; a second call while the first is still being delivered queues nothing new.
   */
  redeliver(input: { product: PhisProductId }): Promise<{ queued: number }>;
  /**
   * The entries behind an answer, of every source, valid or not: of one subject (`subject`, else the
   * acting user's), or of several at once (`subjects`) -- a table of people asked for its page in one
   * read rather than one per row. `subjects` and `subject` are not given together; at most 100 subjects,
   * more are refused, none answers no entries, and a subject that is nobody on this Site has none. The
   * same reading rule as for one subject, and the same answer: entries in id order, each naming its
   * subject. A read that would answer more than `PHIS_ENTITLEMENT_LIST_MAX` (500) entries is refused, never
   * cut short: ask for fewer subjects, or for one product.
   */
  list(input: {
    subject?: PhisEntitlementSubject;
    subjects?: readonly PhisEntitlementSubject[];
    product?: PhisProductId;
    /** `PhisEntitlementListFlag`; absent: 0, the product's own entries only. */
    flags?: number;
  }): Promise<readonly PhisEntitlement[]>;
  /**
   * Named entries in one read, for a table whose rows each stand for one entry -- a licence key per
   * purchase -- rather than one read per row. One answer per name, in the order asked: the entry of that
   * source, reference and product (of every source, as for `list`), or null where there is none or it is
   * not `subject`'s (else the acting user's) -- another person's entry is not found, never refused. At most
   * `PHIS_ENTITLEMENT_NAMED_MAX` (100) names, more are refused; none answers none. The same reading rule as
   * `list`.
   */
  listNamed(input: { entries: readonly PhisEntitlementEntryName[] }): Promise<readonly (PhisEntitlement | null)[]>;
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
    /**
     * Binds the entry to one of this source's own subscriptions; `endsAt` is then left out. Refused for a
     * subscription the calling Add-on did not create.
     */
    subscriptionId?: PhisPaymentSubscriptionId;
    quantity?: number | null;
  }): Promise<PhisEntitlement>;
  /**
   * Changes this source's own entry: a renewed period, a suspended one, one that stops following its
   * subscription. Null where it has none by that name.
   */
  update(input: {
    product: PhisProductId;
    reference: string;
    /** Refused on an entry that stays bound to a subscription, whose end Core reads from it. */
    endsAt?: string | null;
    quantity?: number | null;
    /** Bits of `PhisEntitlementFlag` to set; only `Suspended` is accepted. Absent: 0. */
    setFlags?: number;
    /** Bits of `PhisEntitlementFlag` to clear; only `Suspended` is accepted, and not together with `setFlags` naming it. Absent: 0. */
    clearFlags?: number;
    /**
     * `null`: the entry no longer follows its subscription and counts without an end, or until `endsAt`
     * where that is given in the same call -- a subscription converted into a purchase without an end keeps
     * its entry, and whatever hangs on the entry (a licence key) stays. Only away from a subscription, never
     * onto one; an entry not bound answers unchanged. Emits `entitlement.changed`.
     */
    subscriptionId?: null;
  }): Promise<PhisEntitlement | null>;
  /** Takes this source's own entry back for good. Null where it has none by that name. */
  revoke(input: { product: PhisProductId; reference: string }): Promise<PhisEntitlement | null>;
};

/**
 * Core's event when a subject's answer for a product may have changed: an entry was written, changed or
 * taken back, or one ended. It carries no state -- a handler reads the current answer through the
 * capability -- and reaches every enabled Add-on of the Site that declares a handler for it.
 *
 * An entry on a bundle changes the answer for its parts as well, so the event is also emitted once for
 * each part, directly or through nested bundles, with the part as `product`: one event per subject and
 * product, however many of the changed entries lead to it.
 */
export type PhisEntitlementChangedEventFacts = {
  event: "entitlement.changed";
  subject: { kind: "entitlement"; subject: PhisEntitlementSubject; product: PhisProductId };
};
