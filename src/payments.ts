/**
 * The approved v1 Payment agreement. Core owns execution; consumers own prices and commerce.
 *
 * Execution belongs to Core; its implemented capability, service and event identities live in core.ts.
 * These declarations contain no SDK, credentials, persistence or exchange-rate conversion. See phis-server's
 * PAYMENTS.md and PAYMENTS_STRIPE.md for authority, durability and Provider mapping requirements.
 *
 * `amount` is always the consumer's base amount. Under a pricing policy other than `final`/`none` the
 * Provider adds tax, shipping and discounts on top of it and reports the customer's total with its parts
 * (PAYMENTS.md section 12); authorized, captured and refunded funds are measured against that total.
 *
 * Every yes/no fact here is a bit of a `flags` number, read against the flag object named beside it
 * (`PhisPaymentFlag`, `PhisPaymentFeatureFlag`, ...), never a boolean: a bit that is not set is "no".
 */

import type { PhisBillingDocumentIssuer } from "./billing.js";
import type { PhisEntitlementSubject } from "./entitlements.js";

export type PhisPaymentId = string;
export type PhisPaymentOperationId = string;
export type PhisPaymentRefundId = string;

export type PhisPaymentMoney = {
  /** Uppercase ISO currency code; one agreed currency for the whole payment. */
  currency: string;
  /** Canonical non-negative integer string of minor units, never floating-point money. */
  minor: string;
};

/**
 * How many minor units make one major unit, as a power of ten, for every currency a payment may name:
 * ISO 4217 minor-unit exponents, SIX List One, retrieved 2026-10-04. `CHF: 2` means 1 franc is 100
 * Rappen, `JPY: 0` that the yen has none. A currency absent here is not one a payment accepts.
 *
 * Shared rather than Core's own because everybody who shows or reads a `minor` needs it: phis-server
 * validates a payment against it, and a Site's money field converts what a person types with it.
 */
export const PHIS_PAYMENT_CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  AED: 2,
  AFN: 2,
  ALL: 2,
  AMD: 2,
  AOA: 2,
  ARS: 2,
  AUD: 2,
  AWG: 2,
  AZN: 2,
  BAM: 2,
  BBD: 2,
  BDT: 2,
  BHD: 3,
  BIF: 0,
  BMD: 2,
  BND: 2,
  BOB: 2,
  BOV: 2,
  BRL: 2,
  BSD: 2,
  BTN: 2,
  BWP: 2,
  BYN: 2,
  BZD: 2,
  CAD: 2,
  CDF: 2,
  CHE: 2,
  CHF: 2,
  CHW: 2,
  CLF: 4,
  CLP: 0,
  CNY: 2,
  COP: 2,
  COU: 2,
  CRC: 2,
  CUP: 2,
  CVE: 2,
  CZK: 2,
  DJF: 0,
  DKK: 2,
  DOP: 2,
  DZD: 2,
  EGP: 2,
  ERN: 2,
  ETB: 2,
  EUR: 2,
  FJD: 2,
  FKP: 2,
  GBP: 2,
  GEL: 2,
  GHS: 2,
  GIP: 2,
  GMD: 2,
  GNF: 0,
  GTQ: 2,
  GYD: 2,
  HKD: 2,
  HNL: 2,
  HTG: 2,
  HUF: 2,
  IDR: 2,
  ILS: 2,
  INR: 2,
  IQD: 3,
  IRR: 2,
  ISK: 0,
  JMD: 2,
  JOD: 3,
  JPY: 0,
  KES: 2,
  KGS: 2,
  KHR: 2,
  KMF: 0,
  KPW: 2,
  KRW: 0,
  KWD: 3,
  KYD: 2,
  KZT: 2,
  LAK: 2,
  LBP: 2,
  LKR: 2,
  LRD: 2,
  LSL: 2,
  LYD: 3,
  MAD: 2,
  MDL: 2,
  MGA: 2,
  MKD: 2,
  MMK: 2,
  MNT: 2,
  MOP: 2,
  MRU: 2,
  MUR: 2,
  MVR: 2,
  MWK: 2,
  MXN: 2,
  MXV: 2,
  MYR: 2,
  MZN: 2,
  NAD: 2,
  NGN: 2,
  NIO: 2,
  NOK: 2,
  NPR: 2,
  NZD: 2,
  OMR: 3,
  PAB: 2,
  PEN: 2,
  PGK: 2,
  PHP: 2,
  PKR: 2,
  PLN: 2,
  PYG: 0,
  QAR: 2,
  RON: 2,
  RSD: 2,
  RUB: 2,
  RWF: 0,
  SAR: 2,
  SBD: 2,
  SCR: 2,
  SDG: 2,
  SEK: 2,
  SGD: 2,
  SHP: 2,
  SLE: 2,
  SOS: 2,
  SRD: 2,
  SSP: 2,
  STN: 2,
  SVC: 2,
  SYP: 2,
  SZL: 2,
  THB: 2,
  TJS: 2,
  TMT: 2,
  TND: 3,
  TOP: 2,
  TRY: 2,
  TTD: 2,
  TWD: 2,
  TZS: 2,
  UAH: 2,
  UGX: 0,
  USD: 2,
  USN: 2,
  UYI: 0,
  UYU: 2,
  UYW: 4,
  UZS: 2,
  VED: 2,
  VES: 2,
  VND: 0,
  VUV: 0,
  WST: 2,
  XAD: 2,
  XAF: 0,
  XCD: 2,
  XCG: 2,
  XOF: 0,
  XPF: 0,
  YER: 2,
  ZAR: 2,
  ZMW: 2,
  ZWG: 2,
};

/** A `minor` as phis-server accepts one: no sign, no leading zero, 16 digits at most. */
const PHIS_PAYMENT_MINOR_PATTERN = /^(0|[1-9][0-9]{0,15})$/u;

/**
 * A minor amount as the major amount it is, written with a point: `"1990"` with exponent 2 is
 * `"19.90"`, `"5"` is `"0.05"`; with exponent 0 the digits are the amount.
 *
 * Done on the digits, never by dividing: `1990 / 100` is a float, and a float carries no more than 15
 * or so digits faithfully, which is fewer than a `minor` may have.
 */
