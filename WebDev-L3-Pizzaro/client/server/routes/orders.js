const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const PaymentAttempt = require("../models/PaymentAttempt");
const protect = require("../middleware/auth");
const { OrderInputError, prepareOrder } = require("../data/catalog");
const {
  StockUnavailableError,
  reserveInventory,
  restoreInventory,
} = require("../services/inventory");
const { runTransactionIfAvailable } = require("../services/mongo-transaction");
const { getRazorpay, validatePaymentVerification } = require("../utils/razorpay");

const router = express.Router();
const STATUS_STEPS = [
  "Order Received",
  "In Kitchen",
  "Sent to Delivery",
  "Delivered",
];
const PAYMENT_RESERVATION_TTL_MS = 15 * 60 * 1000;

function diagnosticCode(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
    ? value
    : undefined;
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function validateCheckoutDetails(body) {
  const {
    customerName,
    mobile,
    address,
    city,
    pincode,
    paymentMethod = "cod",
    cookingRequest = "",
    instructions = [],
    checkoutRequestId,
  } = body;

  if (
    typeof customerName !== "string" ||
    !customerName.trim() ||
    customerName.trim().length > 100 ||
    typeof mobile !== "string" ||
    !/^[6-9]\d{9}$/.test(mobile) ||
    typeof address !== "string" ||
    !address.trim() ||
    address.trim().length > 300 ||
    typeof city !== "string" ||
    !city.trim() ||
    city.trim().length > 100 ||
    typeof pincode !== "string" ||
    !/^\d{6}$/.test(pincode) ||
    !["cod", "razorpay"].includes(paymentMethod) ||
    typeof cookingRequest !== "string" ||
    cookingRequest.length > 500 ||
    !Array.isArray(instructions) ||
    instructions.length > 4 ||
    instructions.some(
      (instruction) =>
        !["door", "call", "bell", "contactless"].includes(instruction)
    ) ||
    typeof checkoutRequestId !== "string" ||
    !/^[a-zA-Z0-9-]{8,100}$/.test(checkoutRequestId)
  ) {
    throw new OrderInputError("Invalid delivery details or checkout request");
  }
  body.paymentMethod = paymentMethod;
}

function createOrderData(body, calculated) {
  return {
    items: calculated.items,
    total: calculated.total,
    tipAmount: calculated.tipAmount,
    customerName: body.customerName.trim(),
    mobile: body.mobile,
    address: body.address.trim(),
    city: body.city.trim(),
    pincode: body.pincode,
    paymentMethod: body.paymentMethod,
    cookingRequest: (body.cookingRequest || "").trim(),
    instructions: [...new Set(body.instructions || [])],
  };
}

function fingerprintOrder(orderData) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(orderData))
    .digest("hex");
}

function buildOrderDocument(userId, requestId, fingerprint, data, deductions, extra = {}) {
  return {
    user: userId,
    ...data,
    checkoutRequestId: requestId,
    checkoutFingerprint: fingerprint,
    inventoryDeductions: deductions,
    status: "Order Received",
    cancellationDeadline: new Date(Date.now() + 2 * 60 * 1000),
    ...extra,
  };
}

