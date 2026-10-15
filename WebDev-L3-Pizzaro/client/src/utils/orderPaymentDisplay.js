export function getOrderPaymentDisplay(order) {
  const total = Math.max(0, Number(order.total) || 0);
  const isCancelled = order.status === "Cancelled";
  const isRazorpay = order.paymentMethod === "razorpay";
  const isCod = order.paymentMethod === "cod";
  const refundInitiated =
    isRazorpay &&
    (order.paymentStatus === "refunded" || Boolean(order.refundId));
  const razorpayPaid =
    isRazorpay && order.paymentStatus === "paid" && !refundInitiated;

  let statusLabel = "Payment status unavailable";
  let statusTone = "unknown";

  if (refundInitiated) {
    statusLabel = "Refund initiated";
    statusTone = "refund";
  } else if (isCancelled && razorpayPaid) {
    statusLabel = "Cancelled — refund status requires review";
    statusTone = "refund";
  } else if (isCancelled) {
    statusLabel = "Cancelled — no payment due";
    statusTone = "cancelled";
  } else if (order.paymentStatus === "pending") {
    statusLabel = "Payment pending";
    statusTone = "pending";
  } else if (razorpayPaid) {
    statusLabel = "PAID — Razorpay";
    statusTone = "paid";
  } else if (isCod && order.paymentStatus === "not_required") {
    statusLabel = "Payment due — pay on delivery";
    statusTone = "due";
  } else if (isRazorpay) {
    statusLabel = "Payment not confirmed";
    statusTone = "pending";
  } else if (isCod) {
    statusLabel = "Payment status requires review";
  }

  return {
    methodLabel: isCod
      ? "CASH ON DELIVERY"
      : isRazorpay
        ? "RAZORPAY"
        : "PAYMENT METHOD UNAVAILABLE",
    statusLabel,
    statusTone,
    total,
    paid: razorpayPaid || refundInitiated ? total : 0,
    due: isCancelled || razorpayPaid || refundInitiated ? 0 : total,
    refundInitiated,
    refundAmount: refundInitiated ? total : 0,
    paidLabel: refundInitiated ? "Captured" : "Paid",
  };
}

export function formatOrderAmount(amount) {
  return `₹${Number(amount).toFixed(2).replace(/\.00$/, "")}`;
}
