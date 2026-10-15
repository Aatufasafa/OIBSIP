const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hasExpectedRazorpayIndex,
  migrateRazorpayOrderIndex,
} = require("../services/order-index-migration");

function createOrderModel({ indexes = [], duplicates = [] } = {}) {
  const calls = [];
  return {
    calls,
    db: {
      db: {
        listCollections() {
          return { toArray: async () => [{ name: "orders" }] };
        },
      },
    },
    async createCollection() {
      calls.push("createCollection");
    },
    async createIndexes() {
      calls.push("createIndexes");
    },
    collection: {
      name: "orders",
      aggregate(pipeline) {
        calls.push(["aggregate", pipeline]);
        return { toArray: async () => duplicates };
      },
      listIndexes() {
        return { toArray: async () => indexes };
      },
      async dropIndex(name) {
        calls.push(["dropIndex", name]);
      },
    },
  };
}

const expectedIndex = {
  name: "razorpayOrderId_1",
  key: { razorpayOrderId: 1 },
  unique: true,
  partialFilterExpression: {
    razorpayOrderId: { $type: "string", $gt: "" },
  },
};

test("Razorpay order index excludes missing and empty values while remaining unique", () => {
  assert.equal(hasExpectedRazorpayIndex(expectedIndex), true);
  assert.equal(
    hasExpectedRazorpayIndex({
      ...expectedIndex,
      sparse: true,
      partialFilterExpression: undefined,
    }),
    false
  );
});

test("migration drops legacy sparse index before creating the replacement", async () => {
  const model = createOrderModel({
    indexes: [
      {
        name: "_id_",
        key: { _id: 1 },
      },
      {
        name: "user_1_razorpayOrderId_1",
        key: { user: 1, razorpayOrderId: 1 },
        unique: true,
      },
      {
        name: "razorpayOrderId_1",
        key: { razorpayOrderId: 1 },
        unique: true,
        sparse: true,
      },
    ],
  });

  await migrateRazorpayOrderIndex(model);

  assert.deepEqual(
    model.calls.filter((call) => Array.isArray(call) && call[0] === "dropIndex"),
    [["dropIndex", "razorpayOrderId_1"]]
  );
  assert.ok(
    model.calls.findIndex(
      (call) => Array.isArray(call) && call[0] === "dropIndex"
    ) < model.calls.indexOf("createIndexes")
  );
  const duplicateCheck = model.calls.find(
    (call) => Array.isArray(call) && call[0] === "aggregate"
  )[1];
  assert.deepEqual(duplicateCheck[0].$match.razorpayOrderId, {
    $type: "string",
    $gt: "",
  });
});

test("migration preserves indexes and refuses replacement when duplicate IDs exist", async () => {
  const duplicate = { _id: "order_duplicate", count: 2 };
  const model = createOrderModel({
    indexes: [
      {
        name: "razorpayOrderId_1",
        key: { razorpayOrderId: 1 },
        unique: true,
        sparse: true,
      },
    ],
    duplicates: [duplicate],
  });

  await assert.rejects(
    migrateRazorpayOrderIndex(model),
    /duplicate non-empty razorpayOrderId/
  );
  assert.equal(
    model.calls.some((call) => Array.isArray(call) && call[0] === "dropIndex"),
    false
  );
  assert.equal(model.calls.includes("createIndexes"), false);
});

test("migration leaves an already-correct index in place", async () => {
  const model = createOrderModel({ indexes: [expectedIndex] });

  await migrateRazorpayOrderIndex(model);

  assert.equal(
    model.calls.some((call) => Array.isArray(call) && call[0] === "dropIndex"),
    false
  );
  assert.equal(model.calls.includes("createIndexes"), true);
});
