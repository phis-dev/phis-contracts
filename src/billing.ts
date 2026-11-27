import type { PhisEntitlementSubject } from "./entitlements.js";
import type {
  PhisPaymentId,
  PhisPaymentMoney,
  PhisPaymentRefundId,
  PhisPaymentSubscriptionId,
  PhisPaymentTaxCategory,
} from "./payments.js";

/**
 * Billing documents: every invoice, receipt, credit note, reminder and confirmation of a Site, in one place
 * (`billing:v1`).
 *
 * Core keeps them -- the Provider's, fetched after a captured payment or a succeeded refund
 * (`PhisPaymentProviderV1.listDocuments`), and the merchant's own, issued by Add-ons -- in its own private
 * storage, never the Media library, an Add-on's store or a public address. It numbers the issued ones from
 * the Site's number series, gap-free, and shows a person all of theirs in their own App space and staff
 * all of them in the Accounting Area (the Core module "Billing"). No Add-on owns the list: the documents
 * come from several issuers, and each Add-on works without the others.
 *
 * A document is immutable once issued: kind, number, issuer, content, subject, reference and links never
 * change. Only the file (once), the status, `paymentState`, `Credited` and `Detached` move. A correction
 * is a credit note, never an edit; cancelling an available invoice is a credit note of its remaining
 * total. Core does not render PDFs: an issuer renders its file after `issue` has given it its number.
 *
 * Who reads what (Core checks it for the acting user, by the Site role and never by the broader Site
 * access `accounting`, which also includes Maintainers):
 *
 * - the person: their own documents (`subject` theirs), every issuer, never detached ones; opens them;
 * - Admin and Accountant: every document of the Site; open them;
 * - a Supporter: the list of the requester of a support ticket they may work on while it is open, through
 *   Core's ticket route only, without `content` and without `open`;
 * - a Maintainer: nothing;
 * - an Add-on (machine): the documents it issued and those of its own sales (`consumerAddonId`); across
 *   issuers by `subject` only for an acting user who is that person, or Admin or Accountant; a file only
 *   through `open`, for an acting user who may open it by these rules.
 *
 * Retention: `retainUntil` is the end of the calendar year of `issuedAt` plus ten years, for every issuer,
 * Provider copies under Merchant of Record included; then Core removes the file and the record. A person's
 * deletion request inside that time detaches (`Detached`) rather than deletes.
 */

export type PhisBillingDocumentId = string;

/**
 * What a document is. A Provider produces `invoice`, `receipt` and `credit-note`; an Add-on may issue all
 * five. `confirmation` is a seller's confirmation of what was paid, never a tax invoice.
 */
export type PhisBillingDocumentKind = "invoice" | "credit-note" | "reminder" | "receipt" | "confirmation";

/** The kinds numbered from a number series; `receipt` and `confirmation` carry their issuer's own number. */
export type PhisBillingNumberedDocumentKind = "invoice" | "credit-note" | "reminder";

/** A party as printed on a document. */
export type PhisBillingParty = {
  name: string;
  /** The address lines as printed, without the name and the country. */
  addressLines: readonly string[];
  postalCode: string | null;
  city: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** The tax number as printed ("CHE-123.456.789 MWST"); `null` where none is printed. */
  taxId: string | null;
};

/** Who issued a document in law: the merchant, or the Provider as Merchant of Record ("Sold through Link, LLC"). */
export type PhisBillingDocumentIssuer = {
  kind: "merchant" | "provider";
  name: string;
  taxId: string | null;
};

/** Where a document came from: fetched from a Provider Add-on, or issued by an Add-on. */
export type PhisBillingDocumentSource = {
  kind: "provider" | "addon";
  /** `@phis/stripe` for a Provider's; `@phis/invoices` or `@phis/shop` for an issued one. */
  addonId: string;
};

/** One line of an issued document, as printed. */
export type PhisBillingDocumentLine = {
  description: string;
  /** A decimal string as printed: "1", "2.5". */
  quantity: string;
  /** The unit as printed ("h", "pcs"); `null` where none. */
  unit: string | null;
  /** The price of one unit as printed, in minor units of the document's currency (`PhisPaymentMoney.minor`). */
  unitMinor: string;
  /** The line's amount as printed, in minor units of the document's currency. */
  lineMinor: string;
  /** Display-only decimal string ("8.1"); `null` where no tax applies. Never enters Core arithmetic. */
  taxRate: string | null;
  taxCategory: PhisPaymentTaxCategory;
  servicePeriod: { from: string; to: string } | null;
};

