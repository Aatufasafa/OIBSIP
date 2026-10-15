require("dotenv").config();
const mongoose = require("mongoose");
const { checkLowStock } = require("../services/low-stock-alerts");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  const sent = await checkLowStock();
  console.log(`Low-stock check complete; sent ${sent} alert(s).`);
}

main()
  .catch((error) => {
    console.error("Low-stock check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
