const Ingredient = require("../models/Ingredient");
const { options } = require("../data/catalog");

class StockUnavailableError extends Error {}

async function ensureInventoryCatalog() {
  for (const [type, group] of Object.entries(options)) {
    for (const [optionId, option] of Object.entries(group)) {
      const key = `${type}:${optionId}`;
      await Ingredient.updateOne(
        { key },
        {
          $setOnInsert: {
            key,
            type,
            optionId,
            name: option.name,
            stock: 0,
            lowStockThreshold: 5,
          },
        },
        { upsert: true }
      );
    }
  }
}

async function resolveInventoryRequirements(requirements, session) {
  const resolved = [];
  for (const [key, quantity] of requirements.entries()) {
    let query = Ingredient.findOne({ key }).select("_id key stock");
    if (session) query = query.session(session);
    const ingredient = await query;
    if (!ingredient) {
      throw new Error(`Inventory option ${key} has not been initialized`);
    }
    resolved.push({
      ingredient: ingredient._id,
      key,
      quantity,
    });
  }
  return resolved;
}

async function compensate(changes, direction, session) {
  const failures = [];
  for (const deduction of [...changes].reverse()) {
    try {
      const condition = direction < 0
        ? { _id: deduction.ingredient, stock: { $gte: deduction.quantity } }
        : { _id: deduction.ingredient };
      const options = session ? { session } : {};
      const result = await Ingredient.updateOne(
        condition,
        { $inc: { stock: direction * deduction.quantity } },
        options
      );
      if (result.modifiedCount !== 1) {
        throw new Error(`Could not compensate inventory for ${deduction.key}`);
      }
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) {
    console.error("Inventory compensation failed:", failures);
    throw new Error("Inventory could not be fully restored; administrator review is required");
  }
}

async function adjustInventory(deductions, direction, session) {
  const changed = [];
  try {
    for (const deduction of deductions) {
      const condition = direction < 0
        ? { _id: deduction.ingredient, stock: { $gte: deduction.quantity } }
        : { _id: deduction.ingredient };
      const update = await Ingredient.updateOne(
        condition,
        { $inc: { stock: direction * deduction.quantity } },
        session ? { session } : {}
      );
      if (update.modifiedCount !== 1) {
        if (direction < 0) {
          throw new StockUnavailableError(
            `Insufficient stock for ${deduction.key.replace(":", " ")}`
          );
        }
        throw new Error(`Inventory option ${deduction.key} no longer exists`);
      }
      changed.push(deduction);
    }
  } catch (error) {
    if (changed.length) {
      await compensate(changed, direction * -1, session);
    }
    throw error;
  }
}

async function reserveInventory(requirements, session) {
  const deductions = await resolveInventoryRequirements(requirements, session);
  await adjustInventory(deductions, -1, session);
  return deductions;
}

async function restoreInventory(deductions, session) {
  await adjustInventory(deductions, 1, session);
}

module.exports = {
  StockUnavailableError,
  adjustInventory,
  ensureInventoryCatalog,
  reserveInventory,
  restoreInventory,
};
