import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Star } from "lucide-react";
import pizzas from "../data/pizzas";
import { useCart } from "../context/CartContext";

const baseOptions = [
  { id: "classic", name: "Classic", price: 0 },
  { id: "thin", name: "Thin Crust", price: 20 },
  { id: "cheese", name: "Cheese Burst", price: 50 },
  { id: "stuffed", name: "Stuffed Crust", price: 60 },
  { id: "pan", name: "Pan Crust", price: 30 },
];

const sauceOptions = [
  { id: "tomato", name: "Classic Tomato", price: 0 },
  { id: "bbq", name: "Smoky BBQ", price: 20 },
  { id: "pesto", name: "Basil Pesto", price: 25 },
  { id: "spicy", name: "Spicy Peri-Peri", price: 20 },
  { id: "garlic", name: "Roasted Garlic", price: 20 },
];

const cheeseOptions = [
  { id: "mozzarella", name: "Mozzarella", price: 0 },
  { id: "extra", name: "Extra Cheese", price: 35 },
];

const vegetableOptions = [
  { id: "onion", name: "Onion", price: 15 },
  { id: "capsicum", name: "Capsicum", price: 15 },
  { id: "jalapeno", name: "Jalapeño", price: 20 },
  { id: "mushroom", name: "Mushroom", price: 25 },
  { id: "olives", name: "Olives", price: 20 },
];

function PizzaDetails() {
  const { id } = useParams();
  const { addToCart, cartCount } = useCart();

  const pizza = pizzas.find(
    (item) => item.id === Number(id)
  );

  const [size, setSize] = useState("medium");
  const [base, setBase] = useState("classic");
  const [sauce, setSauce] = useState("tomato");
  const [cheese, setCheese] = useState("mozzarella");
  const [vegetables, setVegetables] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!pizza) {
    return (
      <main className="recipe-app pizza-details-page">
        <section className="details-not-found">
          <h1>Pizza not found.</h1>

          <Link to="/menu" className="order-button">
            Back to menu
          </Link>
        </section>
      </main>
    );
  }

  const selectedBase = baseOptions.find(
    (option) => option.id === base
  );

  const selectedSauce = sauceOptions.find(
    (option) => option.id === sauce
  );

  const selectedCheese = cheeseOptions.find(
    (option) => option.id === cheese
  );

  const vegetableTotal = vegetables.reduce(
    (total, vegetableId) => {
      const vegetable = vegetableOptions.find(
        (option) => option.id === vegetableId
      );

      return total + (vegetable?.price || 0);
    },
    0
  );

  const customizationPrice =
    selectedBase.price +
    selectedSauce.price +
    selectedCheese.price +
    vegetableTotal;

  const unitPrice =
    pizza.prices[size] + customizationPrice;

  const totalPrice = unitPrice * quantity;

  function toggleVegetable(id) {
    setVegetables((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function handleAddToCart() {
    for (let i = 0; i < quantity; i++) {
      addToCart(pizza, size, {
        base,
        crust: base,
        sauce,
        cheese,
        vegetables,
        customizationPrice,
      });
    }

    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 1800);
  }

  return (
    <main className="recipe-app pizza-details-page">
      <header className="details-header">
        <Link to="/menu" className="back-link">
          ← Menu
        </Link>

        <Link to="/cart" className="details-cart">
          <ShoppingBag size={16} /> Bag <span>{cartCount}</span>
        </Link>
      </header>

      <section className="pizza-details-layout">
        <div className="details-image-panel">
          <img
            src={pizza.image}
            alt={pizza.name}
          />
        </div>

        <div className="details-content">
          <div className="details-title">
            <div>
              <span className="pizza-category">
                {pizza.category}
              </span>

              <h1>{pizza.name}</h1>
            </div>

            <div className="details-rating">
              <Star size={15} fill="currentColor" />
              <span>{pizza.rating}</span>
            </div>
          </div>

          <p className="details-description">
            {pizza.description}
          </p>

          <div className="details-section">
            <div className="details-section-heading">
              <h2>Choose your size</h2>
            </div>

            <div className="details-options">
              {["small", "medium", "large"].map(
                (option) => (
                  <button
                    type="button"
                    key={option}
                    className={
                      size === option ? "selected" : ""
                    }
                    onClick={() => setSize(option)}
                  >
                    <span>
                      {option.charAt(0).toUpperCase() +
                        option.slice(1)}
                    </span>

                    <strong>
                      ₹{pizza.prices[option]}
                    </strong>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="details-section">
            <div className="details-section-heading">
              <h2>Choose your base</h2>
            </div>

            <div className="details-options">
              {baseOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={
                    base === option.id ? "selected" : ""
                  }
                  onClick={() => setBase(option.id)}
                >
                  <span>{option.name}</span>

                  <strong>
                    {option.price === 0
                      ? "Free"
                      : `+₹${option.price}`}
                  </strong>
                </button>
              ))}
            </div>
          </div>

          <div className="details-section">
            <div className="details-section-heading">
              <h2>Choose your sauce</h2>
            </div>

            <div className="details-options">
              {sauceOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={
                    sauce === option.id ? "selected" : ""
                  }
                  onClick={() => setSauce(option.id)}
                >
                  <span>{option.name}</span>

                  <strong>
                    {option.price === 0
                      ? "Included"
                      : `+₹${option.price}`}
                  </strong>
                </button>
              ))}
            </div>
          </div>

          <div className="details-section">
            <div className="details-section-heading">
              <h2>Cheese</h2>
            </div>

            <div className="details-options">
              {cheeseOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={
                    cheese === option.id ? "selected" : ""
                  }
                  onClick={() => setCheese(option.id)}
                >
                  <span>{option.name}</span>

                  <strong>
                    {option.price === 0
                      ? "Included"
                      : `+₹${option.price}`}
                  </strong>
                </button>
              ))}
            </div>
          </div>

          <div className="details-section">
            <div className="details-section-heading">
              <h2>Add vegetables</h2>
              <span>Choose any</span>
            </div>

            <div className="details-options vegetable-options">
              {vegetableOptions.map((option) => {
                const selected =
                  vegetables.includes(option.id);

                return (
                  <button
                    type="button"
                    key={option.id}
                    className={
                      selected ? "selected" : ""
                    }
                    onClick={() =>
                      toggleVegetable(option.id)
                    }
                  >
                    <span>{option.name}</span>

                    <strong>
                      +₹{option.price}
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="details-bottom">
            <div className="details-bottom-content">
              {added && (
                <div className="cart-success-message">
                  ✓ Added to cart successfully
                </div>
              )}

              <div className="details-actions">
                <div className="details-quantity">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                  >
                    <Minus size={17} />
                  </button>

                  <span>{quantity}</span>

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        (current) => current + 1
                      )
                    }
                  >
                    <Plus size={17} />
                  </button>
                </div>

                <button
                  type="button"
                  className={`details-add-button ${
                    added ? "added" : ""
                  }`}
                  onClick={handleAddToCart}
                >
                  {added
                    ? "Added ✓"
                    : `Add to cart · ₹${totalPrice}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default PizzaDetails;