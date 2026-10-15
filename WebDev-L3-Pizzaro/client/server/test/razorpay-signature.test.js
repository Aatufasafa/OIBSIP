const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { validatePaymentVerification } = require("razorpay/dist/utils/razorpay-utils");

test("official Razorpay SDK validates payment signatures against the server secret", () => {
  const secret = "test-only-secret";
  const orderId = "order_test_123";
  const paymentId = "pay_test_456";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(
    validatePaymentVerification(
      { order_id: orderId, payment_id: paymentId },
      signature,
      secret
    ),
    true
  );
  assert.equal(
    validatePaymentVerification(
      { order_id: orderId, payment_id: paymentId },
      "0".repeat(64),
      secret
    ),
    false
  );
});