/** What an issued document says, structured; its file prints the same. */
export type PhisBillingDocumentContent = {
  locale: string;
  currency: string;
  /** `final`: the line amounts contain the tax; `net`: it is added. */
  basis: "final" | "net";
  seller: PhisBillingParty;
  /** The buyer as addressed; `null` for a receipt or confirmation without an address. */
  buyer: PhisBillingParty | null;
  lines: readonly PhisBillingDocumentLine[];
  totals: {
    net: PhisPaymentMoney;
    taxes: readonly { rate: string; base: PhisPaymentMoney; tax: PhisPaymentMoney }[];
    total: PhisPaymentMoney;
  };
  servicePeriod: { from: string; to: string } | null;
  notes: string | null;
  /** How a merchant's invoice or reminder is to be paid; `null` for every other document. */
  payment: {
    dueAt: string;
    /** The creditor reference as printed (QR reference or ISO 11649 `RF...`); `null` where none. */
    reference: string | null;
    iban: string | null;
    /** The Swiss QR bill's payload as encoded (`SPC` 0200 ...), so it can be shown again without the file; `null` where none. */
    swissQr: string | null;
  } | null;
};

/** Bit flags of `PhisBillingDocument.flags`. */
export const PhisBillingDocumentFlag = {
  /**
   * Never completed: its file did not follow (Core voids an issued document still `pending` after 24 hours,
   * reason "not completed"), or its issuer withdrew it before it was available. Its number stays used.
   */
  Voided: 1 << 0,
  /** Corrected in full by credit notes (`correctsId`); it stays as it was issued. */
  Credited: 1 << 1,
  /** Its person asked to be deleted: `subject` is gone; kept for the retention period and listed in nobody's own space. */
  Detached: 1 << 2,
} as const;

/** What is known of a merchant invoice's payment, set by its issuer. */
export type PhisBillingPaymentState = "open" | "partially-paid" | "paid" | "written-off";

/** One billing document of the Site. */
export type PhisBillingDocument = {
  id: PhisBillingDocumentId;
  kind: PhisBillingDocumentKind;
  /** As printed: from a number series for an issued invoice, credit note or reminder, the issuer's own for the others, the Provider's for its documents; `null` where none. */
  number: string | null;
  /** A line for lists: "PhiVoice AI Pro, yearly", "Order 2611-ABCDEF". */
  label: string;
  issuer: PhisBillingDocumentIssuer;
  source: PhisBillingDocumentSource;
  issuedAt: string;
  total: PhisPaymentMoney;
  /** What the customer saw and paid in their local currency where the Provider converted; informational, `null` otherwise. */
  presentment: PhisPaymentMoney | null;
  /**
   * `pending`: the record exists, its file is still to come (fetched from the Provider, or attached by the
   * issuer). `available`: it can be opened. `voided`: never completed (`Voided`). `failed`: fetching it
   * from the Provider was given up after 14 days of retries.
   */
  status: "pending" | "available" | "voided" | "failed";
  /** The file; `null` for a receipt or confirmation issued without one, which Core shows from `content`, and while none is stored. */
  file: { contentType: "application/pdf" | "text/html"; byteSize: number; sha256: string } | null;
  /** The structured content of an issued document; `null` for a Provider's, whose file is all there is. */
  content: PhisBillingDocumentContent | null;
  /** For a merchant's invoice or reminder: what is known of its payment; `null` for every other document. */
  paymentState: { state: PhisBillingPaymentState; paidMinor: string; at: string } | null;
  /** Whose document it is: the buyer's subject; `null` for a guest's purchase and once detached. */
  subject: PhisEntitlementSubject | null;
  /** The Add-on whose sale it documents (the Shop). */
  consumerAddonId: string;
  /** That sale's reference: an order or subscription number. */
  reference: string;
  payment: { paymentId: PhisPaymentId; refundId: PhisPaymentRefundId | null } | null;
  subscription: { subscriptionId: PhisPaymentSubscriptionId; periodIndex: number | null } | null;
  /** The document this one corrects or refers to: a credit note's or a reminder's invoice; `null` otherwise. */
  correctsId: PhisBillingDocumentId | null;
  /** Until when Core keeps it; then the file and the record go. */
  retainUntil: string;
  /** `PhisBillingDocumentFlag`. */
  flags: number;
  createdAt: string;
  version: number;
};

