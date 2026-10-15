const Ingredient = require("../models/Ingredient");
const {
  isLowStockEmailConfigured,
  sendLowStockEmail,
} = require("../utils/mailer");

async function checkLowStock() {
  if (!isLowStockEmailConfigured()) {
    throw new Error(
      "Low-stock alerts require SMTP_HOST, SMTP_PORT, SMTP_FROM or SMTP_USER, and ADMIN_ALERT_EMAIL"
    );
  }

  await Ingredient.updateMany(
    {
      lowStockAlertSent: true,
      $expr: { $gt: ["$stock", "$lowStockThreshold"] },
    },
    { $set: { lowStockAlertSent: false } }
  );

  const lowItems = await Ingredient.find({
    lowStockAlertSent: false,
    $expr: { $lte: ["$stock", "$lowStockThreshold"] },
  }).select("_id stock lowStockThreshold");

  let sent = 0;
  for (const item of lowItems) {
    const claimed = await Ingredient.findOneAndUpdate(
      {
        _id: item._id,
        stock: item.stock,
        lowStockThreshold: item.lowStockThreshold,
        lowStockAlertSent: false,
      },
      { $set: { lowStockAlertSent: true } },
      { new: true }
    );
    if (!claimed) continue;

    try {
      const current = await Ingredient.findById(claimed._id).select(
        "name stock lowStockThreshold"
      );
      if (!current || current.stock > current.lowStockThreshold) {
        await Ingredient.updateOne(
          { _id: claimed._id },
          { $set: { lowStockAlertSent: false } }
        );
        continue;
      }
      await sendLowStockEmail(current);
      sent += 1;
    } catch (error) {
      await Ingredient.updateOne(
        { _id: claimed._id },
        { $set: { lowStockAlertSent: false } }
      );
      console.error(`Low-stock email failed for ${claimed._id}:`, error.message);
    }
  }
  return sent;
}

module.exports = { checkLowStock };
