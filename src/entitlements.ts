/**
 * Entitlements: who is entitled to what, from when until when (`entitlements:v1`).
 *
 * The neutral fact between the one who sells and the one who provides. A source -- a shop, later a
 * reconciler of App Store purchases -- states that a subject is entitled to a kind; whoever provides the
 * thing reads whether. Core owns the entries and the rules, so neither needs to see the other's tables,
 * and the Site's operator says which source may write which kind.
 *
 * The vocabulary is neutral on purpose. Licence keys, devices, seats, prices, products and courses are
 * not Core's words: what being entitled *means* is the business of the Add-on that declared the kind.
 */

/**
 * A kind of entitlement, named under the Add-on that uses it: `@scope/name:key`.
 *
 * The declaring Add-on's id is the first half, as with an emitted event, so two Add-ons cannot name the
 * same kind. The key is `^[a-z][a-z0-9.-]*$`.
 */
export type PhisEntitlementKindId = `@${string}/${string}:${string}`;

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

/** A kind as the installed manifests declare it; the catalogue a source's settings page offers. */
export type PhisEntitlementKind = {
  readonly id: PhisEntitlementKindId;
  /** The Add-on that declared it and says what it means. */
  readonly addonId: string;
  readonly title: string;
  readonly description: string | null;
  /** Whether entries of this kind carry a quantity that adds up. */
  readonly counted: boolean;
};

/** One source's statement that a subject is entitled to a kind. */
export type PhisEntitlement = {
  readonly id: number;
  readonly kind: PhisEntitlementKindId;
  readonly subject: PhisEntitlementSubject;
  /** The Add-on that wrote it, or `PHIS_ENTITLEMENT_CORE_SOURCE`. */
  readonly source: string;
  /** The source's own name for it -- an order number -- unique per source and kind. */
  readonly reference: string;
  readonly startsAt: string;
  /** Null: without an end. */
  readonly endsAt: string | null;
  /** Null on a kind that does not count. */
  readonly quantity: number | null;
  readonly flags: number;
  /** Whether the entry counts now: neither flag, started, not ended. */
  readonly valid: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * Whether a subject is entitled to a kind now.
 *
 * `entitled` is true while at least one entry is valid. `quantity` is the sum over the valid entries of a
 * counted kind, null otherwise; Core counts no use. `until` is the latest end among the valid entries,
 * null when one of them has none or nobody is entitled.
 */
export type PhisEntitlementState = {
  readonly kind: PhisEntitlementKindId;
  readonly entitled: boolean;
  readonly quantity: number | null;
  readonly until: string | null;
};

/**
 * `entitlements:v1`.
 *
 * Reading is open to every Add-on that requires the capability. Writing is for a source the Site's admin
 * allowed for the kind -- and for the Add-on that declared the kind, which needs nobody's leave for its
 * own. A source manages its own entries and nobody else's: another source's entry is not found, never
 * refused. An unverified hook reaches none of it.
 *
 * A subject may be left out where somebody is acting: it is then theirs.
 */
export type PhisEntitlementsCapabilityV1 = {
  /** The kinds the Site's enabled Add-ons declare. */
  kinds(): Promise<readonly PhisEntitlementKind[]>;
  /** The acting user's subject, issued on first asking; null when nobody is acting. */
  subject(): Promise<PhisEntitlementSubject | null>;
  check(input: { kind: PhisEntitlementKindId; subject?: PhisEntitlementSubject }): Promise<PhisEntitlementState>;
  /** The entries behind an answer, of every source, valid or not. */
  list(input: { subject?: PhisEntitlementSubject; kind?: PhisEntitlementKindId }): Promise<readonly PhisEntitlement[]>;
  /**
   * This source's statement. Idempotent on `(kind, reference)`: a second grant answers the entry the
   * first one wrote and changes nothing, which is what lets a payment handler be delivered twice.
   */
  grant(input: {
    subject: PhisEntitlementSubject;
    kind: PhisEntitlementKindId;
    reference: string;
    /** Absent: now. */
    startsAt?: string;
    endsAt?: string | null;
    quantity?: number | null;
  }): Promise<PhisEntitlement>;
  /** Changes this source's own entry: a renewed period, a suspended one. Null where it has none by that name. */
  update(input: {
    kind: PhisEntitlementKindId;
    reference: string;
    endsAt?: string | null;
    quantity?: number | null;
    suspended?: boolean;
  }): Promise<PhisEntitlement | null>;
  /** Takes this source's own entry back for good. Null where it has none by that name. */
  revoke(input: { kind: PhisEntitlementKindId; reference: string }): Promise<PhisEntitlement | null>;
};

/**
 * Core's event when a subject's answer for a kind may have changed: an entry was written, changed or
 * taken back, or one ended. It carries no state -- a handler reads the current answer through the
 * capability -- and reaches every enabled Add-on of the Site that declares a handler for it.
 */
export type PhisEntitlementChangedEventFacts = {
  event: "entitlement.changed";
  subject: { kind: "entitlement"; subject: PhisEntitlementSubject; entitlementKind: PhisEntitlementKindId };
};
