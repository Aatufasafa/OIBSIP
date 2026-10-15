const PaymentAttempt = require("../models/PaymentAttempt");
const { restoreInventory } = require("./inventory");
const { getRazorpay } = require("../utils/razorpay");
const { runTransactionIfAvailable } = require("./mongo-transaction");

const PAYMENT_RESERVATION_TTL_MS = 15 * 60 * 1000;

async function expireLocalAttempt(attempt) {
  const transaction = await runTransactionIfAvailable(async (session) => {
    const claimed = await PaymentAttempt.findOneAndUpdate(
      {
        _id: attempt._id,
        state: attempt.state,
        expiresAt: { $lte: new Date() },
      },
      { $set: { state: "expired", failureReason: "Payment reservation expired" } },
      { new: true, session }
    );
    if (!claimed) return false;
    await restoreInventory(claimed.inventoryDeductions, session);
    return true;
  });
  if (transaction.supported) return;

  const claimed = await PaymentAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      state: attempt.state,
      expiresAt: { $lte: new Date() },
    },
    { $set: { state: "expired", failureReason: "Payment reservation expired" } },
    { new: true }
  );
  if (!claimed) return;
  try {
    await restoreInventory(claimed.inventoryDeductions);
  } catch (error) {
    await PaymentAttempt.updateOne(
      { _id: claimed._id, state: "expired" },
      {
        $set: {
          state: attempt.state,
          expiresAt: new Date(Date.now() + PAYMENT_RESERVATION_TTL_MS),
        },
      }
    );
    throw error;
  }
}

async function expirePaymentAttempts() {
  const expiredAttempts = await PaymentAttempt.find({
    state: { $in: ["creating", "pending"] },
    expiresAt: { $lte: new Date() },
  }).limit(50);

  for (const attempt of expiredAttempts) {
    try {
      if (attempt.state === "creating" && !attempt.razorpayOrderId) {
        await expireLocalAttempt(attempt);
        continue;
      }
      if (attempt.state !== "pending" || !attempt.razorpayOrderId) continue;

      const razorpay = getRazorpay();
      const [paymentOrder, payments] = await Promise.all([
        razorpay.orders.fetch(attempt.razorpayOrderId),
        razorpay.orders.fetchPayments(attempt.razorpayOrderId),
      ]);
      const paymentMayHaveSucceeded =
        paymentOrder.status === "paid" ||
        payments.items.some((payment) =>
          ["authorized", "captured"].includes(payment.status)
        );

      if (paymentMayHaveSucceeded) {
        await PaymentAttempt.updateOne(
          { _id: attempt._id, state: "pending" },
          { $set: { expiresAt: new Date(Date.now() + PAYMENT_RESERVATION_TTL_MS) } }
        );
        console.warn(
          `Payment attempt ${attempt._id} requires verification; inventory remains reserved`
        );
        continue;
      }
      await expireLocalAttempt(attempt);
    } catch (error) {
      console.error(`Unable to expire payment attempt ${attempt._id}:`, error);
    }
  }
}

module.exports = { expirePaymentAttempts };