async function createCodOrder(req, res, data, fingerprint) {
  const existing = await Order.findOne({
    user: req.user.userId,
    checkoutRequestId: req.body.checkoutRequestId,
  });
  if (existing) {
    if (existing.checkoutFingerprint !== fingerprint) {
      return res.status(409).json({ message: "Checkout request id was already used" });
    }
    return res.json({ message: "Order already created", order: existing });
  }

  const prepared = prepareOrder(req.body);
  let transaction;
  try {
    transaction = await runTransactionIfAvailable(async (session) => {
      const deductions = await reserveInventory(prepared.stockRequirements, session);
      const [order] = await Order.create(
        [
          buildOrderDocument(
            req.user.userId,
            req.body.checkoutRequestId,
            fingerprint,
            data,
            deductions,
            { paymentStatus: "not_required" }
          ),
        ],
        { session }
      );
      return order;
    });
  } catch (error) {
    if (error.code === 11000 || error instanceof StockUnavailableError) {
      const duplicate = await Order.findOne({
        user: req.user.userId,
        checkoutRequestId: req.body.checkoutRequestId,
      });
      if (duplicate && duplicate.checkoutFingerprint === fingerprint) {
        return res.json({ message: "Order already created", order: duplicate });
      }
    }
    throw error;
  }
  if (transaction.supported) {
    return res.status(201).json({
      message: "Order created successfully",
      order: transaction.result,
    });
  }

  let deductions;
  try {
    deductions = await reserveInventory(prepared.stockRequirements);
  } catch (error) {
    if (error instanceof StockUnavailableError) {
      const duplicate = await Order.findOne({
        user: req.user.userId,
        checkoutRequestId: req.body.checkoutRequestId,
      });
      if (duplicate && duplicate.checkoutFingerprint === fingerprint) {
        return res.json({ message: "Order already created", order: duplicate });
      }
    }
    throw error;
  }
  try {
    const order = await Order.create(
      buildOrderDocument(
        req.user.userId,
        req.body.checkoutRequestId,
        fingerprint,
        data,
        deductions,
        { paymentStatus: "not_required" }
      )
    );
    return res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    await restoreInventory(deductions);
    if (error.code === 11000) {
      const duplicate = await Order.findOne({
        user: req.user.userId,
        checkoutRequestId: req.body.checkoutRequestId,
      });
      if (duplicate && duplicate.checkoutFingerprint === fingerprint) {
        return res.json({ message: "Order already created", order: duplicate });
      }
      return res.status(409).json({ message: "Checkout request id was already used" });
    }
    throw error;
  }
}

