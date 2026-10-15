const pizzas = [
  {
    id: 1,
    name: "Margherita",
    category: "Veg",
    rating: 4.7,
    prices: {
      small: 119,
      medium: 169,
      large: 219,
    },
    description:
      "San Marzano tomato, fresh mozzarella, basil and extra virgin olive oil.",
    ingredients: ["Tomato", "Mozzarella", "Basil"],
    image: "/pizzas/margherita.png",
  },

  {
    id: 2,
    name: "Pepperoni",
    category: "Non-Veg",
    rating: 4.6,
    prices: {
      small: 139,
      medium: 189,
      large: 239,
    },
    description:
      "Classic tomato sauce, mozzarella and generous slices of spicy pepperoni.",
    ingredients: ["Tomato", "Mozzarella", "Pepperoni"],
    image: "/pizzas/pepperoni.png",
  },

  {
    id: 3,
    name: "Smoky BBQ Chicken",
    category: "Non-Veg",
    rating: 4.8,
    prices: {
      small: 149,
      medium: 199,
      large: 249,
    },
    description:
      "Smoky BBQ chicken, mozzarella, caramelized onions and a BBQ glaze.",
    ingredients: ["BBQ Chicken", "Mozzarella", "Onion", "BBQ Sauce"],
    image: "/pizzas/bbq-chicken.png",
  },

  {
    id: 4,
    name: "Truffle Mushroom",
    category: "Veg",
    rating: 4.5,
    prices: {
      small: 129,
      medium: 169,
      large: 209,
    },
    description:
      "Roasted mushrooms, mozzarella, parmesan and a delicate truffle finish.",
    ingredients: ["Mushroom", "Mozzarella", "Parmesan", "Truffle"],
    image: "/pizzas/truffle-mushroom.png",
  },

  {
    id: 5,
    name: "Spicy Chicken",
    category: "Non-Veg",
    rating: 4.7,
    prices: {
      small: 139,
      medium: 189,
      large: 239,
    },
    description:
      "Spiced chicken, mozzarella, jalapeños and roasted peppers.",
    ingredients: [
      "Spiced Chicken",
      "Mozzarella",
      "Jalapeño",
      "Peppers",
    ],
    image: "/pizzas/spicy-chicken.png",
  },

  {
    id: 6,
    name: "Cheese Noir",
    category: "Veg",
    rating: 4.6,
    prices: {
      small: 139,
      medium: 179,
      large: 219,
    },
    description:
      "Mozzarella, parmesan, cheddar and gorgonzola on a crisp artisan crust.",
    ingredients: [
      "Mozzarella",
      "Parmesan",
      "Cheddar",
      "Gorgonzola",
    ],
    image: "/pizzas/cheese noir.png",
  },
];

export default pizzas;