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
 */

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
 * What a method is wanted for. `recurring` asks for the methods that can be stored while the customer
 * is present and charged later without them; absent means `one-time`.
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
  /** The stored method ends by itself; the record then carries `expiresAt`. */
  expires: boolean;
  /** `single`: a new stored method for the same payer replaces the previous one at the Provider. */
  perPayer: "single" | "many";
  /** The pricing policies a charge without a checkout supports; often narrower than the checkout's. */
  pricing: PhisPaymentPricingFeatures;
};

export type PhisPaymentFeatures = {
  captureModes: readonly PhisPaymentCaptureMode[];
  checkoutKinds: readonly PhisPaymentCheckoutKind[];
  canPartialCapture: boolean;
  canCancel: boolean;
  canRefund: boolean;
  canPartialRefund: boolean;
  pricing: PhisPaymentPricingFeatures;
  /** Absent or `null`: this method cannot be stored. That is every Provider built before stored methods. */
  stored?: PhisPaymentStoredFeatures | null;
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
  reconciliationRequired: boolean;
  version: number;
  lastObservedAt: string | null;
  /**
   * Who set the payment in motion. `customer`: a person on a checkout. `merchant` and `schedule`: a
   * stored method was charged without the customer, by a consumer's command or by Core's schedule.
   */
  initiator: PhisPaymentInitiator;
  /** The stored method this payment created (`customer`) or was charged to; `null` where neither. */
  storedMethodId: PhisPaymentStoredMethodId | null;
  /** The subscription and the period this payment settles; both `null` for a payment outside one. */
  subscriptionId: PhisPaymentSubscriptionId | null;
  periodIndex: number | null;
};

export type PhisPaymentInitiator = "customer" | "merchant" | "schedule";

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

/** One period length for the whole subscription; `{ unit: "month", count: 3 }` is a quarter. */
export type PhisPaymentInterval = { unit: "day" | "week" | "month" | "year"; count: number };

/**
 * What Core does after a renewal was declined. Each entry is a further attempt, that many days after
 * the day the period fell due; when they are used up the period has failed and the subscription becomes
 * `unpaid` (no further charges; somebody decides) or `canceled`. At most 8 attempts within 60 days.
 */
export type PhisPaymentDunningPolicy = {
  retryAfterDays: readonly number[];
  onExhausted: "unpaid" | "cancel";
};

/** What one charge of a subscription costs and is called: a Payment's amount, pricing and description. */
export type PhisPaymentSubscriptionTerms = {
  amount: PhisPaymentMoney;
  pricing: PhisPaymentPricing;
  description: string;
};

/**
 * An agreement Core charges on a schedule of its own.
 *
 * Core owns the schedule: period boundaries are computed from the start of the first period and never
 * from the day a charge happened to succeed, so a late charge does not move them. Every period is settled
 * by an ordinary Payment against the payer's stored method. Whether what was sold is switched on is the
 * consumer's knowledge alone.
 */
export type PhisPaymentSubscription = {
  id: PhisPaymentSubscriptionId;
  /** The consumer's business reference, unique among its subscriptions that have not ended. */
  reference: string;
  profileKey: string;
  mode: "test" | "live";
  payerReference: string;
  storedMethodId: PhisPaymentStoredMethodId | null;
  interval: PhisPaymentInterval;
  recurring: PhisPaymentSubscriptionTerms;
  dunning: PhisPaymentDunningPolicy;
  /**
   * `pending`: the first payment is open. `past_due`: a renewal failed and Core still tries, or waits
   * for the customer. `unpaid`: Core stopped trying. `canceled` is final.
   */
  status: "pending" | "active" | "past_due" | "unpaid" | "canceled";
  /** The open period cannot be charged without the customer; automatic attempts are paused. */
  customerActionRequired: boolean;
  /** The latest period that was paid; `null` until the first payment is captured. */
  period: { index: number; startsAt: string; endsAt: string } | null;
  /** When Core next acts on its own: a renewal, a retry, or the end of the time allowed. */
  nextChargeAt: string | null;
  /** No further period is charged; the subscription ends when the paid one does. */
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
  version: number;
};

export type PhisPaymentSubscriptionPeriod = {
  subscriptionId: PhisPaymentSubscriptionId;
  index: number;
  startsAt: string;
  endsAt: string;
  amount: PhisPaymentMoney;
  /** `void`: the subscription ended before this period was paid. */
  status: "open" | "paid" | "failed" | "void";
  /** Every payment made for this period, in order; where it is paid, the last one paid it. */
  paymentIds: readonly PhisPaymentId[];
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
  /** Absent or `null`: Core's default policy. */
  dunning?: PhisPaymentDunningPolicy | null;
  methodKey: string | null;
  checkoutKind: PhisPaymentCheckoutKind;
  returnPath: string;
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
  | "stored_method_unavailable";

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
};

export type PhisPaymentCommandInput = {
  paymentId: PhisPaymentId;
  idempotencyKey: string;
};

