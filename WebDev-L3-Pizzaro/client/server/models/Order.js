const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    pizzaId: {
      type: Number,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    size: {
      type: String,
      enum: ["small", "medium", "large"],
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    customization: {
      base: {
        type: String,
        default: "classic",
      },

      crust: {
        type: String,
        default: "classic",
      },

      sauce: {
        type: String,
        default: "tomato",
      },

      cheese: {
        type: String,
        default: "mozzarella",
      },

      vegetables: {
        type: [String],
        default: [],
      },

      customizationPrice: {
        type: Number,
        default: 0,
      },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    total: {
      type: Number,
      required: true,
    },

    tipAmount: {
      type: Number,
      default: 0,
    },

    customerName: {
      type: String,
      required: true,
    },

    mobile: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    pincode: {
      type: String,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "razorpay"],
      default: "cod",
    },

    paymentStatus: {
      type: String,
      enum: ["not_required", "pending", "paid", "refunded"],
      default: "not_required",
    },

    checkoutRequestId: {
      type: String,
      default: null,
    },

    checkoutFingerprint: {
      type: String,
      default: null,
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

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

    inventoryRestoredAt: {
      type: Date,
      default: null,
    },

    cancellationInProgress: {
      type: Boolean,
      default: false,
    },

    refundId: {
      type: String,
      default: null,
    },

    cookingRequest: {
      type: String,
      default: "",
    },

    instructions: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "Order Received",
        "In Kitchen",
        "Sent to Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Order Received",
    },

    cancellationDeadline: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index(
  { user: 1, checkoutRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { checkoutRequestId: { $type: "string" } },
  }
);
orderSchema.index(
  { razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: { $type: "string", $gt: "" },
    },
  }
);

module.exports = mongoose.model("Order", orderSchema);