function paymentAttemptResponse(attempt) {
  return {
    message: "Payment order created",
    payment: {
      attemptId: attempt._id,
      orderId: attempt.razorpayOrderId,
      amount: attempt.totalPaise,
      currency: attempt.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  };
}

async function createConfirmedOrder(attempt, userId, paymentId) {
  const createInSession = async (session) => {
    const latestAttempt = await PaymentAttempt.findById(attempt._id).session(session);
    if (!latestAttempt) throw new Error("Payment attempt no longer exists");
    if (latestAttempt.state === "completed" && latestAttempt.completedOrder) {
      return Order.findById(latestAttempt.completedOrder).session(session);
    }
    if (latestAttempt.state !== "pending") {
      throw new Error("Payment attempt is no longer active");
    }

    let order = await Order.findOne({
      user: userId,
      checkoutRequestId: latestAttempt.requestId,
    }).session(session);
    if (order && order.checkoutFingerprint !== latestAttempt.requestFingerprint) {
      throw Object.assign(new Error("Payment request does not match this order"), { status: 409 });
    }
    if (!order) {
      [order] = await Order.create(
        [
          buildOrderDocument(
            userId,
            latestAttempt.requestId,
            latestAttempt.requestFingerprint,
            latestAttempt.orderData,
            latestAttempt.inventoryDeductions,
            {
              paymentStatus: "paid",
              razorpayOrderId: latestAttempt.razorpayOrderId,
              razorpayPaymentId: paymentId,
            }
          ),
        ],
        { session }
      );
    }
    latestAttempt.state = "completed";
    latestAttempt.completedOrder = order._id;
    await latestAttempt.save({ session });
    return order;
  };

  const transaction = await runTransactionIfAvailable(createInSession);
  if (transaction.supported) return transaction.result;

  const latestAttempt = await PaymentAttempt.findById(attempt._id);
  if (!latestAttempt) throw new Error("Payment attempt no longer exists");
  if (latestAttempt.state === "completed" && latestAttempt.completedOrder) {
    return Order.findById(latestAttempt.completedOrder);
  }
  if (latestAttempt.state !== "pending") {
    throw Object.assign(new Error("Payment attempt is no longer active"), { status: 409 });
  }

  let order = await Order.findOne({
    user: userId,
    checkoutRequestId: latestAttempt.requestId,
  });
  if (order && order.checkoutFingerprint !== latestAttempt.requestFingerprint) {
    throw Object.assign(new Error("Payment request does not match this order"), { status: 409 });
  }
  if (!order) {
    order = await Order.create(
      buildOrderDocument(
        userId,
        latestAttempt.requestId,
        latestAttempt.requestFingerprint,
        latestAttempt.orderData,
        latestAttempt.inventoryDeductions,
        {
          paymentStatus: "paid",
          razorpayOrderId: latestAttempt.razorpayOrderId,
          razorpayPaymentId: paymentId,
        }
      )
    );
  }
  const updated = await PaymentAttempt.findOneAndUpdate(
    { _id: latestAttempt._id, state: "pending" },
    { $set: { state: "completed", completedOrder: order._id } },
    { new: true }
  );
  if (!updated && latestAttempt.state !== "completed") {
    const completed = await PaymentAttempt.findById(latestAttempt._id);
    if (completed?.state !== "completed") {
      throw new Error("Payment confirmation could not be recorded");
    }
    return Order.findById(completed.completedOrder);
  }
  return order;
}

async function createRazorpayOrder(req, res, data, fingerprint) {
  let attempt;
  let phase = "create_payment_attempt";
  try {
    attempt = await PaymentAttempt.create({
      user: req.user.userId,
      requestId: req.body.checkoutRequestId,
      requestFingerprint: fingerprint,
      state: "creating",
      totalPaise: Math.round(data.total * 100),
      orderData: data,
      expiresAt: new Date(Date.now() + PAYMENT_RESERVATION_TTL_MS),
    });
  } catch (error) {
    if (error.code !== 11000) {
      console.error("Payment attempt creation failed:", {
        errorType: typeof error?.name === "string" ? error.name : "Error",
        errorCode:
          Number.isInteger(error?.code) ? error.code : diagnosticCode(error?.code),
      });
      throw error;
    }
    attempt = await PaymentAttempt.findOne({
      user: req.user.userId,
      requestId: req.body.checkoutRequestId,
    });
    if (!attempt || attempt.requestFingerprint !== fingerprint) {
      return res.status(409).json({ message: "Checkout request id was already used" });
    }
    if (attempt.state === "pending" && attempt.razorpayOrderId) {
      return res.json(paymentAttemptResponse(attempt));
    }
    if (attempt.state === "completed" && attempt.completedOrder) {
      const order = await Order.findById(attempt.completedOrder);
      return res.json({ message: "Payment already confirmed", order });
    }
    return res.status(409).json({ message: "This payment attempt is already being processed or has expired" });
  }

  let deductions = [];
  try {
    phase = "prepare_order";
    const prepared = prepareOrder(req.body);
    phase = "reserve_inventory";
    const transaction = await runTransactionIfAvailable(async (session) => {
      const reserved = await reserveInventory(prepared.stockRequirements, session);
      attempt.inventoryDeductions = reserved;
      await attempt.save({ session });
      return reserved;
    });
    if (transaction.supported) {
      deductions = transaction.result;
    } else {
      deductions = await reserveInventory(prepared.stockRequirements);
      attempt.inventoryDeductions = deductions;
      await attempt.save();
    }

    phase = "initialize_razorpay";
    const razorpay = getRazorpay();
    phase = "create_provider_order";
    const paymentOrder = await razorpay.orders.create({
      amount: attempt.totalPaise,
      currency: "INR",
      receipt: `pz_${attempt._id.toString()}`,
      notes: { userId: req.user.userId },
    });
    phase = "save_payment_attempt";
    attempt.razorpayOrderId = paymentOrder.id;
    attempt.state = "pending";
    await attempt.save();
    return res.status(201).json(paymentAttemptResponse(attempt));
  } catch (error) {
    const providerError =
      error?.error && typeof error.error === "object" ? error.error : {};
    console.error("Payment order setup failed:", {
      phase,
      errorType: typeof error?.name === "string" ? error.name : "Error",
      errorCode:
        Number.isInteger(error?.code) ? error.code : diagnosticCode(error?.code),
      statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : undefined,
      providerCode: diagnosticCode(providerError.code),
      providerReason: diagnosticCode(providerError.reason),
    });
    if (deductions.length) await restoreInventory(deductions);
    attempt.state = "failed";
    attempt.failureReason = "Unable to create payment order";
    await attempt.save();
    if (error instanceof StockUnavailableError) {
      return res.status(409).json({ message: error.message });
    }
    if (error.message === "Razorpay test credentials are not configured") {
      return res.status(503).json({ message: error.message });
    }
    return res.status(502).json({ message: "Unable to create a payment order" });
  }
}

router.post("/", protect, async (req, res) => {
  try {
    const body = req.body || {};
    validateCheckoutDetails(body);
    const calculated = prepareOrder(body);
    const data = createOrderData(body, calculated);
    const fingerprint = fingerprintOrder(data);
    if (body.paymentMethod === "razorpay") {
      const existingOrder = await Order.findOne({
        user: req.user.userId,
        checkoutRequestId: body.checkoutRequestId,
      });
      if (existingOrder) {
        return res.status(409).json({ message: "Checkout request id was already used" });
      }
      return await createRazorpayOrder(req, res, data, fingerprint);
    }
    const existingPayment = await PaymentAttempt.findOne({
      user: req.user.userId,
      requestId: body.checkoutRequestId,
    });
    if (existingPayment) {
      return res.status(409).json({ message: "Checkout request id was already used" });
    }
    return await createCodOrder(req, res, data, fingerprint);
  } catch (error) {
    if (error instanceof OrderInputError) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof StockUnavailableError) {
      return res.status(409).json({ message: error.message });
    }
    console.error("Create order error:", error);
    res.status(500).json({ message: "Server error while creating order" });
  }
});