export interface PhisPaymentsCapabilityV1 {
  listMethods(input: {
    profileKey: string;
    amount: PhisPaymentMoney;
    captureMode: PhisPaymentCaptureMode;
    checkoutKind: PhisPaymentCheckoutKind;
    pricing: PhisPaymentPricingSelector;
    usage?: PhisPaymentUsage;
  }): Promise<readonly PhisPaymentMethod[]>;
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
   * Stores the agreement and opens its first payment, which also stores the method the customer pays
   * with. The subscription is `pending` until that payment is captured and `canceled` if it never is.
   */
  createSubscription(input: PhisPaymentSubscriptionCreateInput): Promise<PhisPaymentSubscriptionResult>;
  getSubscription(subscriptionId: PhisPaymentSubscriptionId): Promise<PhisPaymentSubscription | null>;
  /** Newest first. */
  listSubscriptionPeriods(subscriptionId: PhisPaymentSubscriptionId): Promise<readonly PhisPaymentSubscriptionPeriod[]>;
  /**
   * `period-end`: nothing further is charged and the subscription ends with the paid period; this is
   * what a customer asks for, through the consumer. `now` ends it at once, refunds nothing, and is a
   * merchant action under the grant's `subscriptionEnd` policy.
   */
  cancelSubscription(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    at: "period-end" | "now";
  }): Promise<PhisPaymentSubscription | null>;
  /** Takes back a cancellation at the period end, until that end has come. */
  resumeSubscription(subscriptionId: PhisPaymentSubscriptionId): Promise<PhisPaymentSubscription | null>;
  /**
   * The customer pays the open period on a checkout, which stores the method anew. For a subscription
   * that is `past_due` or `unpaid`; on capture it is `active` again and charged to the new method.
   */
  settleSubscription(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    idempotencyKey: string;
    methodKey: string | null;
    checkoutKind: PhisPaymentCheckoutKind;
    returnPath: string;
  }): Promise<PhisPaymentCommandResult>;
  /** Charges the subscription to another active stored method of the same payer and profile from now on. */
  replaceSubscriptionMethod(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    storedMethodId: PhisPaymentStoredMethodId;
  }): Promise<PhisPaymentSubscription | null>;
  /**
   * What every period from the next one on costs. Nothing already charged changes and nothing is
   * prorated; the consumer tells the customer. A merchant action under the grant's `subscriptionPrice`
   * policy, in the subscription's currency and within what the stored method can be charged.
   */
  changeSubscriptionPrice(input: {
    subscriptionId: PhisPaymentSubscriptionId;
    recurring: PhisPaymentSubscriptionTerms;
  }): Promise<PhisPaymentSubscription | null>;
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
  /** `subject` says which family `reference` belongs to; absent means `payment`. */
  | { outcome: "verified"; deliveryId: string; reference: string; subject?: "payment" | "stored-method" }
  | { outcome: "lookup-required"; reference: string; subject?: "payment" | "stored-method" }
  | { outcome: "irrelevant" }
  | { outcome: "rejected" }
  | { outcome: "unavailable" };

export interface PhisPaymentProviderV1 {
  probe(input: {
    amount: PhisPaymentMoney;
    captureMode: PhisPaymentCaptureMode;
    checkoutKind: PhisPaymentCheckoutKind;
    pricing: PhisPaymentPricingSelector;
    /** `recurring`: answer only the methods that can be stored and charged for this amount and pricing. */
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
}

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
  /** Also needs `create` and `method-store`: the first payment is one, and it stores the method. */
  | "subscription-create"
  /** Cancel at the period end, resume, settle the open period, and change the stored method. */
  | "subscription-cancel";

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
  collectsCustomerDetails: boolean;
  collectsTaxIds: boolean;
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

export type PhisPaymentAdditionKind = "tax" | "shipping" | "discount";

export type PhisPaymentAddition = {
  kind: PhisPaymentAdditionKind;
  minor: string;
  label: string;
  /** Contained in the base amount rather than added to it; a `discount` is never inclusive. */
  inclusive: boolean;
  /** Display-only decimal string such as "8.1"; never enters Core arithmetic. */
  rate: string | null;
  /** ISO country code, optionally followed by "-" and a region. */
  jurisdiction: string | null;
  /** Who owes a tax addition to the authority: the merchant, or the Provider as Merchant of Record. */
  collectedBy: "merchant" | "provider";
  /** The promotion code or stated discount reference behind a `discount`; null for every other kind. */
  code: string | null;
};

export type PhisPaymentObservedTotals = {
  total: PhisPaymentMoney;
  additions: readonly PhisPaymentAddition[];
  customer: PhisPaymentCustomerDetails | null;
};

export type PhisPaymentTotals = PhisPaymentObservedTotals & {
  /** Set by Core when the total became binding; a differing total afterwards is an inconsistency. */
  frozenAt: string | null;
};
