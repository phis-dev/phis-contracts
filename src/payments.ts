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

export type PhisPaymentCaptureMode = "automatic" | "manual";
export type PhisPaymentCheckoutKind = "redirect" | "provider-ui";

export type PhisPaymentFeatures = {
  captureModes: readonly PhisPaymentCaptureMode[];
  checkoutKinds: readonly PhisPaymentCheckoutKind[];
  canPartialCapture: boolean;
  canCancel: boolean;
  canRefund: boolean;
  canPartialRefund: boolean;
  pricing: PhisPaymentPricingFeatures;
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
  | "reconciliation_required";

export type PhisPaymentOperation = {
  id: PhisPaymentOperationId;
  paymentId: PhisPaymentId;
  action: "create" | "complete" | "capture" | "cancel" | "refund";
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
  | { outcome: "verified"; deliveryId: string; reference: string }
  | { outcome: "lookup-required"; reference: string }
  | { outcome: "irrelevant" }
  | { outcome: "rejected" }
  | { outcome: "unavailable" };

export interface PhisPaymentProviderV1 {
  probe(input: {
    amount: PhisPaymentMoney;
    captureMode: PhisPaymentCaptureMode;
    checkoutKind: PhisPaymentCheckoutKind;
    pricing: PhisPaymentPricingSelector;
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
  | "refund";

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
  subject: {
    kind: "payment";
    paymentId: PhisPaymentId;
    reference: string;
    version: number;
    operationId: PhisPaymentOperationId | null;
    refundId: PhisPaymentRefundId | null;
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
};

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
