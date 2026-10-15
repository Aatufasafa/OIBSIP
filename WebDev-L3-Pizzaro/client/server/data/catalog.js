const pizzas = {
  1: { name: "Margherita", prices: { small: 119, medium: 169, large: 219 } },
  2: { name: "Pepperoni", prices: { small: 139, medium: 189, large: 239 } },
  3: { name: "Smoky BBQ Chicken", prices: { small: 149, medium: 199, large: 249 } },
  4: { name: "Truffle Mushroom", prices: { small: 129, medium: 169, large: 209 } },
  5: { name: "Spicy Chicken", prices: { small: 139, medium: 189, large: 239 } },
  6: { name: "Cheese Noir", prices: { small: 139, medium: 179, large: 219 } },
};

const options = {
  base: {
    classic: { name: "Classic", price: 0 },
    thin: { name: "Thin Crust", price: 20 },
    cheese: { name: "Cheese Burst", price: 50 },
    stuffed: { name: "Stuffed Crust", price: 60 },
    pan: { name: "Pan Crust", price: 30 },
  },
  sauce: {
    tomato: { name: "Classic Tomato", price: 0 },
    bbq: { name: "Smoky BBQ", price: 20 },
    pesto: { name: "Basil Pesto", price: 25 },
    spicy: { name: "Spicy Peri-Peri", price: 20 },
    garlic: { name: "Roasted Garlic", price: 20 },
  },
  cheese: {
    mozzarella: { name: "Mozzarella", price: 0 },
    extra: { name: "Extra Cheese", price: 35 },
  },
  vegetable: {
    onion: { name: "Onion", price: 15 },
    capsicum: { name: "Capsicum", price: 15 },
    jalapeno: { name: "Jalapeño", price: 20 },
    mushroom: { name: "Mushroom", price: 25 },
    olives: { name: "Olives", price: 20 },
  },
};

class OrderInputError extends Error {}

function getOption(group, key, fallback) {
  const id = key || fallback;
  const option = options[group][id];
  if (!option) throw new OrderInputError(`Invalid ${group} selection`);
  return { id, ...option };
}

function prepareOrder(body) {
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
    throw new OrderInputError("Choose between 1 and 20 pizza items");
  }

  const tipAmount = body.tipAmount === undefined ? 0 : body.tipAmount;
  if (!Number.isFinite(tipAmount) || tipAmount < 0 || tipAmount > 10000) {
    throw new OrderInputError("Tip amount must be between ₹0 and ₹10,000");
  }

  const stockRequirements = new Map();
  let subtotal = 0;
  const items = body.items.map((input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new OrderInputError("Invalid pizza item");
    }

    const pizzaId = input.pizzaId;
    const pizza = Number.isInteger(pizzaId) ? pizzas[pizzaId] : null;
    const size = input.size;
    const quantity = input.quantity;
    if (
      !pizza ||
      !Object.hasOwn(pizza.prices, size) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      throw new OrderInputError("Invalid pizza, size, or quantity");
    }

    const customization = input.customization || {};
    if (typeof customization !== "object" || Array.isArray(customization)) {
      throw new OrderInputError("Invalid pizza customization");
    }
    const base = getOption("base", customization.base || customization.crust, "classic");
    const sauce = getOption("sauce", customization.sauce, "tomato");
    const cheese = getOption("cheese", customization.cheese, "mozzarella");
    const vegetables = customization.vegetables === undefined
      ? []
      : customization.vegetables;

    if (
      !Array.isArray(vegetables) ||
      vegetables.length > 5 ||
      vegetables.some((id) => typeof id !== "string") ||
      new Set(vegetables).size !== vegetables.length
    ) {
      throw new OrderInputError("Choose up to five different vegetables");
    }

    const selectedVegetables = vegetables.map((id) => getOption("vegetable", id));
    const customizationPrice =
      base.price +
      sauce.price +
      cheese.price +
      selectedVegetables.reduce((sum, vegetable) => sum + vegetable.price, 0);
    const price = pizza.prices[size] + customizationPrice;
    subtotal += price * quantity;

    for (const [type, id] of [
      ["base", base.id],
      ["sauce", sauce.id],
      ["cheese", cheese.id],
      ...selectedVegetables.map(({ id }) => ["vegetable", id]),
    ]) {
      const key = `${type}:${id}`;
      stockRequirements.set(key, (stockRequirements.get(key) || 0) + quantity);
    }

    return {
      pizzaId,
      name: pizza.name,
      size,
      price,
      quantity,
      customization: {
        base: base.id,
        crust: base.id,
        sauce: sauce.id,
        cheese: cheese.id,
        vegetables: selectedVegetables.map(({ id }) => id),
        customizationPrice,
      },
    };
  });

  return {
    items,
    tipAmount: Math.round(tipAmount * 100) / 100,
    subtotal,
    total: Math.round((subtotal + tipAmount) * 100) / 100,
    stockRequirements,
  };
}

module.exports = { OrderInputError, options, pizzas, prepareOrder };
