const RAZORPAY_INDEX_NAME = "razorpayOrderId_1";

function hasExpectedRazorpayIndex(index) {
  const filter = index.partialFilterExpression?.razorpayOrderId;
  return (
    index.name === RAZORPAY_INDEX_NAME &&
    index.unique === true &&
    index.sparse !== true &&
    Object.keys(index.key || {}).length === 1 &&
    index.key.razorpayOrderId === 1 &&
    Object.keys(index.partialFilterExpression || {}).length === 1 &&
    filter?.$type === "string" &&
    filter?.$gt === "" &&
    Object.keys(filter).length === 2
  );
}

async function migrateRazorpayOrderIndex(OrderModel) {
  const collections = await OrderModel.db.db
    .listCollections({ name: OrderModel.collection.name }, { nameOnly: true })
    .toArray();
  if (collections.length === 0) await OrderModel.createCollection();

  const duplicates = await OrderModel.collection
    .aggregate([
      {
        $match: {
          razorpayOrderId: { $type: "string", $gt: "" },
        },
      },
      {
        $group: {
          _id: "$razorpayOrderId",
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .toArray();

  if (duplicates.length > 0) {
    throw new Error(
      `Cannot create unique Razorpay order index: duplicate non-empty razorpayOrderId "${duplicates[0]._id}" exists in orders`
    );
  }

  const indexes = await OrderModel.collection.listIndexes().toArray();
  for (const index of indexes) {
    if (
      Object.keys(index.key || {}).length === 1 &&
      index.key?.razorpayOrderId === 1 &&
      !hasExpectedRazorpayIndex(index)
    ) {
      await OrderModel.collection.dropIndex(index.name);
    }
  }

  await OrderModel.createIndexes();
}

module.exports = {
  hasExpectedRazorpayIndex,
  migrateRazorpayOrderIndex,
};
