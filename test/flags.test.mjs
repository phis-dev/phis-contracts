// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import * as payments from "../dist/payments.js";
import * as billing from "../dist/billing.js";
import * as entitlements from "../dist/entitlements.js";
import { PHIS_ADDON_EVENTS, PHIS_CORE_CAPABILITIES } from "../dist/core.js";

const flagObjects = {
  PhisPaymentFlag: payments.PhisPaymentFlag,
  PhisPaymentFeatureFlag: payments.PhisPaymentFeatureFlag,
  PhisPaymentStoredFeatureFlag: payments.PhisPaymentStoredFeatureFlag,
  PhisPaymentPricingFeatureFlag: payments.PhisPaymentPricingFeatureFlag,
  PhisPaymentSubscriptionFlag: payments.PhisPaymentSubscriptionFlag,
  PhisPaymentAdditionFlag: payments.PhisPaymentAdditionFlag,
  PhisPaymentScheduleFeatureFlag: payments.PhisPaymentScheduleFeatureFlag,
  PhisPaymentCurrencyFeatureFlag: payments.PhisPaymentCurrencyFeatureFlag,
  PhisPaymentDocumentFeatureFlag: payments.PhisPaymentDocumentFeatureFlag,
  PhisBillingDocumentFlag: billing.PhisBillingDocumentFlag,
  PhisBillingNumberSeriesFlag: billing.PhisBillingNumberSeriesFlag,
  PhisEntitlementFlag: entitlements.PhisEntitlementFlag,
  PhisEntitlementStateFlag: entitlements.PhisEntitlementStateFlag,
  PhisEntitlementListFlag: entitlements.PhisEntitlementListFlag,
};

for (const [name, flags] of Object.entries(flagObjects)) {
  test(`${name} is single bits from bit 0 on, each used once`, () => {
    assert.ok(flags, `${name} is exported`);
    const values = Object.values(flags);
    assert.ok(values.length > 0);
    values.forEach((value, index) => assert.equal(value, 1 << index, `${name} bit ${index}`));
  });
}

test("the switching and settlement flags have the bits the design names", () => {
  assert.equal(payments.PhisPaymentSubscriptionFlag.CustomerActionRequired, 1);
  assert.equal(payments.PhisPaymentSubscriptionFlag.CancelAtPeriodEnd, 2);
  assert.equal(payments.PhisPaymentFeatureFlag.PartialRefund, 8);
  assert.equal(payments.PhisPaymentCurrencyFeatureFlag.SettlementRecords, 1);
  assert.equal(billing.PhisBillingDocumentFlag.Detached, 4);
  assert.equal(billing.PhisBillingNumberSeriesFlag.Used, 2);
});

test("billing:v1 is a Core capability with its event", () => {
  assert.equal(PHIS_CORE_CAPABILITIES.billing, "@phis/server/billing:v1");
  assert.equal(PHIS_ADDON_EVENTS.billingDocumentChanged, "billing-document.changed");
});

test("the limits are stated", () => {
  assert.equal(billing.PHIS_BILLING_DOCUMENT_NUMBER_MAX_LENGTH, 40);
  assert.equal(entitlements.PHIS_ENTITLEMENT_LIST_MAX, 500);
  assert.equal(entitlements.PHIS_ENTITLEMENT_NAMED_MAX, 100);
});
