import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

function loadSavedData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function createCartItemId(pizza, size, customization = {}) {
  const vegetables = customization.vegetables || [];

  return [
    pizza.id,
    size,
    customization.base || customization.crust || "classic",
    customization.sauce || "tomato",
    customization.cheese || "mozzarella",
    [...vegetables].sort().join("-") || "none",
  ].join("_");
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() =>
    loadSavedData("pizzaro-cart", [])
  );

  const [orders, setOrders] = useState(() =>
    loadSavedData("pizzaro-orders", [])
  );

  useEffect(() => {
    localStorage.setItem(
      "pizzaro-cart",
      JSON.stringify(cartItems)
    );
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem(
      "pizzaro-orders",
      JSON.stringify(orders)
    );
  }, [orders]);

  function addToCart(pizza, size, customization = {}) {
    const basePrice = pizza.prices[size];

    const customizationPrice =
      customization.customizationPrice || 0;

    const finalPrice =
      basePrice + customizationPrice;

    const cartItemId = createCartItemId(
      pizza,
      size,
      customization
    );

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.cartItemId === cartItemId
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.cartItemId === cartItemId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          cartItemId,
          id: pizza.id,
          name: pizza.name,
          image: pizza.image,
          size,
          price: finalPrice,
          quantity: 1,

          customization: {
            base:
              customization.base ||
              customization.crust ||
              "classic",
            crust: customization.crust || "classic",
            sauce: customization.sauce || "tomato",
            cheese:
              customization.cheese || "mozzarella",
            vegetables:
              customization.vegetables || [],
            customizationPrice,
          },
        },
      ];
    });
  }

  function removeFromCart(cartItemId) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) => item.cartItemId !== cartItemId
      )
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  function increaseQuantity(cartItemId) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseQuantity(cartItemId) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.cartItemId === cartItemId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function placeOrder(orderDetails) {
    const newOrder = {
      id: `PZ-${Date.now()}`,
      items: [...cartItems],
      total: cartTotal + (orderDetails.tipAmount || 0),
      status: "Order Received",
      createdAt: Date.now(),
      cancellationDeadline:
        Date.now() + 2 * 60 * 1000,
      ...orderDetails,
    };

    setOrders((currentOrders) => [
      newOrder,
      ...currentOrders,
    ]);

    setCartItems([]);

    return newOrder;
  }

  function cancelOrder(orderId) {
    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        if (
          order.status === "Cancelled" ||
          Date.now() > order.cancellationDeadline
        ) {
          return order;
        }

        return {
          ...order,
          status: "Cancelled",
          cancelledAt: Date.now(),
        };
      })
    );
  }

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cartItems.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        increaseQuantity,
        decreaseQuantity,
        cartCount,
        cartTotal,
        orders,
        placeOrder,
        cancelOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}