router.post("/razorpay/verify", protect, async (req, res) => {
  try {
    const {
      attemptId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (
      typeof attemptId !== "string" ||
      !mongoose.isValidObjectId(attemptId) ||
      typeof razorpayOrderId !== "string" ||
      !/^[A-Za-z0-9_]{6,128}$/.test(razorpayOrderId) ||
      typeof razorpayPaymentId !== "string" ||
      !/^[A-Za-z0-9_]{6,128}$/.test(razorpayPaymentId) ||
      typeof signature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      return res.status(400).json({ message: "Invalid payment verification details" });
    }

    const attempt = await PaymentAttempt.findOne({
      _id: attemptId,
      user: req.user.userId,
    });
    if (!attempt || attempt.razorpayOrderId !== razorpayOrderId) {
      return res.status(404).json({ message: "Payment attempt not found" });
    }
    if (attempt.state === "completed" && attempt.completedOrder) {
      const order = await Order.findById(attempt.completedOrder);
      return res.json({ message: "Payment already confirmed", order });
    }
    if (attempt.state !== "pending" || attempt.expiresAt <= new Date()) {
      return res.status(400).json({ message: "Payment attempt is no longer active" });
    }

    const razorpay = getRazorpay();
    let isSignatureValid = false;
    try {
      isSignatureValid = validatePaymentVerification(
        { order_id: razorpayOrderId, payment_id: razorpayPaymentId },
        signature,
        process.env.RAZORPAY_KEY_SECRET
      );
    } catch (error) {
      console.error("Razorpay signature verification error:", error.message);
    }
    if (!isSignatureValid) {
      return res.status(400).json({ message: "Payment signature verification failed" });
    }

    let payment = await razorpay.payments.fetch(razorpayPaymentId);
    if (
      payment.order_id !== attempt.razorpayOrderId ||
      payment.amount !== attempt.totalPaise ||
      payment.currency !== attempt.currency
    ) {
      return res.status(400).json({
        message: "Payment does not match the expected order amount",
      });
    }
    if (payment.status === "authorized") {
      await razorpay.payments.capture(
        razorpayPaymentId,
        attempt.totalPaise,
        attempt.currency
      );
      payment = await razorpay.payments.fetch(razorpayPaymentId);
    }
    if (payment.status !== "captured") {
      return res.status(400).json({
        message: "Payment has not been captured; the order is not confirmed",
      });
    }

    const order = await createConfirmedOrder(
      attempt,
      req.user.userId,
      razorpayPaymentId
    );
    return res.status(201).json({
      message: "Payment verified and order confirmed",
      order,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.code === 11000) {
      const duplicate = await Order.findOne({
        user: req.user.userId,
        razorpayOrderId: req.body?.razorpay_order_id,
        paymentStatus: "paid",
      });
      if (duplicate) {
        await PaymentAttempt.updateOne(
          { _id: req.body.attemptId, user: req.user.userId, state: "pending" },
          { $set: { state: "completed", completedOrder: duplicate._id } }
        );
        return res.json({ message: "Payment already confirmed", order: duplicate });
      }
    }
    console.error("Payment verification error:", error);
    res.status(502).json({ message: "Unable to verify payment right now. Please retry." });
  }
});

async function releasePaymentReservation(attempt, state, reason) {
  const transaction = await runTransactionIfAvailable(async (session) => {
    const claimed = await PaymentAttempt.findOneAndUpdate(
      { _id: attempt._id, state: "pending" },
      { $set: { state, failureReason: reason } },
      { new: true, session }
    );
    if (!claimed) return false;
    await restoreInventory(claimed.inventoryDeductions, session);
    return true;
  });
  if (transaction.supported) return transaction.result;

  const claimed = await PaymentAttempt.findOneAndUpdate(
    { _id: attempt._id, state: "pending" },
    { $set: { state, failureReason: reason } },
    { new: true }
  );
  if (!claimed) return false;
  try {
    await restoreInventory(claimed.inventoryDeductions);
    return true;
  } catch (error) {
    await PaymentAttempt.updateOne(
      { _id: claimed._id, state },
      { $set: { state: "pending", failureReason: null } }
    );
    throw error;
  }
}

router.post("/razorpay/cancel", protect, async (req, res) => {
  try {
    const { attemptId } = req.body || {};
    if (typeof attemptId !== "string" || !mongoose.isValidObjectId(attemptId)) {
      return res.status(400).json({ message: "Invalid payment attempt" });
    }
    const attempt = await PaymentAttempt.findOne({
      _id: attemptId,
      user: req.user.userId,
    });
    if (!attempt) return res.status(404).json({ message: "Payment attempt not found" });
    if (attempt.state === "completed") {
      return res.status(409).json({ message: "This payment has already been confirmed" });
    }
    if (attempt.state !== "pending") {
      return res.json({ message: "Payment attempt is already closed" });
    }

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
      return res.status(409).json({
        message: "A payment may have succeeded. Verify it before retrying or closing this checkout.",
      });
    }

    const released = await releasePaymentReservation(
      attempt,
      "failed",
      "Checkout was cancelled or payment failed"
    );
    return res.json({
      message: released ? "Payment cancelled and reserved stock released" : "Payment attempt was already closed",
    });
  } catch (error) {
    console.error("Payment cancellation error:", error);
    res.status(502).json({ message: "Unable to safely close the payment attempt" });
  }
});

async function cancelOrder(order, { enforceDeadline }) {
  if (order.status !== "Order Received" || order.cancellationInProgress) {
    throw Object.assign(new Error("This order can no longer be cancelled"), { status: 409 });
  }
  if (
    enforceDeadline &&
    (!order.cancellationDeadline || order.cancellationDeadline <= new Date())
  ) {
    throw Object.assign(new Error("The 2-minute cancellation window has expired"), { status: 409 });
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "Order Received",
      cancellationInProgress: { $ne: true },
      ...(enforceDeadline ? { cancellationDeadline: { $gt: new Date() } } : {}),
    },
    { $set: { cancellationInProgress: true } },
    { new: true }
  );
  if (!claimed) {
    throw Object.assign(new Error("Order cancellation is already being processed"), { status: 409 });
  }

  try {
    let refundId = claimed.refundId;
    if (claimed.paymentStatus === "paid" && claimed.paymentMethod === "razorpay") {
      if (!claimed.razorpayPaymentId) {
        throw new Error("Paid order has no payment reference for refund");
      }
      if (!refundId) {
        const refund = await getRazorpay().payments.refund(
          claimed.razorpayPaymentId,
          {
            amount: Math.round(claimed.total * 100),
            notes: { orderId: claimed._id.toString() },
          }
        );
        refundId = refund.id;
        const savedRefund = await Order.updateOne(
          { _id: claimed._id, cancellationInProgress: true },
          { $set: { refundId } }
        );
        if (savedRefund.modifiedCount !== 1) {
          throw new Error("Refund reference could not be recorded");
        }
      }
    }

    const finalize = async (session) => {
      let currentQuery = Order.findById(claimed._id);
      if (session) currentQuery = currentQuery.session(session);
      const current = await currentQuery;
      if (!current || !current.cancellationInProgress) {
        throw Object.assign(new Error("Cancellation is no longer active"), { status: 409 });
      }
      if (!current.inventoryRestoredAt) {
        await restoreInventory(current.inventoryDeductions, session);
      }
      return Order.findOneAndUpdate(
        { _id: current._id, cancellationInProgress: true },
        {
          $set: {
            status: "Cancelled",
            cancelledAt: new Date(),
            inventoryRestoredAt: new Date(),
            cancellationInProgress: false,
            ...(refundId ? { paymentStatus: "refunded", refundId } : {}),
          },
        },
        { new: true, ...(session ? { session } : {}) }
      );
    };

    const transaction = await runTransactionIfAvailable(finalize);
    if (transaction.supported) return transaction.result;

    let fallbackRestored = false;
    try {
      const current = await Order.findById(claimed._id);
      if (!current || !current.cancellationInProgress) {
        throw Object.assign(new Error("Cancellation is no longer active"), { status: 409 });
      }
      if (!current.inventoryRestoredAt) {
        await restoreInventory(current.inventoryDeductions);
        fallbackRestored = true;
      }
      const cancelled = await Order.findOneAndUpdate(
        { _id: current._id, cancellationInProgress: true },
        {
          $set: {
            status: "Cancelled",
            cancelledAt: new Date(),
            inventoryRestoredAt: new Date(),
            cancellationInProgress: false,
            ...(refundId ? { paymentStatus: "refunded", refundId } : {}),
          },
        },
        { new: true }
      );
      if (!cancelled) throw new Error("Cancelled order could not be saved");
      return cancelled;
    } catch (error) {
      if (fallbackRestored) {
        try {
          await reserveInventory(
            new Map(
              claimed.inventoryDeductions.map((entry) => [entry.key, entry.quantity])
            )
          );
        } catch (rollbackError) {
          console.error("Cancellation inventory rollback failed:", rollbackError);
        }
      }
      throw error;
    }
  } catch (error) {
    await Order.updateOne(
      { _id: claimed._id, cancellationInProgress: true },
      { $set: { cancellationInProgress: false } }
    );
    throw error;
  }
}

