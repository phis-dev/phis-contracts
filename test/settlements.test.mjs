// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import { isPhisPaymentSettlementBalanced } from "../dist/payments.js";

const chf = (minor) => ({ currency: "CHF", minor });
const record = (settled, fee, withheldTax, net, gross = settled.replace("-", "")) => ({
  gross: chf(gross),
  settled: chf(settled),
  fee: chf(fee),
  withheldTax: withheldTax === null ? null : chf(withheldTax),
  net: chf(net),
});

test("a capture: in, less the fee and the withheld tax", () => {
  assert.equal(isPhisPaymentSettlementBalanced(record("2187", "94", "164", "1929")), true);
});

test("a refund with a fee of its own goes out by more than was refunded", () => {
  assert.equal(isPhisPaymentSettlementBalanced(record("-1000", "30", null, "-1030")), true);
});

test("a refund that gives the fee back goes out by less", () => {
  assert.equal(isPhisPaymentSettlementBalanced(record("-1000", "-29", null, "-971")), true);
});

test("a refund under Merchant of Record that returns the withheld tax, or keeps it", () => {
  assert.equal(isPhisPaymentSettlementBalanced(record("-1000", "0", "-81", "-919")), true);
  assert.equal(isPhisPaymentSettlementBalanced(record("-1000", "0", null, "-1000")), true);
});

test("a failed refund coming back, and a dispute fee with nothing settled", () => {
  assert.equal(isPhisPaymentSettlementBalanced(record("1000", "0", null, "1000")), true);
  assert.equal(isPhisPaymentSettlementBalanced(record("0", "1500", null, "-1500", "2187")), true);
});

test("a record that does not add up, or is not money, is refused", () => {
  assert.equal(isPhisPaymentSettlementBalanced(record("-1000", "30", null, "-970")), false);
  assert.equal(isPhisPaymentSettlementBalanced(record("-1000", "30", null, "-1030", "-1000")), false);
  assert.equal(isPhisPaymentSettlementBalanced(record("-0", "0", null, "0", "0")), false);
  assert.equal(isPhisPaymentSettlementBalanced(record("1000", "1.5", null, "998.5")), false);
  assert.equal(isPhisPaymentSettlementBalanced({ ...record("1000", "0", null, "1000"), fee: { currency: "EUR", minor: "0" } }), false);
});
