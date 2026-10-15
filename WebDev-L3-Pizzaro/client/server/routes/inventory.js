const express = require("express");
const mongoose = require("mongoose");
const Ingredient = require("../models/Ingredient");
const protect = require("../middleware/auth");

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const ingredients = await Ingredient.find().sort({ type: 1, name: 1 });
    res.json({ ingredients });
  } catch (error) {
    console.error("Inventory fetch error:", error);
    res.status(500).json({ message: "Unable to load inventory" });
  }
});

router.patch("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory item id" });
    }
    const body = req.body || {};
    const allowed = new Set(["stock", "lowStockThreshold"]);
    if (
      Object.keys(body).length === 0 ||
      Object.keys(body).some((key) => !allowed.has(key))
    ) {
      return res.status(400).json({ message: "Provide stock and/or low-stock threshold only" });
    }
    for (const field of allowed) {
      if (
        Object.hasOwn(body, field) &&
        (!Number.isInteger(body[field]) || body[field] < 0 || body[field] > 1000000)
      ) {
        return res.status(400).json({
          message: `${field} must be an integer between 0 and 1,000,000`,
        });
      }
    }

    const current = await Ingredient.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Inventory item not found" });
    const nextStock = Object.hasOwn(body, "stock") ? body.stock : current.stock;
    const nextThreshold = Object.hasOwn(body, "lowStockThreshold")
      ? body.lowStockThreshold
      : current.lowStockThreshold;
    const update = { $set: {} };
    if (Object.hasOwn(body, "stock")) update.$set.stock = body.stock;
    if (Object.hasOwn(body, "lowStockThreshold")) {
      update.$set.lowStockThreshold = body.lowStockThreshold;
    }
    if (nextStock > nextThreshold) update.$set.lowStockAlertSent = false;

    const ingredient = await Ingredient.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    res.json({ message: "Inventory updated", ingredient });
  } catch (error) {
    console.error("Inventory update error:", error);
    res.status(500).json({ message: "Unable to update inventory" });
  }
});

module.exports = router;
