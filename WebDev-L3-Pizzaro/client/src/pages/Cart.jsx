import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  Minus,
  Plus,
  Trash2,
  DoorOpen,
  PhoneOff,
  BellOff,
  Hand,
  ShoppingBag,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import RecipePageHeader from "../components/RecipePageHeader";

const vegetableNames = {
  onion: "Onion",
  capsicum: "Capsicum",
  jalapeno: "Jalapeño",
  mushroom: "Mushroom",
  olives: "Olives",
};

const baseNames = {
  classic: "Classic",
  thin: "Thin Crust",
  cheese: "Cheese Burst",
  stuffed: "Stuffed Crust",
  pan: "Pan Crust",
};

const sauceNames = {
  tomato: "Classic Tomato",
  bbq: "Smoky BBQ",
  pesto: "Basil Pesto",
  spicy: "Spicy Peri-Peri",
  garlic: "Roasted Garlic",
};

const cheeseNames = {
  mozzarella: "Mozzarella",
  extra: "Extra Cheese",
};

function Cart() {
  const navigate = useNavigate();
  const {
    cartItems,
    cartCount,
    cartTotal,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
  } = useCart();

  const [cookingRequest, setCookingRequest] = useState("");
  const [instructions, setInstructions] = useState([]);
  const [selectedTip, setSelectedTip] = useState(null);
  const [otherTip, setOtherTip] = useState("");

  const instructionOptions = [
    {
      id: "door",
      label: "Leave at the door",
      icon: DoorOpen,
    },
    {
      id: "call",
      label: "Avoid calling",
      icon: PhoneOff,
    },
    {
      id: "bell",
      label: "Don't ring the bell",
      icon: BellOff,
    },
    {
      id: "contactless",
      label: "Contactless delivery",
      icon: Hand,
    },
  ];

  function toggleInstruction(id) {
    setInstructions((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function getTipAmount() {
    if (selectedTip === "other") {
      return Number(otherTip) || 0;
    }

    return selectedTip || 0;
  }

  function getCustomizationText(item) {
    const customization = item.customization;

    if (!customization) {
      return [];
    }

    const details = [];

    details.push(
  baseNames[customization.base] ||
    baseNames[customization.crust] ||
    "Classic"
);

details.push(
  sauceNames[customization.sauce] ||
    "Classic Tomato"
);

details.push(
  cheeseNames[customization.cheese] ||
    "Mozzarella"
);

    if (customization.vegetables?.length) {
      const vegetables = customization.vegetables
        .map((id) => vegetableNames[id] || id)
        .join(", ");

      details.push(`Veg: ${vegetables}`);
    }

    return details;
  }

  const tipAmount = getTipAmount();
  const finalTotal = cartTotal + tipAmount;

  if (cartItems.length === 0) {
    return (
      <main className="recipe-app recipe-cart-page">
        <RecipePageHeader activePage="cart" />
        <div className="recipe-shell">
          <header className="recipe-page-heading">
            <p className="recipe-overline">YOUR CART</p>
            <h1>Your order.</h1>
          </header>
          <section className="recipe-cart-empty">
            <span className="recipe-cart-empty-icon"><ShoppingBag size={25} /></span>
            <p className="recipe-overline">NOTHING HERE YET</p>
            <h2>Your cart is empty.</h2>
            <p>Choose something from the menu and it&apos;ll show up here.</p>
            <Link to="/menu" className="recipe-primary-button">Browse menu</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="recipe-app recipe-cart-page">
      <RecipePageHeader activePage="cart" />
      <div className="recipe-shell">
      <header className="recipe-page-heading recipe-cart-heading">
        <div><p className="recipe-overline">YOUR CART</p><h1>Your order.</h1></div>
        <span className="recipe-cart-item-count">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
      </header>
      <section className="cart-layout recipe-cart-layout">
        <div className="cart-main">
          <section className="cart-section">
            <div className="cart-section-heading">
              <h2>Order details</h2>
            </div>

            <div className="cart-items">
              {cartItems.map((item) => {
                const customizationDetails =
                  getCustomizationText(item);

                return (
                  <article
                    className="cart-item"
                    key={item.cartItemId}
                  >
                    <div className="cart-item-details">
                      <div>
                        <span className="pizza-category">
                          {item.size}
                        </span>

                        <h3>{item.name}</h3>

                        {customizationDetails.length > 0 && (
                          <div className="cart-customization">
                            {customizationDetails.map(
                              (detail) => (
                                <span key={detail}>
                                  {detail}
                                </span>
                              )
                            )}
                          </div>
                        )}

                        <p>₹{item.price} each</p>
                      </div>

                      <div className="cart-quantity">
                        <button
                          type="button"
                          onClick={() =>
                            decreaseQuantity(
                              item.cartItemId
                            )
                          }
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus size={15} />
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          type="button"
                          onClick={() =>
                            increaseQuantity(
                              item.cartItemId
                            )
                          }
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="cart-item-right">
                      <strong>
                        ₹{item.price * item.quantity}
                      </strong>

                      <button
                        type="button"
                        className="remove-item"
                        onClick={() =>
                          removeFromCart(item.cartItemId)
                        }
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="cart-section">
            <div className="cart-section-heading">
              <h2>Cooking requests</h2>
              <span>Optional</span>
            </div>

            <textarea
              className="cooking-request"
              value={cookingRequest}
              onChange={(event) =>
                setCookingRequest(event.target.value)
              }
              placeholder="Anything you'd like the kitchen to know?"
              rows="4"
            />
          </section>

          <section className="cart-section">
            <div className="cart-section-heading">
              <h2>Delivery instructions</h2>
              <span>Optional</span>
            </div>

            <div className="instruction-grid">
              {instructionOptions.map((option) => {
                const Icon = option.icon;
                const selected =
                  instructions.includes(option.id);

                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`instruction-option ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() =>
                      toggleInstruction(option.id)
                    }
                  >
                    <Icon size={18} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="cart-section">
            <div className="cart-section-heading">
              <h2>Tip your rider</h2>
              <span>Optional</span>
            </div>

            <div className="tip-options">
              {[20, 30, 50].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  className={
                    selectedTip === amount
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setSelectedTip(
                      selectedTip === amount
                        ? null
                        : amount
                    )
                  }
                >
                  ₹{amount}
                </button>
              ))}

              <button
                type="button"
                className={
                  selectedTip === "other"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setSelectedTip("other")
                }
              >
                Other
              </button>
            </div>

            {selectedTip === "other" && (
              <input
                type="number"
                min="1"
                className="other-tip-input"
                placeholder="Enter tip amount"
                value={otherTip}
                onChange={(event) =>
                  setOtherTip(event.target.value)
                }
              />
            )}
          </section>
        </div>

        <aside className="cart-summary">
          <p className="section-label">SUMMARY</p>

          <div className="summary-row">
            <span>Items</span>
            <span>{cartCount}</span>
          </div>

          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{cartTotal}</span>
          </div>

          {tipAmount > 0 && (
            <div className="summary-row">
              <span>Rider tip</span>
              <span>₹{tipAmount}</span>
            </div>
          )}

          <div className="summary-total">
            <span>Total</span>
            <strong>₹{finalTotal}</strong>
          </div>

         <button
  type="button"
  className="checkout-button"
  onClick={() =>
    navigate("/checkout", {
      state: {
        cookingRequest,
        instructions,
        tipAmount,
      },
    })
  }
>
  Proceed to checkout →
</button>
        </aside>
      </section>
      </div>
    </main>
  );
}

export default Cart;