/** What an Add-on hands Core to issue a document of the merchant's own. */
export type PhisBillingDocumentIssueInput = {
  kind: PhisBillingDocumentKind;
  /** The key of the series it is numbered from: required for `invoice`, `credit-note` and `reminder`, refused for the others. */
  series?: string;
  /** The issuer's own number, for `receipt` and `confirmation` only; unique per source. */
  number?: string;
  /** The same key answers the document it issued before, and refuses other content (`idempotency_conflict`). */
  idempotencyKey: string;
  label: string;
  /** Whose document it is; `null` for a guest's purchase. */
  subject: PhisEntitlementSubject | null;
  /** The Add-on whose sale it documents; absent: the issuer itself. Only an Add-on whose manifest names the issuer in `billing.issuedBy`. */
  consumerAddonId?: string;
  reference: string;
  /** Absent: now. */
  issuedAt?: string;
  issuer: PhisBillingDocumentIssuer & { kind: "merchant" };
  content: PhisBillingDocumentContent;
  /** For a credit note (required) or a reminder (required): the invoice it corrects or refers to. */
  correctsId?: PhisBillingDocumentId;
  payment?: { paymentId: PhisPaymentId; refundId: PhisPaymentRefundId | null } | null;
  subscription?: { subscriptionId: PhisPaymentSubscriptionId; periodIndex: number | null } | null;
  /** `follows`: the PDF is attached next, once the number is known. `none`: no file; only for `receipt` and `confirmation`. */
  file: "follows" | "none";
};

export type PhisBillingNumberSeriesId = string;

/** `yearly`: the serial starts at 1 again on 1 January in the Site's time zone; `none`: it never does. */
export type PhisBillingNumberSeriesReset = "none" | "yearly";

/**
 * The longest number a series may generate, in characters: the template rendered with the serial at its
 * minimum width must fit. A serial that later grows past its minimum width is never cut and never closes
 * the series.
 */
export const PHIS_BILLING_DOCUMENT_NUMBER_MAX_LENGTH = 40;

/**
 * A Site's number series. Defined by Admin or Accountant in the Accounting Area (or the operator's CLI);
 * read-only to Add-ons.
 *
 * The template is literal text and tokens:
 *
 * - `{x...}`: the serial, exactly once; the number of `x` (at least one) is its **minimum** width,
 *   zero-padded, and past it the serial keeps counting with more digits (`{xxxxx}`: `00042`, and after
 *   `99999` comes `100000`);
 * - `{YYYY}`: the issue year, four digits, in the Site's time zone;
 * - `{YY}`: the issue year, two digits;
 * - `{MM}`: the issue month, two digits -- shown only; it never resets the serial.
 *
 * Each year or month token at most once, no other `{...}`, literal text only of `A-Z a-z 0-9 - _ / .`
 * without spaces, and a `yearly` reset requires `{YYYY}` or `{YY}`. `PHI-{YY}{xxxxx}` with a yearly reset
 * numbers `PHI-2600001` first in 2026, and `PHI-2699999` is followed by `PHI-26100000`.
 *
 * Numbers are allocated by `issue`, atomically and without gaps, in the document's transaction; a voided
 * document's number is a used number, not a gap. Once a series has numbered a document (`Used`), its key,
 * template and reset never change and its kinds can only grow; a new template is a new series with the
 * same key, which closes the old one in the same step. At most one open series per key.
 */
export type PhisBillingNumberSeries = {
  id: PhisBillingNumberSeriesId;
  /** What `issue` names ("invoice", "credit-note", "reminder"); at most one open series per key. */
  key: string;
  /** For people: "Invoices 2027 onwards". */
  label: string;
  /** "PHI-{YY}{xxxxx}" (above). */
  template: string;
  reset: PhisBillingNumberSeriesReset;
  kinds: readonly PhisBillingNumberedDocumentKind[];
  /** The Add-ons that may number from it. */
  sources: readonly string[];
  /** The number the next `issue` would get now; a preview, nothing is reserved. */
  next: string;
  /** `PhisBillingNumberSeriesFlag`. */
  flags: number;
  createdAt: string;
  closedAt: string | null;
};

/** Bit flags of `PhisBillingNumberSeries.flags`. */
export const PhisBillingNumberSeriesFlag = {
  /** No longer numbers anything; its issued documents stay. */
  Closed: 1 << 0,
  /** It has numbered a document: key, template and reset are fixed, kinds can only be added. */
  Used: 1 << 1,
} as const;

