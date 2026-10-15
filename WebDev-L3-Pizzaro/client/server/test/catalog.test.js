const test = require("node:test");
const assert = require("node:assert/strict");
const { OrderInputError, options, prepareOrder } = require("../data/catalog");

test("the pizza builder offers exactly five bases and five sauces", () => {
  assert.equal(Object.keys(options.base).length, 5);
  assert.equal(Object.keys(options.sauce).length, 5);
});

test("order prices and saved customization are calculated from the server catalog", () => {
  const order = prepareOrder({
    items: [
      {
        pizzaId: 1,
        name: "Forged name",
        size: "medium",
        price: 1,
        quantity: 2,
        customizationPrice: 0,
        customization: {
          base: "thin",
          sauce: "bbq",
          cheese: "extra",
          vegetables: ["onion"],
          customizationPrice: 0,
        },
      },
    ],
    total: 1,
    tipAmount: 30,
  });

  assert.equal(order.items[0].name, "Margherita");
  assert.equal(order.items[0].price, 259);
  assert.equal(order.items[0].customization.customizationPrice, 90);
  assert.deepEqual(order.items[0].customization.vegetables, ["onion"]);
  assert.equal(order.total, 548);
  assert.equal(order.stockRequirements.get("base:thin"), 2);
  assert.equal(order.stockRequirements.get("vegetable:onion"), 2);
});

test("invalid selections and quantities fail closed", () => {
  assert.throws(
    () => prepareOrder({ items: [{ pizzaId: 999, size: "medium", quantity: 1 }] }),
    OrderInputError
  );
  assert.throws(
    () => prepareOrder({
      items: [{
        pizzaId: 1,
        size: "medium",
        quantity: 1,
        customization: { vegetables: ["onion", "onion"] },
      }],
    }),
    OrderInputError
  );
});
