const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "base:classic",
        "base:thin",
        "base:cheese",
        "base:stuffed",
        "base:pan",
        "sauce:tomato",
        "sauce:bbq",
        "sauce:pesto",
        "sauce:spicy",
        "sauce:garlic",
        "cheese:mozzarella",
        "cheese:extra",
        "vegetable:onion",
        "vegetable:capsicum",
        "vegetable:jalapeno",
        "vegetable:mushroom",
        "vegetable:olives",
      ],
    },
    type: {
      type: String,
      enum: ["base", "sauce", "cheese", "vegetable"],
      required: true,
    },
    optionId: { type: String, required: true },
    name: { type: String, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 5 },
    lowStockAlertSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ingredientSchema.index({ type: 1, name: 1 });

module.exports = mongoose.model("Ingredient", ingredientSchema);