router.get("/my-orders", protect, async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user.userId,
      paymentStatus: { $ne: "pending" },
    }).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ message: "Server error while fetching orders" });
  }
});

router.patch("/:id/cancel", protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    const cancelled = await cancelOrder(order, { enforceDeadline: true });
    res.json({ message: "Order cancelled successfully", order: cancelled });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("Cancel order error:", error);
    res.status(500).json({ message: "Server error while cancelling order" });
  }
});

router.get("/admin/all", protect, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find({ paymentStatus: { $ne: "pending" } })
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    console.error("Admin fetch orders error:", error);
    res.status(500).json({ message: "Failed to fetch all orders" });
  }
});

router.patch("/admin/:id/status", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    const { status } = req.body || {};
    if (![...STATUS_STEPS, "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (status === order.status) return res.json({ message: "Order status unchanged", order });
    if (status === "Cancelled") {
      const cancelled = await cancelOrder(order, { enforceDeadline: false });
      return res.json({ message: "Order cancelled", order: cancelled });
    }

    const currentIndex = STATUS_STEPS.indexOf(order.status);
    if (status !== STATUS_STEPS[currentIndex + 1]) {
      return res.status(400).json({
        message: "Order status must advance through the defined tracking stages",
      });
    }
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        cancellationInProgress: { $ne: true },
      },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!updatedOrder) {
      return res.status(409).json({ message: "Order status changed; refresh and try again" });
    }
    res.json({ message: "Order status updated", order: updatedOrder });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("Admin status update error:", error);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

module.exports = router;