export function phisMinorToMajorAmount(minor: string, exponent: number): string {
  if (exponent === 0) return minor;
  const digits = minor.padStart(exponent + 1, "0");
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/**
 * An amount of money as a person reading `locale` writes it: `CHF 19.90` in de-CH, `19,90 €` in de-DE,
 * `¥1,990` in ja-JP, with exactly as many places as the currency has (`PHIS_PAYMENT_CURRENCY_EXPONENTS`),
 * never a fixed two.
 *
 * The amount reaches `Intl.NumberFormat` as a decimal string, which it formats exactly, so no digit of
 * `minor` passes through a float. A currency a payment does not accept, or a `minor` that is not one,
 * throws a `RangeError`: what cannot be a payment's money has no right way to be shown as one, and the
 * caller that read the value is the one that knows what to show instead.
 */
export function formatPhisMoney(money: PhisPaymentMoney, locale: string): string {
  const exponent = Object.hasOwn(PHIS_PAYMENT_CURRENCY_EXPONENTS, money.currency)
    ? PHIS_PAYMENT_CURRENCY_EXPONENTS[money.currency]
    : undefined;
  if (exponent === undefined) throw new RangeError(`"${money.currency}" is not a currency a payment accepts.`);
  if (!PHIS_PAYMENT_MINOR_PATTERN.test(money.minor)) throw new RangeError(`"${money.minor}" is not an amount in minor units.`);
  const key = `${locale}\u0000${money.currency}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(phisMinorToMajorAmount(money.minor, exponent) as Intl.StringNumericLiteral);
}

export type PhisPaymentCaptureMode = "automatic" | "manual";
export type PhisPaymentCheckoutKind = "redirect" | "provider-ui";

/**
 * What a method is wanted for; absent means `one-time`. `recurring` asks for the methods that can collect
 * a subscription in at least one collection mode under the probed pricing policy, each with its
 * `collection`: a method with `collection.automatic` also declares `stored` (it is stored while the
 * customer is present and charged later without them), one with `collection.paymentRequest` alone
 * declares no `stored` (the customer pays each period on its checkout).
 */
export type PhisPaymentUsage = "one-time" | "recurring";

/**
 * What a Provider can do with one payment method once it is stored. Declared per method, because it
 * differs per method and per Provider: Core holds no list of method names and assumes none of this.
 */
export type PhisPaymentStoredFeatures = {
  /** How a stored method comes into being with the customer present. */
  setup: readonly ("with-payment" | "alone")[];
  /** `notified`: the outcome of a charge may arrive later; `immediate`: only in the command's answer. */
  chargeResult: "notified" | "immediate";
  /** `PhisPaymentStoredFeatureFlag`. */
  flags: number;
  /** `single`: a new stored method for the same payer replaces the previous one at the Provider. */
  perPayer: "single" | "many";
  /** The pricing policies a charge without a checkout supports; often narrower than the checkout's. */
  pricing: PhisPaymentPricingFeatures;
};

/** Bit flags of `PhisPaymentStoredFeatures.flags`. */
export const PhisPaymentStoredFeatureFlag = {
  /** The stored method ends by itself; the record then carries `expiresAt`. */
  Expires: 1 << 0,
} as const;

/**
 * What one method can do, declared by the Provider in `probe` for one amount, capture mode, checkout kind,
 * pricing selector and usage. Because it is asked per pricing selector, every field is the answer **under
 * that pricing policy**: a method may store under `tax: "none"` and not under `merchant-of-record`, or name
 * the merchant as the documents' issuer under one and the Provider under the other. Core and a consumer
 * read these declarations and never a Provider's name.
 */
export type PhisPaymentFeatures = {
  captureModes: readonly PhisPaymentCaptureMode[];
  checkoutKinds: readonly PhisPaymentCheckoutKind[];
  /** `PhisPaymentFeatureFlag`. */
  flags: number;
  pricing: PhisPaymentPricingFeatures;
  /** Absent or `null`: this method cannot be stored. That is every Provider built before stored methods. */
  stored?: PhisPaymentStoredFeatures | null;
  /**
   * How long after `create` its checkout may be made to end (`PhisPaymentCreateInput.expiresAt`), in whole
   * seconds from the moment Core accepts the payment, both ends included. Absent or `null`: the method's
   * checkout ends when the Provider decides and cannot be given an end.
   */
  checkoutExpiry?: PhisPaymentCheckoutExpiryFeatures | null;
  /** How a subscription can be collected with this method under the probed policy. Absent or `null`: not at all. */
  collection?: PhisPaymentCollectionFeatures | null;
  /** How amounts and currencies reach the customer and the merchant under the probed policy. */
  currency: PhisPaymentCurrencyFeatures;
  /** The documents the Provider issues for this method's payments under the probed policy. Absent or `null`: none. */
  documents?: PhisPaymentDocumentFeatures | null;
};

/** Bit flags of `PhisPaymentFeatures.flags`: what a method can do with a payment once it exists. */
export const PhisPaymentFeatureFlag = {
  /** `capture` may take less than was authorized. */
  PartialCapture: 1 << 0,
  /** `cancel` is possible before capture. */
  Cancel: 1 << 1,
  /** `refund` is possible after capture. */
  Refund: 1 << 2,
  /** `refund` may return less than was captured, more than once; only together with `Refund`. */
  PartialRefund: 1 << 3,
} as const;

/** The interval units and lengths a collection mode can run. */
export type PhisPaymentIntervalFeatures = {
  units: readonly PhisPaymentInterval["unit"][];
  /** The longest period in days the mode accepts; `null`: no limit beyond Core's own. */
  maxDays: number | null;
};

/**
 * How a subscription can be collected with one method under one pricing policy, per collection mode
 * (`PhisPaymentCollectionMode`). `null` for a mode: not with this method under this policy.
 */
export type PhisPaymentCollectionFeatures = {
  /** Core charges a stored method without the customer; requires `stored`. */
  automatic: PhisPaymentIntervalFeatures | null;
  /** Core asks the customer to pay each period on this method's checkout; needs no `stored`. */
  paymentRequest: PhisPaymentIntervalFeatures | null;
  /**
   * The Provider runs the schedule. **Prepared, not built:** Core records such a declaration as not usable,
   * never answers it from `chooseCollection`, and refuses `provider-managed` with `unsupported_operation`.
   */
  providerManaged: PhisPaymentScheduleFeatures | null;
};

/** How a Provider shares the unused part of a period when a subscription it runs changes. */
export type PhisPaymentProration = "time-share" | "none";

/** What a Provider that runs a subscription's schedule (`provider-managed`) can do with it. Prepared, not built. */
export type PhisPaymentScheduleFeatures = PhisPaymentIntervalFeatures & {
  /** What `executeSubscription` with `action: "change"` the Provider can carry out. */
  changes: {
    timings: readonly PhisPaymentSubscriptionChangeTiming[];
    proration: readonly PhisPaymentProration[];
  };
  /** How the charged method is replaced: on a Provider page the customer is sent to, or not at all. */
  methodReplacement: "provider-page" | "none";
  /** Retries are the Provider's; the consumer's dunning policy does not apply. */
  dunning: "provider";
  /** `PhisPaymentScheduleFeatureFlag`. */
  flags: number;
};

/** Bit flags of `PhisPaymentScheduleFeatures.flags`. A currency never changes on a running subscription. */
export const PhisPaymentScheduleFeatureFlag = {
  /** A change may change the interval, not only the price. */
  IntervalChange: 1 << 0,
  /** The customer can cancel or change the subscription at the Provider, outside phis; Core applies it as a fact. */
  ChangedOutside: 1 << 1,
} as const;

/** How amounts and currencies reach the customer and the merchant with one method under one pricing policy. */
export type PhisPaymentCurrencyFeatures = {
  /**
   * `single`: one amount in one currency per payment, charged as stated. `per-currency`: the Provider can
   * hold the consumer's own amount for several currencies and charge the customer's (Stripe Prices with
   * `currency_options`).
   */
  amounts: "single" | "per-currency";
  /**
   * Conversion into the customer's local currency where the payment's currency is not it: `none`;
   * `optional`, the consumer may turn it on; `mandatory`, always on (Stripe Adaptive Pricing under Managed
   * Payments). Converted amounts are informational (`PhisPaymentObservedTotals.presentment`); the payment
   * stays in its currency.
   */
  conversion: "none" | "optional" | "mandatory";
  /**
   * The payment currencies in which that conversion is offered at all; a payment in any other currency is
   * presented as stated, whatever `conversion` says. Uppercase ISO codes; empty with `conversion: "none"`.
   */
  conversionCurrencies: readonly string[];
  /** Who bears a conversion's cost when it happens; `null` where there is no conversion. */
  conversionCost: "customer" | "merchant" | null;
  /**
   * Read-only: the currencies the merchant's account at the Provider settles in without conversion, as the
   * Provider reports them (Stripe: the currencies of the account's payout bank accounts). A payment in
   * another currency is converted into one of them at the merchant's cost. Payout accounts and payouts are
   * configured at the Provider and never through phis. Uppercase ISO codes; empty: the Provider does not say.
   */
  settlementCurrencies: readonly string[];
  /** `PhisPaymentCurrencyFeatureFlag`. */
  flags: number;
};

/** Bit flags of `PhisPaymentCurrencyFeatures.flags`. */
export const PhisPaymentCurrencyFeatureFlag = {
  /**
   * The Provider reports what each payment and refund settled (`observeSettlements`); Core asks only for a
   * payment whose method declared it under the payment's policy.
   */
  SettlementRecords: 1 << 0,
} as const;

/** A document a Provider issues for a payment or a refund. */
export type PhisPaymentProviderDocumentKind = "invoice" | "receipt" | "credit-note";

/** The documents a Provider issues for one method's payments under one pricing policy. */
export type PhisPaymentDocumentFeatures = {
  kinds: readonly {
    kind: PhisPaymentProviderDocumentKind;
    /** `PhisPaymentDocumentFeatureFlag`. */
    flags: number;
  }[];
  /** Who issues them in law under the probed policy. `name` `null`: the merchant, by the profile's identity. */
  issuer: { kind: "merchant" | "provider"; name: string | null; taxId: string | null };
};

/** Bit flags of one `PhisPaymentDocumentFeatures.kinds` entry. */
export const PhisPaymentDocumentFeatureFlag = {
  /** Core can fetch the file (`fetchDocument`); without it the Provider issues the document and gives no file. Core collects only these. */
  Fetchable: 1 << 0,
  /** It may still be in the making after capture or refund; Core asks again later. */
  Delayed: 1 << 1,
} as const;

/** The earliest and the latest end a method's checkout can be given, in seconds after the payment is created. */
export type PhisPaymentCheckoutExpiryFeatures = {
  minSeconds: number;
  maxSeconds: number;
};

export type PhisPaymentMethod = {
  profileKey: string;
  methodKey: string | null;
  title: string;
  features: PhisPaymentFeatures;
};

export type PhisPaymentCheckoutPlan =
  | {
      kind: "redirect";
      url: string;
      expiresAt: string | null;
    }
  | {
      kind: "provider-ui";
      moduleId: string;
      adapterKey: string;
      parameters: Readonly<Record<string, string>>;
      expiresAt: string | null;
    };

export type PhisPaymentStatus =
  | "created"
  | "awaiting_customer"
  | "processing"
  | "authorized"
  | "captured"
  | "canceled"
  | "expired"
  | "failed";

export type PhisPayment = {
  id: PhisPaymentId;
  reference: string;
  profileKey: string;
  mode: "test" | "live";
  /** The consumer's base amount; the customer pays `totals.total` once the Provider reports it. */
  amount: PhisPaymentMoney;
  pricing: PhisPaymentPricing;
  totals: PhisPaymentTotals | null;
  captureMode: PhisPaymentCaptureMode;
  status: PhisPaymentStatus;
  authorizedMinor: string;
  capturedMinor: string;
  refundedMinor: string;
  authorizationExpiresAt: string | null;
  checkout: PhisPaymentCheckoutPlan | null;
  /** `PhisPaymentFlag`. */
  flags: number;
  version: number;
  lastObservedAt: string | null;
  /**
   * Who set the payment in motion. `customer`: a person on a checkout. `merchant` and `schedule`: a
   * stored method was charged without the customer, by a consumer's command or by Core's schedule.
   * `provider` (prepared, not built): a period the Provider charged on its own schedule
   * (`provider-managed`), mirrored by Core.
   */
  initiator: PhisPaymentInitiator;
  /** The stored method this payment created (`customer`) or was charged to; `null` where neither. */
  storedMethodId: PhisPaymentStoredMethodId | null;
  /** The subscription and the period this payment settles; both `null` for a payment outside one. */
  subscriptionId: PhisPaymentSubscriptionId | null;
  periodIndex: number | null;
};

/** Bit flags of `PhisPayment.flags`. */
export const PhisPaymentFlag = {
  /**
   * A financial operation of this payment has an indeterminate result; conflicting commands and a
   * replacement attempt are refused (`reconciliation_required`) until recovery establishes the outcome.
   */
  ReconciliationRequired: 1 << 0,
} as const;

export type PhisPaymentInitiator = "customer" | "merchant" | "schedule" | "provider";

export type PhisPaymentStoredMethodId = string;

/**
 * A payment method a Provider holds for a payer, as Core knows it.
 *
 * Core keeps the Provider's opaque binding and this record; payment details never reach phis. The payer
 * reference is the consumer's own and opaque to Core. `display` is for showing the customer which
 * method is meant and carries nothing that identifies it elsewhere.
 */
export type PhisPaymentStoredMethod = {
  id: PhisPaymentStoredMethodId;
  profileKey: string;
  mode: "test" | "live";
  payerReference: string;
  methodKey: string | null;
  display: PhisPaymentStoredMethodDisplay;
  /** `pending` until the Provider confirms it; the last three are final and say why it ended. */
  status: "pending" | "active" | "invalid" | "revoked" | "expired";
  expiresAt: string | null;
  version: number;
};

export type PhisPaymentStoredMethodDisplay = {
  /** The brand or method name, such as "Visa". */
  title: string;
  /** A short distinguishing hint, such as "ends 4242"; `null` where the method has none. */
  hint: string | null;
};

export type PhisPaymentSubscriptionId = string;

/** One period length for a term of the subscription; `{ unit: "month", count: 3 }` is a quarter. */
export type PhisPaymentInterval = { unit: "day" | "week" | "month" | "year"; count: number };

/**
 * What Core does after a renewal was declined under `automatic`. Each entry is a further attempt, that
 * many days after the day the period fell due, and none lies past the subscription's `graceDays`: Core
 * refuses a policy with a later day, so with a grace of 0 there is no retry and a declined renewal ends the
 * subscription at once. At most 8 attempts. When they are used up Core charges nothing more on its own;
 * the customer may still pay the open period (`settleSubscription`) until the grace ends, and a period
 * still unpaid then has failed and the subscription is `canceled`.
 */
export type PhisPaymentDunningPolicy = {
  retryAfterDays: readonly number[];
};

/**
 * How a subscription's periods are paid. Derived by the consumer from what the profile declares
 * (`chooseCollection`), never chosen by the customer, recorded on the subscription and never changed by
 * itself.
 */
export type PhisPaymentCollectionMode = "automatic" | "payment-request" | "provider-managed";

/** How a subscription's periods are paid, with what each mode needs. */
export type PhisPaymentCollection =
  | {
      mode: "automatic";
      /** Core charges the stored method; this is what it does after a declined charge. */
      dunning: PhisPaymentDunningPolicy;
    }
  | {
      mode: "payment-request";
      /**
       * Whole days before the paid period ends that the next one is opened and the customer asked to pay
       * it on a checkout: 0 to 30, and less than one period; 0 asks at the end. Paying early moves no
       * boundary.
       */
      leadDays: number;
    }
  | {
      /** The Provider runs the schedule (`PhisPaymentScheduleFeatures`). Prepared; refused with `unsupported_operation` until built. */
      mode: "provider-managed";
    };

/** What one charge of a subscription costs and is called: a Payment's amount, pricing and description. */
export type PhisPaymentSubscriptionTerms = {
  amount: PhisPaymentMoney;
  pricing: PhisPaymentPricing;
  description: string;
};

export type PhisPaymentSubscriptionChangeId = string;

/**
 * The stretch of a subscription under one interval. Every boundary is computed from `startsAt` and the
 * period index less `firstIndex`, so neither a late charge nor a short month moves it. A change that
 * takes effect at once starts a new term; a subscription that never changed has one, from its first period.
 */
export type PhisPaymentSubscriptionTerm = {
  startsAt: string;
  firstIndex: number;
};

/**
 * An agreement whose schedule Core keeps (`automatic`, `payment-request`), or mirrors from the Provider
 * (`provider-managed`, prepared).
 *
 * Period boundaries are computed from the start of the current term (`term`) and never from the day a
 * charge happened to succeed, so a late charge does not move them. Every period is settled by an ordinary
 * Payment: under `automatic` against the payer's stored method, under `payment-request` on a checkout the
 * customer is asked to. Whether what was sold is switched on is the consumer's knowledge alone.
 *
 * A period still unpaid when the subscription's grace ends (`PhisPaymentSubscriptionPeriod.graceEndsAt`)
 * fails, and the subscription ends (`canceled`), in every mode.
 */
export type PhisPaymentSubscription = {
  id: PhisPaymentSubscriptionId;
  /** The consumer's business reference, unique among its subscriptions that have not ended. */
  reference: string;
  profileKey: string;
  mode: "test" | "live";
  payerReference: string;
  /** The stored method charged under `automatic`; `null` under the other modes and before one is stored. */
  storedMethodId: PhisPaymentStoredMethodId | null;
  interval: PhisPaymentInterval;
  recurring: PhisPaymentSubscriptionTerms;
  collection: PhisPaymentCollection;
  /**
   * Whole days a bound entitlement counts after an unpaid period's end, and then the subscription ends:
   * 0 to 30, and less than one period. Set at the start and by an applied change.
   */
  graceDays: number;
  /**
   * `pending`: the first payment is open. `past_due`: a period's end passed unpaid; Core still tries under
   * `automatic`, or waits for the customer, until the grace ends. `canceled` is final: cancelled, ended at
   * once, the first payment never captured, or a period unpaid when the grace ended.
   */
  status: "pending" | "active" | "past_due" | "canceled";
  /** `PhisPaymentSubscriptionFlag`. */
  flags: number;
  /** The latest period that was paid; `null` until the first payment is captured. */
  period: { index: number; startsAt: string; endsAt: string } | null;
  /** The current term: where boundaries are computed from. `null` until the first payment is captured. */
  term: PhisPaymentSubscriptionTerm | null;
  /**
   * When Core next acts on its own: under `automatic` a renewal, a retry, or the end of the grace; under
   * `payment-request` the next request date (`E - leadDays`), a reminder, or the end of the grace.
   */
  nextChargeAt: string | null;
  /** A change that is `scheduled` or `awaiting_payment`; at most one. */
  pendingChange: PhisPaymentSubscriptionChange | null;
  endedAt: string | null;
  version: number;
};

/** Bit flags of `PhisPaymentSubscription.flags`. */
export const PhisPaymentSubscriptionFlag = {
  /**
   * The open period cannot be paid without the customer: under `automatic` the stored method needs them
   * (automatic attempts are paused); under `payment-request` a requested period is open.
   */
  CustomerActionRequired: 1 << 0,
  /** No further period is charged or requested; the subscription ends when the paid one does. */
  CancelAtPeriodEnd: 1 << 1,
} as const;

export type PhisPaymentSubscriptionPeriod = {
  subscriptionId: PhisPaymentSubscriptionId;
  index: number;
  startsAt: string;
  endsAt: string;
  amount: PhisPaymentMoney;
  /** `void`: the subscription ended before this period was paid. `failed`: unpaid when the grace ended. */
  status: "open" | "paid" | "failed" | "void";
  /** Every payment made for this period, in order; where it is paid, the last one paid it. */
  paymentIds: readonly PhisPaymentId[];
  /** Under `payment-request`: when the period was opened and the customer asked to pay; `null` otherwise. */
  requestedAt: string | null;
  /** `startsAt` plus the subscription's `graceDays`: when the period fails if it is still unpaid. */
  graceEndsAt: string;
  /** The change that opened this period, the first of its term; `null` for every other period. */
  changeId: PhisPaymentSubscriptionChangeId | null;
  /** Where a change cut the period short: the moment the next term started. `endsAt` stays as planned. */
  endedEarlyAt: string | null;
};

export type PhisPaymentSubscriptionCreateInput = {
  profileKey: string;
  reference: string;
  idempotencyKey: string;
  payerReference: string;
  interval: PhisPaymentInterval;
  /** What every period after the first costs. */
  recurring: PhisPaymentSubscriptionTerms;
  /** What the customer pays now: the first period, and whatever is charged once with it. */
  first: PhisPaymentSubscriptionTerms;
  /**
   * How the periods after the first are paid: a mode the method declares for this interval under the
   * pricing policy of `recurring` (`PhisPaymentFeatures.collection`). The first payment's checkout stores
   * the method only under `automatic`.
   */
  collection: PhisPaymentCollection;
  /** Whole days a bound entitlement counts after an unpaid period's end, and then the subscription ends: 0 to 30, less than one period. */
  graceDays: number;
  methodKey: string | null;
  checkoutKind: PhisPaymentCheckoutKind;
  returnPath: string;
  /**
   * The person the documents of this subscription's payments belong to (`billing:v1`): the buyer's subject
   * from `entitlements:v1`; absent or `null`: nobody's, as for a guest.
   */
  documentSubject?: PhisEntitlementSubject | null;
  /** The list line of its documents ("PhiVoice AI Pro, yearly"); absent or `null`: each payment's description. */
  documentLabel?: string | null;
};

/** `now`: the unused share of the paid period is credited and a new term starts; `period-end`: at the next boundary. */
export type PhisPaymentSubscriptionChangeTiming = "now" | "period-end";

/** What a change is asked to be: the new terms, and when. */
export type PhisPaymentSubscriptionChangeRequest = {
  subscriptionId: PhisPaymentSubscriptionId;
  /** Absent: the interval stays. */
  interval?: PhisPaymentInterval;
  /** What every period under the new terms costs; the subscription's currency, a pricing its collection mode allows. */
  recurring: PhisPaymentSubscriptionTerms;
  /** Absent: the grace stays. 0 to 30, less than one period of the new interval. */
  graceDays?: number;
  /** Absent: the lead stays. Only under `payment-request`, refused under the other modes; 0 to 30, less than one period. */
  leadDays?: number;
  /** Charged once with the change; only with `now`. Absent or `null`: nothing. */
  oneTime?: PhisPaymentSubscriptionTerms | null;
  timing: PhisPaymentSubscriptionChangeTiming;
};

/**
 * What a change would cost if asked for now. Changes nothing and holds nothing.
 *
 * Core's one rule, in the subscription's currency: `credit = floor(R * (periodEnd - at) / (periodEnd -
 * periodStart))`, by the second and rounded down, where `R` is the recurring amount the paid period was
 * charged under less what was refunded of its payment (period 0: the subscription's `recurring` at the
 * start, never the one-time part of `first`); `charge` is the first period under the new terms plus
 * `oneTime`; `due = charge - credit`. A `now` change whose credit passes its charge is refused
 * (`invalid_input`): that is a downgrade, which goes at the period end. No credit balance is kept.
 */
export type PhisPaymentSubscriptionChangeQuote = {
  timing: PhisPaymentSubscriptionChangeTiming;
  /** `now`: the moment quoted; `period-end`: the boundary it would take effect at. */
  effectiveAt: string;
  /** The unused share of the paid period; zero for `period-end`. */
  credit: PhisPaymentMoney;
  /** The first period under the new terms, with `oneTime`. */
  charge: PhisPaymentMoney;
  /** `charge` less `credit`; zero for `period-end`. */
  due: PhisPaymentMoney;
  /** The first period under the new terms, as it would run. */
  period: { startsAt: string; endsAt: string };
};

/** One change of a subscription's terms, as Core keeps it. */
export type PhisPaymentSubscriptionChange = {
  id: PhisPaymentSubscriptionChangeId;
  subscriptionId: PhisPaymentSubscriptionId;
  /** The consumer's reference, unique per subscription. */
  reference: string;
  timing: PhisPaymentSubscriptionChangeTiming;
  /**
   * `scheduled`: waits for the boundary. `awaiting_payment`: `due` is open on a checkout. `applied` and
   * `void` are final; a void change changed nothing (its payment ended unpaid, it was taken back, the
   * subscription was cancelled, or a period fell due or was requested first).
   */
  status: "scheduled" | "awaiting_payment" | "applied" | "void";
  interval: PhisPaymentInterval;
  recurring: PhisPaymentSubscriptionTerms;
  graceDays: number;
  /** Under `payment-request` the lead from the change on; `null` under the other modes. */
  leadDays: number | null;
  credit: PhisPaymentMoney;
  charge: PhisPaymentMoney;
  due: PhisPaymentMoney;
  /** When it took effect; `null` until applied. */
  effectiveAt: string | null;
  /** The payment of `due`; `null` where nothing is due. */
  paymentId: PhisPaymentId | null;
  /** The first period under the new terms, once applied; `null` before. */
  periodIndex: number | null;
  createdAt: string;
  version: number;
};

export type PhisPaymentSubscriptionChangeResult = {
  subscription: PhisPaymentSubscription;
  change: PhisPaymentSubscriptionChange;
  /** The payment of `due` with the checkout the customer is sent to; `null` where nothing is due now. */
  payment: PhisPaymentCommandResult | null;
};
export type PhisPaymentSubscriptionResult = {
  subscription: PhisPaymentSubscription;
  /** The first payment, with the checkout the customer is sent to. */
  payment: PhisPaymentCommandResult;
};

export type PhisPaymentErrorCode =
  | "invalid_input"
  | "not_found"
  | "forbidden"
  | "profile_unavailable"
  | "method_unavailable"
  | "unsupported_operation"
  | "invalid_state"
  | "active_attempt_exists"
  | "idempotency_conflict"
  | "payment_declined"
  | "provider_rejected"
  | "provider_unavailable"
  | "reconciliation_required"
  /** A stored method could not be charged without the customer: they must authenticate or register again. */
  | "customer_action_required"
  /** The stored method is gone, revoked or expired at the Provider. */
  | "stored_method_unavailable"
  /** Asked again too soon; the answer names nothing and changes nothing. */
  | "rate_limited"
  /** The change would cost more than the `expectedDue` the customer was shown; quote again. */
  | "quote_outdated";

export type PhisPaymentOperation = {
  id: PhisPaymentOperationId;
  paymentId: PhisPaymentId;
  action: "create" | "complete" | "capture" | "cancel" | "refund" | "charge";
  state: "reserved" | "pending" | "succeeded" | "failed" | "indeterminate";
  errorCode: PhisPaymentErrorCode | null;
};

export type PhisPaymentRefund = {
  id: PhisPaymentRefundId;
  paymentId: PhisPaymentId;
  amount: PhisPaymentMoney;
  /** The tax or discount share of this refund when the Provider reports one; informational. */
  additions: readonly PhisPaymentAddition[] | null;
  status: "pending" | "succeeded" | "failed" | "canceled";
};

export type PhisPaymentCommandResult = {
  operation: PhisPaymentOperation;
  payment: PhisPayment;
  refund: PhisPaymentRefund | null;
};

export type PhisPaymentCreateInput = {
  profileKey: string;
  reference: string;
  idempotencyKey: string;
  amount: PhisPaymentMoney;
  pricing: PhisPaymentPricing;
  description: string;
  captureMode: PhisPaymentCaptureMode;
  methodKey: string | null;
  checkoutKind: PhisPaymentCheckoutKind;
  returnPath: string;
  /**
   * Also store the method the customer pays with, for this payer. Only for a method that declares
   * `stored.setup` with `with-payment`, and only under a grant that includes `method-store`.
   */
  store?: { payerReference: string } | null;
  /**
   * The instant (ISO 8601) until which the customer can complete the payment; absent or `null`: as long as
   * the Provider allows. Only for a method that declares `checkoutExpiry`, and within it: Core refuses an end
   * outside it with `invalid_input` and never moves it. The Provider keeps it within its own limits and
   * reports the end it set as the checkout's `expiresAt`; when it comes, the payment becomes `expired`,
   * with `payment.changed`, as for any checkout that ran out.
   */
  expiresAt?: string | null;
  /**
   * The person this payment's documents belong to (`billing:v1`): the buyer's subject from
   * `entitlements:v1`; absent or `null`: nobody's, as for a guest.
   */
  documentSubject?: PhisEntitlementSubject | null;
  /** The list line of its documents ("Order 2611-ABCDEF"); absent or `null`: the payment's description. */
  documentLabel?: string | null;
};

export type PhisPaymentCommandInput = {
  paymentId: PhisPaymentId;
  idempotencyKey: string;
};

/**
 * What a profile can do in one currency under one pricing policy, as Core last recorded it from the
 * Provider: the union over the profile's methods probed under that policy. A single payment may still be
 * refused (amount, the merchant's account), which is decided when it is made.
 */
export type PhisPaymentPolicyRecording = {
  basis: PhisPaymentPricingBasis;
  tax: PhisPaymentTaxHandling;
  captureModes: readonly PhisPaymentCaptureMode[];
  /** `null` where no method can collect a subscription under this policy. */
  collection: PhisPaymentCollectionFeatures | null;
  currency: PhisPaymentCurrencyFeatures;
  /** `null` where no method's payments are documented by the Provider under this policy. */
  documents: PhisPaymentDocumentFeatures | null;
  /** `null` where no method sells as Merchant of Record under this policy (always under any `tax` but `merchant-of-record`). */
  merchantOfRecord: PhisPaymentMerchantOfRecordFeatures | null;
};

/**
 * What a profile can do in one currency, per pricing policy, as Core last recorded it. Recorded once per
 * currency and per policy the Provider's methods declare (`pricing.bases` x `pricing.tax`,
 * `merchant-of-record` only where declared), by `refreshProfileFeatures`, `phis payment profile probe` and
 * after a Provider upgrade.
 */
export type PhisPaymentProfileFeatures = {
  currency: string;
  /** When the Provider was last asked in this currency. */
  probedAt: string;
  policies: readonly PhisPaymentPolicyRecording[];
};

/**
 * One merchant profile granted to the calling consumer, as `listProfiles` names it: what a seller picks a
 * profile by. No credentials, grants or merchant identity -- those are the operator's.
 */
export type PhisPaymentProfileSummary = {
  profileKey: string;
  /** The registered provider key the profile is bound to (`PhisPaymentProfileDraft.providerKey`). */
  providerKey: string;
  /** The Add-on that provides it. */
  providerAddonId: string;
  mode: "test" | "live";
  /**
   * `enabled`: payments can be created under it. `disabled`: added or changed and not enabled since
   * (`phis payment profile enable`). `retired`: for good; it serves only the payments it already has.
   */
  state: "enabled" | "disabled" | "retired";
};

export interface PhisPaymentsCapabilityV1 {
  /**
   * The Site's profiles this consumer's grant includes `read` on, retired ones too, by `profileKey`. Where
   * a profile is chosen -- a Shop's destination -- rather than typed. The profiles without such a grant
   * are not named, as everywhere else. Not from a hook (`forbidden`).
   */
  listProfiles(): Promise<readonly PhisPaymentProfileSummary[]>;
  listMethods(input: {
    profileKey: string;
    amount: PhisPaymentMoney;
    captureMode: PhisPaymentCaptureMode;
    checkoutKind: PhisPaymentCheckoutKind;
    pricing: PhisPaymentPricingSelector;
    usage?: PhisPaymentUsage;
  }): Promise<readonly PhisPaymentMethod[]>;
  /**
   * The profile's recorded features in one currency, every policy, read from what Core recorded; the
   * Provider is never asked. Under the grant `read`, and one of the two operations a hook may call (with
   * `chooseCollection`): it names what the Provider can do, nothing of a payment, a customer or the
   * account. `null` where the profile was never probed in this currency.
   */
  profileFeatures(input: { profileKey: string; currency: string }): Promise<PhisPaymentProfileFeatures | null>;
  /**
   * Asks the Provider again, once per currency and per pricing policy its methods declare, and records each
   * answer; what `profileFeatures` and `chooseCollection` read from then on. A merchant action under the
   * grant's `profileRefresh` policy, never from a hook, and at most once a minute per profile: sooner
   * answers `rate_limited`.
   */
  refreshProfileFeatures(input: { profileKey: string; currencies: readonly string[] }): Promise<readonly PhisPaymentProfileFeatures[]>;
  /**
   * The collection mode a subscription with this interval would get at this profile, currency and pricing
   * policy, of the `modes` the consumer allows: the first in Core's order -- `automatic`, then
   * `provider-managed` (never answered until it is built), then `payment-request` -- that the recording
   * declares for the interval's unit and length. `null`: none, and the consumer does not offer it there.
   * Under the grant `read`; a hook may call it, since it reads the recording only. The live check is
   * `listMethods` with `usage: "recurring"` when the payment is made.
   */
  chooseCollection(input: {
    profileKey: string;
    currency: string;
    pricing: PhisPaymentPricingSelector;
    interval: PhisPaymentInterval;
    modes: readonly PhisPaymentCollectionMode[];
  }): Promise<{ mode: PhisPaymentCollectionMode; features: PhisPaymentIntervalFeatures } | null>;
  /** Core binds Site/consumer/profile; the consumer checks access to its business resource. */
  create(input: PhisPaymentCreateInput): Promise<PhisPaymentCommandResult>;
  get(paymentId: PhisPaymentId): Promise<PhisPayment | null>;
  getOperation(operationId: PhisPaymentOperationId): Promise<PhisPaymentOperation | null>;
  getRefund(refundId: PhisPaymentRefundId): Promise<PhisPaymentRefund | null>;
  /** Customer continuation; never captures a manually authorized payment. */
  complete(input: PhisPaymentCommandInput): Promise<PhisPaymentCommandResult>;
  /** Explicit bounded reconciliation that may update state and enqueue a consumer event. */
  refresh(paymentId: PhisPaymentId): Promise<PhisPayment | null>;
  /** One final merchant-authorized capture; minor units inherit the stored currency. */
  capture(input: PhisPaymentCommandInput & {
    minor: string;
  }): Promise<PhisPaymentCommandResult>;
  cancel(input: PhisPaymentCommandInput): Promise<PhisPaymentCommandResult>;
  /** Merchant-authorized refund; pending/unknown amounts reserve the captured balance. */
  refund(input: PhisPaymentCommandInput & {
    minor: string;
    reason: string;
  }): Promise<PhisPaymentCommandResult>;
  getStoredMethod(storedMethodId: PhisPaymentStoredMethodId): Promise<PhisPaymentStoredMethod | null>;
  /** The payer's stored methods under one profile, newest first; ended ones included. */
  listStoredMethods(input: {
    profileKey: string;
    payerReference: string;
  }): Promise<readonly PhisPaymentStoredMethod[]>;
  /** Revokes the method at the Provider. Answers the record as it then stands, or `null` when unknown. */
  removeStoredMethod(storedMethodId: PhisPaymentStoredMethodId): Promise<PhisPaymentStoredMethod | null>;
  /**
   * Stores a method without a payment: the customer enters it on the Provider's hosted page and nothing
   * is charged. Only for a method that declares `stored.setup` with `alone`, under a grant that includes
   * `method-store`. The record is `pending` until the Provider confirms it; `refreshStoredMethod` asks.
   */
  setupMethod(input: {
    profileKey: string;
    idempotencyKey: string;
    payerReference: string;
    /** What the method is meant to be charged, so the Provider can say whether it is available for that. */
    amount: PhisPaymentMoney;
    methodKey: string | null;
    checkoutKind: PhisPaymentCheckoutKind;
    returnPath: string;
  }): Promise<{ storedMethod: PhisPaymentStoredMethod; checkout: PhisPaymentCheckoutPlan | null }>;
  /** Asks the Provider how the stored method stands now, for a customer who has just returned. */
  refreshStoredMethod(storedMethodId: PhisPaymentStoredMethodId): Promise<PhisPaymentStoredMethod | null>;
  /**
   * Stores the agreement and opens its first payment, which under `automatic` also stores the method the
   * customer pays with. The subscription is `pending` until that payment is captured and `canceled` if it
   * never is. `provider-managed` is refused with `unsupported_operation` until it is built.
   */
  createSubscription(input: PhisPaymentSubscriptionCreateInput): Promise<PhisPaymentSubscriptionResult>;
  getSubscription(subscriptionId: PhisPaymentSubscriptionId): Promise<PhisPaymentSubscription | null>;
  /** Newest first. */
  listSubscriptionPeriods(subscriptionId: PhisPaymentSubscriptionId): Promise<readonly PhisPaymentSubscriptionPeriod[]>;
  /**
   * `period-end`: nothing further is charged and the subscription ends with the paid period; this is
   * what a customer asks for, through the consumer. `now` ends it at once, refunds nothing, and is a
   * merchant action under the grant's `subscriptionEnd` policy. Either voids a pending change; resuming
   * does not bring it back.
   */
  cancelSubscription(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    at: "period-end" | "now";
  }): Promise<PhisPaymentSubscription | null>;
  /** Takes back a cancellation at the period end, until that end has come. */
  resumeSubscription(subscriptionId: PhisPaymentSubscriptionId): Promise<PhisPaymentSubscription | null>;
  /**
   * The customer pays the open period on a checkout: for a subscription that is `past_due`, and under
   * `payment-request` also for a requested period while it is `active`. Under `automatic` the checkout
   * stores the method anew, and on capture the subscription is `active` again and charged to the new
   * method; under `payment-request` nothing is stored. Only until the period's grace ends.
   */
  settleSubscription(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    idempotencyKey: string;
    methodKey: string | null;
    checkoutKind: PhisPaymentCheckoutKind;
    returnPath: string;
  }): Promise<PhisPaymentCommandResult>;
  /** Charges the subscription to another active stored method of the same payer and profile from now on; only under `automatic`. */
  replaceSubscriptionMethod(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    storedMethodId: PhisPaymentStoredMethodId;
  }): Promise<PhisPaymentSubscription | null>;
  /**
   * What every period from the next one on costs. Nothing already charged changes and nothing is
   * prorated; the consumer tells the customer. A merchant action under the grant's `subscriptionPrice`
   * policy, in the subscription's currency and, under `automatic`, within what the stored method can be
   * charged. Refused while a change is pending.
   */
  changeSubscriptionPrice(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    recurring: PhisPaymentSubscriptionTerms;
  }): Promise<PhisPaymentSubscription | null>;
  /** What a change would cost now, by the rule `changeSubscription` applies (`PhisPaymentSubscriptionChangeQuote`). Under the grant `subscription-change`. */
  previewSubscriptionChange(input: PhisPaymentSubscriptionChangeRequest): Promise<PhisPaymentSubscriptionChangeQuote>;
  /**
   * Changes what the subscription costs and how long its periods are. `period-end`: scheduled, applied
   * before the next period is charged or requested. `now`: applied at once where nothing is due, otherwise
   * when the payment of `due` is captured on its checkout (which, under `automatic`, stores the method anew
   * and charges the subscription to it from then on); on capture the paid period ends there
   * (`endedEarlyAt`) and a new term starts with a period under the new terms. Only for an `active`
   * subscription without `CancelAtPeriodEnd`, a pending change or an open period; in its currency, at its
   * profile and in its collection mode. Idempotent on `idempotencyKey`. Under the grant
   * `subscription-change`, and `create` for the payment of `due`.
   */
  changeSubscription(input: PhisPaymentSubscriptionChangeRequest & {
    reference: string;
    idempotencyKey: string;
    /** The `due` the customer was shown; refused with `quote_outdated` where it is now more. */
    expectedDue: PhisPaymentMoney;
    /** Where `due` is paid; required for `now`, ignored for `period-end`. */
    checkout: {
      methodKey: string | null;
      checkoutKind: PhisPaymentCheckoutKind;
      returnPath: string;
      /** As `PhisPaymentCreateInput.expiresAt`. */
      expiresAt?: string | null;
    } | null;
  }): Promise<PhisPaymentSubscriptionChangeResult>;
  /** Takes back a `scheduled` change, or voids one `awaiting_payment` and cancels its payment. `null` where there is none by that id. */
  cancelSubscriptionChange(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    changeId: PhisPaymentSubscriptionChangeId;
  }): Promise<PhisPaymentSubscriptionChange | null>;
  /** Newest first. */
  listSubscriptionChanges(subscriptionId: PhisPaymentSubscriptionId): Promise<readonly PhisPaymentSubscriptionChange[]>;
  /**
   * The unused share of the paid period now, by the rule of `previewSubscriptionChange`: for a consumer
   * that ends the subscription for a purchase and credits it there. `null` without a paid period.
   */
  subscriptionCredit(subscriptionId: PhisPaymentSubscriptionId): Promise<{ credit: PhisPaymentMoney; at: string; periodIndex: number } | null>;
  /**
   * What a payment and its refunds settled at the Provider, oldest first; empty until the Provider
   * reported it. Under the grant `settlement-read`, and only for an acting user with the Site role Admin or
   * Accountant (`forbidden` otherwise, and without an acting user).
   */
  listSettlements(paymentId: PhisPaymentId): Promise<readonly PhisPaymentSettlement[]>;
}

export type PhisPaymentProviderConfigV1 = {
  profileKey: string;
  mode: "test" | "live";
  merchantIdentity: string | null;
};

export type PhisPaymentProviderContextV1 = {
  providerKey: string;
  readCredentials(): Promise<Readonly<Record<string, string>> | null>;
};

export type PhisPaymentProviderBinding = {
  reference: string;
  data: Readonly<Record<string, string>>;
};

export type PhisPaymentProviderProbe = {
  merchantIdentity: string;
  mode: "test" | "live";
  methods: readonly Omit<PhisPaymentMethod, "profileKey">[];
};

/** A stored method as the Provider reports it; `binding` is what a later charge is sent with. */
export type PhisPaymentProviderStoredMethod = {
  binding: PhisPaymentProviderBinding;
  display: PhisPaymentStoredMethodDisplay;
  /** `pending`: a set-up without payment is still open on the hosted page. */
  status: "pending" | "active" | "invalid" | "revoked" | "expired";
  expiresAt: string | null;
};

export type PhisPaymentProviderObservation = {
  binding: PhisPaymentProviderBinding;
  merchantIdentity: string;
  mode: "test" | "live";
  status: PhisPaymentStatus;
  /** The base amount as created; a Provider never changes it. */
  amount: PhisPaymentMoney;
  /** Null only while the Provider cannot yet know the total; required from `authorized` on. */
  totals: PhisPaymentObservedTotals | null;
  authorizedMinor: string;
  capturedMinor: string;
  authorizationExpiresAt: string | null;
  checkout: PhisPaymentCheckoutPlan | null;
  /** Complete refund observations, including remote refunds created outside Core. */
  refunds: readonly {
    operationId: PhisPaymentOperationId | null;
    binding: PhisPaymentProviderBinding;
    minor: string;
    status: PhisPaymentRefund["status"];
    additions: readonly PhisPaymentAddition[] | null;
  }[];
  /**
   * The method this payment stored, once the Provider has one; absent or `null` otherwise. Reported only
   * for a `create` that carried `store`.
   */
  storedMethod?: PhisPaymentProviderStoredMethod | null;
};

export type PhisPaymentProviderCommand = {
  operationId: PhisPaymentOperationId;
  paymentId: PhisPaymentId;
  providerIdempotencyKey: string;
  signal: AbortSignal;
} & (
  | {
      action: "create";
      amount: PhisPaymentMoney;
      pricing: PhisPaymentPricing;
      description: string;
      captureMode: PhisPaymentCaptureMode;
      methodKey: string | null;
      checkoutKind: PhisPaymentCheckoutKind;
      returnUrl: string;
      notificationUrl: string;
      /** Sent only for a method whose probe declared `stored.setup` with `with-payment`. */
      store?: { payerReference: string } | null;
      /**
       * Sent only where the consumer stated one, for a method whose probe declared `checkoutExpiry`, and
       * within it: the instant the checkout ends. The Provider ends it then, or earlier where its own unit
       * is coarser, never later, and reports that end as `checkout.expiresAt`.
       */
      expiresAt?: string | null;
    }
  | {
      /**
       * Charges a stored method without the customer. Sent only for a method whose probe declared
       * `stored`. Answers `rejected` with `customer_action_required` when the payer has to return, with
       * `stored_method_unavailable` when the method is gone, and with `payment_declined` otherwise.
       */
      action: "charge";
      storedMethod: PhisPaymentProviderBinding;
      payerReference: string;
      amount: PhisPaymentMoney;
      pricing: PhisPaymentPricing;
      description: string;
      methodKey: string | null;
      /** `scheduled`: a period of an agreement fell due; `unscheduled`: the merchant decided to charge. */
      sequence: "scheduled" | "unscheduled";
      notificationUrl: string;
    }
  | { action: "complete" | "cancel"; binding: PhisPaymentProviderBinding }
  | { action: "capture"; binding: PhisPaymentProviderBinding; minor: string }
  | { action: "refund"; binding: PhisPaymentProviderBinding; minor: string; reason: string }
);

export type PhisPaymentProviderExecution =
  | {
      outcome: "applied" | "pending";
      observation: PhisPaymentProviderObservation;
    }
  | { outcome: "rejected"; code: PhisPaymentErrorCode }
  | { outcome: "unknown" };

export type PhisPaymentProviderNotification =
  /**
   * `subject` says which family `reference` belongs to; absent means `payment`. `subscription` (prepared,
   * not built): a subscription whose schedule the Provider runs.
   */
  | { outcome: "verified"; deliveryId: string; reference: string; subject?: "payment" | "stored-method" | "subscription" }
  | { outcome: "lookup-required"; reference: string; subject?: "payment" | "stored-method" | "subscription" }
  | { outcome: "irrelevant" }
  | { outcome: "rejected" }
  | { outcome: "unavailable" };

export interface PhisPaymentProviderV1 {
  probe(input: {
    amount: PhisPaymentMoney;
    captureMode: PhisPaymentCaptureMode;
    checkoutKind: PhisPaymentCheckoutKind;
    pricing: PhisPaymentPricingSelector;
    /**
     * `recurring`: answer only the methods that can collect a subscription for this amount and pricing in at
     * least one collection mode, each with its `collection`.
     */
    usage?: PhisPaymentUsage;
    signal: AbortSignal;
  }): Promise<PhisPaymentProviderProbe>;
  execute(input: PhisPaymentProviderCommand): Promise<PhisPaymentProviderExecution>;
  observe(input: {
    binding: PhisPaymentProviderBinding;
    signal: AbortSignal;
  }): Promise<PhisPaymentProviderObservation>;
  /** Recover the same command; never replace its key, merchant, mode or Provider. */
  recover(input: {
    command: PhisPaymentProviderCommand;
    binding: PhisPaymentProviderBinding | null;
  }): Promise<PhisPaymentProviderExecution>;
  verifyNotification(input: {
    method: string;
    headers: Readonly<Record<string, string>>;
    body: Uint8Array;
    signal: AbortSignal;
  }): Promise<PhisPaymentProviderNotification>;
  /**
   * The stored method as it stands now. Required of a Provider that declares `stored` on any method;
   * Core never calls it otherwise.
   */
  observeStoredMethod?(input: {
    binding: PhisPaymentProviderBinding;
    signal: AbortSignal;
  }): Promise<PhisPaymentProviderStoredMethod>;
  /** Removes the stored method at the Provider. `revoked` also where it was already gone. */
  revokeStoredMethod?(input: {
    binding: PhisPaymentProviderBinding;
    signal: AbortSignal;
  }): Promise<{ outcome: "revoked" | "unknown" }>;
  /**
   * Opens a hosted page on which the customer enters a method that is stored and not charged. Required
   * of a Provider that declares `stored.setup` with `alone`. The binding it answers is what
   * `observeStoredMethod` is asked with until the method exists; from then on that answers the method's
   * own binding. `rejected` and `unknown` both mean no page was opened that Core can send anybody to.
   */
  setupStoredMethod?(input: {
    storedMethodId: PhisPaymentStoredMethodId;
    providerIdempotencyKey: string;
    payerReference: string;
    methodKey: string | null;
    returnUrl: string;
    notificationUrl: string;
    signal: AbortSignal;
  }): Promise<
    | { outcome: "applied"; binding: PhisPaymentProviderBinding; checkout: PhisPaymentCheckoutPlan }
    | { outcome: "rejected"; code: PhisPaymentErrorCode }
    | { outcome: "unknown" }
  >;
  /**
   * The documents the Provider holds for one payment and its refunds. Required of a Provider that declares
   * `documents` on any method; Core asks only for a payment whose method declared them under the payment's
   * policy, after a capture or a succeeded refund, and again while one is `pending`.
   */
  listDocuments?(input: {
    /** The payment's binding (Stripe: the Checkout Session or the PaymentIntent). */
    binding: PhisPaymentProviderBinding;
    signal: AbortSignal;
  }): Promise<readonly PhisPaymentProviderDocument[]>;
  /**
   * The file of one listed document that is `ready`, streamed; redirects are the Provider's to follow.
   * Core checks the content type, counts the bytes against the Site's limit and hashes them as it stores.
   * Required with `listDocuments` where any declared kind carries `Fetchable`.
   */
  fetchDocument?(input: {
    binding: PhisPaymentProviderBinding;
    /** `PhisPaymentProviderDocument.reference`. */
    reference: string;
    signal: AbortSignal;
  }): Promise<{ contentType: "application/pdf" | "text/html"; byteSize: number | null; body: ReadableStream<Uint8Array> }>;
  /**
   * What the payment's capture and each of its refunds settled on the merchant's balance. Required of a
   * Provider that declares `SettlementRecords` on any method. `partial`: a record the Provider books later
   * is still missing; Core asks again until `complete` covers the capture and every succeeded refund.
   */
  observeSettlements?(input: {
    /** The payment's binding. */
    binding: PhisPaymentProviderBinding;
    signal: AbortSignal;
  }): Promise<{ records: readonly PhisPaymentProviderSettlement[]; state: "complete" | "partial" }>;
  /**
   * Prepared, not built: carries out a command on a subscription whose schedule the Provider runs. Core
   * calls it only for a method that declared `collection.providerManaged`, and not at all until
   * `provider-managed` is built.
   */
  executeSubscription?(input: PhisPaymentProviderSubscriptionCommand): Promise<PhisPaymentProviderSubscriptionExecution>;
  /** Prepared, not built: the subscription as the Provider runs it now. Under the same rule as `executeSubscription`. */
  observeSubscription?(input: {
    binding: PhisPaymentProviderBinding;
    signal: AbortSignal;
  }): Promise<PhisPaymentProviderSubscriptionObservation>;
}

/**
 * A command on a subscription whose schedule the Provider runs (`provider-managed`). Prepared, not built:
 * the shape is reserved so the mode is added later without reshaping.
 */
export type PhisPaymentProviderSubscriptionCommand = {
  operationId: PhisPaymentOperationId;
  subscriptionId: PhisPaymentSubscriptionId;
  providerIdempotencyKey: string;
  signal: AbortSignal;
} & (
  | {
      action: "subscribe";
      payerReference: string;
      interval: PhisPaymentInterval;
      recurring: PhisPaymentSubscriptionTerms;
      first: PhisPaymentSubscriptionTerms;
      methodKey: string | null;
      checkoutKind: PhisPaymentCheckoutKind;
      returnUrl: string;
      notificationUrl: string;
    }
  | {
      action: "change";
      binding: PhisPaymentProviderBinding;
      interval: PhisPaymentInterval;
      recurring: PhisPaymentSubscriptionTerms;
      timing: PhisPaymentSubscriptionChangeTiming;
      proration: PhisPaymentProration;
    }
  | { action: "cancel"; binding: PhisPaymentProviderBinding; at: "period-end" | "now" }
  | { action: "resume"; binding: PhisPaymentProviderBinding }
);

/** A subscription as the Provider that runs its schedule reports it. Prepared, not built. */
export type PhisPaymentProviderSubscriptionObservation = {
  binding: PhisPaymentProviderBinding;
  status: PhisPaymentSubscription["status"];
  interval: PhisPaymentInterval;
  recurring: PhisPaymentMoney;
  period: { startsAt: string; endsAt: string } | null;
  /** `PhisPaymentSubscriptionFlag`; the Provider reports `CancelAtPeriodEnd` only. */
  flags: number;
  endedAt: string | null;
  /** The periods the Provider charged, newest first, at most 24, each with its payment as observed. */
  periods: readonly {
    startsAt: string;
    endsAt: string;
    status: PhisPaymentSubscriptionPeriod["status"];
    payment: PhisPaymentProviderObservation | null;
  }[];
  /** The page the customer is sent to for `subscribe`; `null` afterwards. */
  checkout: PhisPaymentCheckoutPlan | null;
};

export type PhisPaymentProviderSubscriptionExecution =
  | { outcome: "applied" | "pending"; observation: PhisPaymentProviderSubscriptionObservation }
  | { outcome: "rejected"; code: PhisPaymentErrorCode }
  | { outcome: "unknown" };

/** A document as the Provider lists it for one payment or one of its refunds. */
export type PhisPaymentProviderDocument = {
  /** The Provider's own id for it, unique per profile (Stripe: `in_...`, `cn_...`, the charge id for a receipt). */
  reference: string;
  kind: PhisPaymentProviderDocumentKind;
  /** As printed; `null` where it carries none. */
  number: string | null;
  issuer: PhisBillingDocumentIssuer;
  issuedAt: string;
  total: PhisPaymentMoney;
  /** What the customer was shown and paid in their local currency where the Provider converted; informational, `null` otherwise. */
  presentment: PhisPaymentMoney | null;
  /** `ready`: `fetchDocument` answers the file; `pending`: the Provider has not finished it, ask again later. */
  state: "ready" | "pending";
  /** For a credit note: the refund it documents, by the refund's binding; `null` for every other document. */
  refund: PhisPaymentProviderBinding | null;
};

export type PhisPaymentSettlementId = string;

/** What one capture or refund moved on the merchant's balance at the Provider. Recorded by Core, read-only to consumers; never rewritten, a later correction is a further record. */
export type PhisPaymentSettlement = {
  id: PhisPaymentSettlementId;
  paymentId: PhisPaymentId;
  /** The refund this settles; `null` for the payment's own capture. */
  refundId: PhisPaymentRefundId | null;
  /** `credit`: money came in (a capture); `debit`: it went out (a refund, a dispute's withdrawal). */
  direction: "credit" | "debit";
  /** The Provider's id of the record, unique per profile (Stripe: the balance transaction `txn_...`). */
  reference: string;
  /** What the payment or refund was, in its own currency. */
  gross: PhisPaymentMoney;
  /** What was booked on the balance before fees and withheld tax, in the settlement currency. */
  settled: PhisPaymentMoney;
  /** The Provider's fee, in the settlement currency; zero where none. */
  fee: PhisPaymentMoney;
  /** Tax the Provider withheld and remits as Merchant of Record, in the settlement currency; `null` where it withheld none. */
  withheldTax: PhisPaymentMoney | null;
  /** What remains for the merchant: `settled` less `fee` less `withheldTax`, in the settlement currency; Core checks the sum. */
  net: PhisPaymentMoney;
  /** Settlement units per unit of `gross`'s currency, as a decimal string ("0.9312"); `null` where nothing was converted. Never enters Core arithmetic. */
  exchangeRate: string | null;
  /** When the Provider makes it available for payout; `null` where it does not say. */
  availableAt: string | null;
  /** When the Provider booked it. */
  bookedAt: string;
  recordedAt: string;
};

/** One settlement as the Provider reports it; Core adds the ids and checks the sums. */
export type PhisPaymentProviderSettlement = Omit<PhisPaymentSettlement, "id" | "paymentId" | "refundId" | "recordedAt"> & {
  /** The refund's binding where the record is a refund's; `null` for the payment's capture. */
  refund: PhisPaymentProviderBinding | null;
};

export interface PhisPaymentNotificationsCapabilityV1 {
  receive(input: {
    profileKey: string;
  }): Promise<{ outcome: "processed" | "duplicate" | "ignored" }>;
}

export type PhisPaymentGrantedOperation =
  | "read"
  | "create"
  | "complete"
  | "refresh"
  | "capture"
  | "cancel"
  | "refund"
  /** Store a method with a payment (`create` with `store`). Never implied by `create`. */
  | "method-store"
  | "method-read"
  | "method-remove"
  | "subscription-read"
  /** Also needs `create`, and under `automatic` `method-store`: the first payment is one, and there it stores the method. */
  | "subscription-create"
  /** Cancel at the period end, resume, settle the open or requested period, and change the stored method. */
  | "subscription-cancel"
  /** Preview, change, take back and list changes, and read the credit. Also needs `create` for the payment of `due`. */
  | "subscription-change"
  /** Read the documents archived for this consumer's payments through `billing:v1`. */
  | "document-read"
  /** Read what this consumer's payments settled (`listSettlements`); only for an acting Admin or Accountant. */
  | "settlement-read";

export type PhisPaymentMerchantActionPolicy = {
  roles: readonly string[];
  jobs: readonly string[];
  events: readonly string[];
};

export type PhisPaymentProfileGrant = {
  consumerAddonId: string;
  operations: readonly PhisPaymentGrantedOperation[];
  merchantActions: {
    capture: PhisPaymentMerchantActionPolicy;
    cancel: PhisPaymentMerchantActionPolicy;
    refund: PhisPaymentMerchantActionPolicy;
    /** Who may end a subscription at once. Absent: nobody. */
    subscriptionEnd?: PhisPaymentMerchantActionPolicy;
    /** Who may change what a subscription costs from its next period on. Absent: nobody. */
    subscriptionPrice?: PhisPaymentMerchantActionPolicy;
    /** Who may ask the Provider again for the profile's features (`refreshProfileFeatures`). Absent: nobody. */
    profileRefresh?: PhisPaymentMerchantActionPolicy;
  };
};

/** Operator-controlled references and grants; contains no credential values. */
export type PhisPaymentProfileDraft = {
  key: string;
  providerKey: string;
  mode: "test" | "live";
  credentialReferences: Readonly<Record<string, string>>;
  grants: readonly PhisPaymentProfileGrant[];
};

/** A payment event reaches only the consuming Add-on stored on that payment. */
export type PhisPaymentChangedEventFacts = {
  event: "payment.changed";
  /**
   * A payment, or a subscription. A renewal produces both: the payment's fact, and the subscription's
   * with the period it concerns. A handler narrows on `kind`.
   */
  subject:
    | {
        kind: "payment";
        paymentId: PhisPaymentId;
        reference: string;
        version: number;
        operationId: PhisPaymentOperationId | null;
        refundId: PhisPaymentRefundId | null;
      }
    | {
        kind: "subscription";
        subscriptionId: PhisPaymentSubscriptionId;
        reference: string;
        version: number;
        periodIndex: number | null;
        /** The change this fact is about -- scheduled, applied or void; `null` for every other fact. */
        changeId: PhisPaymentSubscriptionChangeId | null;
        /**
         * Which moment of a requested period under `payment-request` this fact is about, each emitted once:
         * `requested` (opened, `leadDays` before the paid period ends), `reminder` (3 days before that end,
         * where this lies after the request), `due` (the end passed unpaid), `grace-ending` (a day before the
         * grace ends, where the grace is at least 2 days). `null` for every other fact.
         */
        moment: "requested" | "reminder" | "due" | "grace-ending" | null;
      };
};

/*
 * Pricing: how a consumer lets a Provider add tax, shipping and discounts to its base amount, and how
 * the Provider reports the customer's total with its parts. PAYMENTS.md section 12 states the rules Core
 * enforces; a Provider documents its mapping of the closed tax-category vocabulary to its own codes.
 */

export type PhisPaymentPricingBasis = "final" | "net";
export type PhisPaymentTaxHandling = "none" | "provider" | "merchant-of-record";
export type PhisPaymentPromotionCodes = "none" | "provider";

/** What is sold, never a rate; each Provider maps the closed vocabulary to its own codes. */
export type PhisPaymentTaxCategory =
  | "general"
  | "reduced-goods"
  | "digital-goods"
  | "digital-service"
  | "service"
  | "shipping"
  | "exempt";

export type PhisPaymentLineItem = {
  reference: string;
  description: string;
  quantity: number;
  unitMinor: string;
  taxCategory: PhisPaymentTaxCategory;
  /** Provider-specific code overriding the category mapping, keyed by provider key. */
  providerTaxCodes: Readonly<Record<string, string>> | null;
};

/** A reduction the consumer decided; the Provider shows it and taxes the reduced amount. */
export type PhisPaymentDiscount = {
  reference: string;
  label: string;
  minor: string;
};

export type PhisPaymentCustomerDetails = {
  country: string;
  postalCode: string | null;
  region: string | null;
  addressSource: "billing" | "shipping";
  taxIds: readonly { type: string; value: string }[];
};

/**
 * `final`/`none` is v1: the base amount is what the customer pays and the Provider adds nothing. Every
 * other policy carries line items; the base amount then equals their sum plus shipping minus discounts.
 */
export type PhisPaymentPricing =
  | { basis: "final"; tax: "none" }
  | {
      basis: PhisPaymentPricingBasis;
      tax: PhisPaymentTaxHandling;
      lineItems: readonly PhisPaymentLineItem[];
      shipping: { minor: string; taxCategory: "shipping" } | null;
      discounts: readonly PhisPaymentDiscount[];
      promotionCodes: PhisPaymentPromotionCodes;
      customer: PhisPaymentCustomerDetails | null;
    };

/** The facts of a policy a method must support; `discounts` is the number of stated discounts. */
export type PhisPaymentPricingSelector = {
  basis: PhisPaymentPricingBasis;
  tax: PhisPaymentTaxHandling;
  discounts: number;
  promotionCodes: PhisPaymentPromotionCodes;
};

export type PhisPaymentPricingFeatures = {
  /** Always includes `final`. */
  bases: readonly PhisPaymentPricingBasis[];
  /** Always includes `none`. */
  tax: readonly PhisPaymentTaxHandling[];
  /** How many stated discounts one payment may carry; 0 when the Provider shows none. */
  maxDiscounts: number;
  /** Whether a customer may enter a code on the Provider's page, and whether next to stated discounts. */
  promotionCodes: "none" | "alone" | "with-discounts";
  /** `PhisPaymentPricingFeatureFlag`. */
  flags: number;
  /**
   * What the Provider does as Merchant of Record. Present exactly when `tax` includes
   * `merchant-of-record`, `null` otherwise.
   *
   * A consumer offers no more than this: a Shop sells under this handling only to these countries and only
   * these categories, and offers a business with a VAT id only what `businessTaxIds` names. Stripe is one
   * Provider of several, so none of it is assumed; each Provider states its own reach.
   */
  merchantOfRecord: PhisPaymentMerchantOfRecordFeatures | null;
};

/**
 * Where and what a Provider sells as Merchant of Record, owing the tax there itself.
 *
 * `countries` are ISO 3166-1 alpha-2 codes: the countries the Provider takes the tax liability for. A sale
 * to another country is the merchant's tax to handle, which a consumer that relies on the Provider does not
 * offer. `taxCategories` are the categories it admits as Merchant of Record. `businessTaxIds` says what a
 * business customer's VAT id does: `charge` -- the tax is charged anyway and the business reclaims it as
 * input tax; `reverse-charge` -- with a valid id the tax is not charged, and a tax-inclusive price is
 * reduced by its tax share. A Provider that supports both lets the consumer choose.
 */
export type PhisPaymentMerchantOfRecordFeatures = {
  countries: readonly string[];
  taxCategories: readonly PhisPaymentTaxCategory[];
  businessTaxIds: readonly PhisPaymentBusinessTaxIdHandling[];
};

export type PhisPaymentBusinessTaxIdHandling = "charge" | "reverse-charge";

/** Bit flags of `PhisPaymentPricingFeatures.flags`. */
export const PhisPaymentPricingFeatureFlag = {
  /** The Provider's page collects the customer's address details it taxes by (`PhisPaymentObservedTotals.customer`). */
  CollectsCustomerDetails: 1 << 0,
  /** The Provider's page collects a business customer's tax ids. */
  CollectsTaxIds: 1 << 1,
} as const;

export type PhisPaymentAdditionKind = "tax" | "shipping" | "discount";

export type PhisPaymentAddition = {
  kind: PhisPaymentAdditionKind;
  minor: string;
  label: string;
  /** `PhisPaymentAdditionFlag`. */
  flags: number;
  /** Display-only decimal string such as "8.1"; never enters Core arithmetic. */
  rate: string | null;
  /** ISO country code, optionally followed by "-" and a region. */
  jurisdiction: string | null;
  /** Who owes a tax addition to the authority: the merchant, or the Provider as Merchant of Record. */
  collectedBy: "merchant" | "provider";
  /** The promotion code or stated discount reference behind a `discount`; null for every other kind. */
  code: string | null;
};

/** Bit flags of `PhisPaymentAddition.flags`. */
export const PhisPaymentAdditionFlag = {
  /** Contained in the base amount rather than added to it; never on a `discount`. */
  Inclusive: 1 << 0,
} as const;

export type PhisPaymentObservedTotals = {
  total: PhisPaymentMoney;
  additions: readonly PhisPaymentAddition[];
  customer: PhisPaymentCustomerDetails | null;
  /**
   * What the customer was shown and paid in their local currency where the Provider converted (Stripe:
   * `presentment_details` under Adaptive Pricing); `null` otherwise. Informational and never enters Core
   * arithmetic: amount, totals, captures, refunds and proration stay in the payment's currency.
   */
  presentment: PhisPaymentMoney | null;
};

export type PhisPaymentTotals = PhisPaymentObservedTotals & {
  /** Set by Core when the total became binding; a differing total afterwards is an inconsistency. */
  frozenAt: string | null;
};