/**
 * `billing:v1`.
 *
 * Reading is open to every Add-on that requires the capability, by the access rules above. Issuing is
 * for an Add-on the Site's operator allowed as a source (`phis billing source allow`), for the kinds
 * allowed to it, from a series that names it in `sources`; its manifest declares that it issues
 * (`billing.issues`). A Provider's documents are never issued; Core fetches them. An unverified hook
 * reaches none of it.
 */
export interface PhisBillingCapabilityV1 {
  /**
   * Documents, newest first, by the access rules above; every filter given narrows. `limit` defaults to 50
   * and is at most 100; `cursor` is the answer's, `null` on the last page.
   */
  list(input: {
    subject?: PhisEntitlementSubject;
    /** The sales' references (order or subscription numbers) of this Add-on's own sales; at most 100. */
    references?: readonly string[];
    paymentId?: PhisPaymentId;
    subscriptionId?: PhisPaymentSubscriptionId;
    periodIndex?: number;
    kinds?: readonly PhisBillingDocumentKind[];
    cursor?: string | null;
    limit?: number;
  }): Promise<{ documents: readonly PhisBillingDocument[]; cursor: string | null }>;
  /** One document by the access rules above; `null` where there is none this caller may read. */
  get(documentId: PhisBillingDocumentId): Promise<PhisBillingDocument | null>;
  /**
   * A short-lived address the file (or, without a file, Core's view of `content`) is served from to the
   * browser that asked: valid for `ttlSeconds` (default 300, at most 900), for this one document,
   * `Cache-Control: private, no-store`. Needs an acting user who may open the document; a document not
   * `available` is refused (`invalid_state`).
   */
  open(input: {
    documentId: PhisBillingDocumentId;
    disposition: "inline" | "attachment";
    ttlSeconds?: number;
  }): Promise<{ url: string; expiresAt: string }>;
  /**
   * Writes the document and, for a numbered kind, allocates its number from the series in the same
   * transaction. From here its content never changes. With `file: "follows"` it is `pending` until
   * `attachFile`; with `none` it is `available` at once. A credit note is refused where the credited
   * total would pass the corrected invoice's; one that reaches it sets `Credited` on the invoice.
   */
  issue(input: PhisBillingDocumentIssueInput): Promise<PhisBillingDocument>;
  /** The PDF of a `pending` issued document, once and by its issuer; Core checks size and digest while it stores it. Then `available`. */
  attachFile(input: {
    documentId: PhisBillingDocumentId;
    contentType: "application/pdf";
    byteSize: number;
    sha256: string;
    body: ReadableStream<Uint8Array>;
  }): Promise<PhisBillingDocument>;
  /**
   * Withdraws an issued document that is still `pending` (never shown to anybody), by its issuer: `voided`,
   * its number stays used and listed for staff with the reason. An `available` document is never
   * withdrawn; it is corrected or cancelled by a credit note of its remaining total.
   */
  void(input: { documentId: PhisBillingDocumentId; reason: string }): Promise<PhisBillingDocument>;
  /** What is known of a merchant invoice's or reminder's payment, by its issuer only; the content stays as issued. */
  setPaymentState(input: {
    documentId: PhisBillingDocumentId;
    state: PhisBillingPaymentState;
    /** Minor units of the document's currency paid so far. */
    paidMinor: string;
    at: string;
  }): Promise<PhisBillingDocument>;
  /** The open series this Add-on may number from. */
  listSeries(): Promise<readonly PhisBillingNumberSeries[]>;
}

/**
 * What an Add-on's manifest says about billing documents (`PhisAddonManifestV1.billing`).
 *
 * `issues`: the kinds it issues into `billing:v1`, so the operator sees them before allowing it as a
 * source; absent: none. `issuedBy`: the Add-ons that may issue documents for this Add-on's sales
 * (`consumerAddonId`), by id; absent: none.
 */
export type PhisAddonBillingDescriptor = {
  issues?: readonly PhisBillingDocumentKind[];
  issuedBy?: readonly string[];
};

/**
 * Core's event when a document was issued, became available, was voided, credited, its payment state
 * changed, or fetching it was given up. It carries no state -- a handler reads the document -- and reaches
 * the document's source Add-on and, where different, its consumer Add-on.
 */
export type PhisBillingDocumentChangedEventFacts = {
  event: "billing-document.changed";
  subject: { kind: "billing-document"; documentId: PhisBillingDocumentId; reference: string; version: number };
};
