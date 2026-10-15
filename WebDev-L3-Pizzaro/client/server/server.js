const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cron = require("node-cron");
require("dotenv").config();
const inventoryRoutes = require("./routes/inventory");
const { ensureInventoryCatalog } = require("./services/inventory");
const { checkLowStock } = require("./services/low-stock-alerts");
const { isLowStockEmailConfigured } = require("./utils/mailer");
const { expirePaymentAttempts } = require("./services/payment-expiry");
const Order = require("./models/Order");
const { migrateRazorpayOrderIndex } = require("./services/order-index-migration");

const app = express();

app.disable("x-powered-by");
const clientOrigins = new Set(
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...(process.env.CLIENT_URL || "").split(","),
  ]
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.has(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      const error = new Error("Browser origin is not allowed by API CORS policy");
      error.code = "CORS_ORIGIN_DENIED";
      return callback(error);
    },
  })
);
app.use(express.json({ limit: "32kb" }));

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const orderRoutes = require("./routes/orders");
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Pizzaro backend is running",
  });
});

app.use((error, req, res, next) => {
  if (error.code === "CORS_ORIGIN_DENIED") {
    console.warn("Blocked browser origin:", req.headers.origin);
    return res.status(403).json({ message: error.message });
  }
  console.error("Unhandled request error:", error);
  if (res.headersSent) return next(error);
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  res.status(status).json({
    message: status < 500 ? "Invalid request" : "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is required");
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters");
}

mongoose
  .connect(process.env.MONGO_URI, {
    family: 4,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  })
  .then(async () => {
    console.log("MongoDB connected successfully");
    await migrateRazorpayOrderIndex(Order);
    await Promise.all([
      require("./models/User").init(),
      Order.init(),
      require("./models/PaymentAttempt").init(),
      require("./models/Ingredient").init(),
    ]);
    await ensureInventoryCatalog();
    if (isLowStockEmailConfigured()) {
      cron.schedule("*/15 * * * *", () => {
        void checkLowStock().catch((error) =>
          console.error("Scheduled low-stock check failed:", error.message)
        );
      });
    } else {
      console.warn(
        "Low-stock email alerts are disabled until SMTP_HOST, SMTP_PORT, SMTP_FROM or SMTP_USER, and ADMIN_ALERT_EMAIL are configured."
      );
    }
    cron.schedule("*/5 * * * *", () => {
      void expirePaymentAttempts().catch((error) =>
        console.error("Payment expiry check failed:", error)
      );
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
  });