const mongoose = require("mongoose");

const paymentAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestId: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
    state: {
      type: String,
      enum: ["creating", "pending", "completed", "failed", "expired"],
      default: "creating",
      required: true,
    },
    razorpayOrderId: { type: String, default: null },
    totalPaise: { type: Number, required: true, min: 100 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    orderData: { type: mongoose.Schema.Types.Mixed, required: true },
    inventoryDeductions: [
      {
        ingredient: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        key: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    completedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    expiresAt: { type: Date, required: true },
    failureReason: { type: String, default: null },
  },
  { timestamps: true }
);

paymentAttemptSchema.index({ user: 1, requestId: 1 }, { unique: true });
paymentAttemptSchema.index({ state: 1, expiresAt: 1 });

module.exports = mongoose.model("PaymentAttempt", paymentAttemptSchema);
