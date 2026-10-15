const mongoose = require("mongoose");

let transactionsUnavailableLogged = false;

function transactionUnavailable(error) {
  return (
    error.code === 20 ||
    error.code === 303 ||
    error.codeName === "IllegalOperation" ||
    /Transaction numbers are only allowed|replica set|mongos/i.test(error.message)
  );
}

async function runTransactionIfAvailable(operation) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return { supported: true, result };
  } catch (error) {
    if (!transactionUnavailable(error)) throw error;
    if (!transactionsUnavailableLogged) {
      console.warn(
        "MongoDB transactions are unavailable; using conditional atomic stock updates with compensation."
      );
      transactionsUnavailableLogged = true;
    }
    return { supported: false, result: undefined };
  } finally {
    await session.endSession();
  }
}

module.exports = { runTransactionIfAvailable };
