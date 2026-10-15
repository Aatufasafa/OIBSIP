import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, LogOut, Search, ShoppingBag, SlidersHorizontal, Star } from "lucide-react";
import pizzas from "../data/pizzas";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

function Menu() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const {
    addToCart,
    decreaseQuantity,
    cartItems,
    cartCount,
  } = useCart();

  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category");
  const [category, setCategory] = useState(
    ["Veg", "Non-Veg", "Classic", "Spicy"].includes(initialCategory)
      ? initialCategory
      : "All"
  );
  const [search, setSearch] = useState("");
  const [openPizza, setOpenPizza] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState({});
  const categories = ["Veg", "Non-Veg", "Classic", "Spicy"];

  function handleSignOut() {
    logout();
    navigate("/");
  }

  const visiblePizzas = pizzas.filter((pizza) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      pizza.name.toLowerCase().includes(query) ||
      pizza.description.toLowerCase().includes(query) ||
      pizza.ingredients.some((ingredient) =>
        ingredient.toLowerCase().includes(query)
      );
    const matchesCategory =
      category === "All" ||
      pizza.category.toLowerCase() === category.toLowerCase() ||
      (category === "Classic" && [1, 2].includes(pizza.id)) ||
      (category === "Spicy" &&
        `${pizza.name} ${pizza.description} ${pizza.ingredients.join(" ")}`
          .toLowerCase()
          .match(/spicy|jalapeño|pepperoni/));

    return matchesSearch && matchesCategory;
  });

  function openSizePicker(pizza) {
  const size = selectedSizes[pizza.id] || "medium";

  setOpenPizza(pizza.id);

  setSelectedSizes((current) => ({
    ...current,
    [pizza.id]: size,
  }));

  const existingItem = cartItems.find(
    (item) =>
      item.id === pizza.id &&
      item.size === size &&
      !item.customization?.vegetables?.length &&
      (item.customization?.base || "classic") === "classic" &&
      (item.customization?.sauce || "tomato") === "tomato" &&
      (item.customization?.cheese || "mozzarella") === "mozzarella"
  );

  if (!existingItem) {
    addToCart(pizza, size);
  }
}
  function selectSize(pizzaId, size) {
    setSelectedSizes((current) => ({
      ...current,
      [pizzaId]: size,
    }));
  }

  function getQuantity(pizzaId, size) {
    const item = cartItems.find(
      (item) => item.id === pizzaId && item.size === size
    );

    return item ? item.quantity : 0;
  }

  function handleAdd(pizza) {
    const size = selectedSizes[pizza.id] || "medium";
    addToCart(pizza, size);
  }

  function handleRemove(pizza) {
  const size = selectedSizes[pizza.id] || "medium";

  const item = cartItems.find(
    (item) =>
      item.id === pizza.id &&
      item.size === size &&
      !item.customization?.vegetables?.length &&
      (item.customization?.base || "classic") === "classic" &&
      (item.customization?.sauce || "tomato") === "tomato" &&
      (item.customization?.cheese || "mozzarella") === "mozzarella"
  );

  if (item) {
    if (item.quantity === 1) {
      decreaseQuantity(item.cartItemId);
      setOpenPizza(null);
    } else {
      decreaseQuantity(item.cartItemId);
    }
  }
}

  return (
    <main className="recipe-app recipe-menu-page menu-page">
      <header className="recipe-topbar">
        <Link to="/" className="recipe-brand" aria-label="Pizzaro home">
          <span className="recipe-brand-mark">P</span>
          <span>pizzaro<span className="recipe-brand-dot">.</span></span>
        </Link>
        <nav className="recipe-desktop-nav" aria-label="Main navigation">
          <Link to="/">Discover</Link>
          <Link className="is-active" to="/menu">Menu</Link>
          <Link to="/orders">My orders</Link>
        </nav>
        <div className="recipe-top-actions">
          {isAuthenticated && (
            <button
              type="button"
              className="recipe-signout"
              onClick={handleSignOut}
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          )}
          <Link to="/cart" className="recipe-cart-link" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingBag size={18} />
            <span className="recipe-cart-count">{cartCount}</span>
          </Link>
        </div>
      </header>

      <div className="recipe-menu-content">
        <section className="recipe-menu-heading">
          <div className="recipe-menu-title-row">
            <div>
              <h1>Our menu</h1>
              <p>Freshly made pizzas, just for you.</p>
            </div>
            <Link to="/cart" className="recipe-menu-cart-pill">
              <ShoppingBag size={17} /><span>My bag</span><b>{cartCount}</b>
            </Link>
          </div>

          <label className="recipe-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your pizza..."
              aria-label="Search pizzas"
            />
            <SlidersHorizontal size={17} />
          </label>

          <div className="recipe-filter-row" aria-label="Filter pizzas by category">
            {categories.map((item) => (
              <button
                type="button"
                className={`recipe-filter-chip ${category === item ? "is-active" : ""}`}
                key={item}
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="recipe-menu-list">
          <div className="recipe-section-heading">
            <div>
              <h2>{category === "All" ? "Our pizzas" : `${category} pizzas`}</h2>
            </div>
            <span className="recipe-result-count">{visiblePizzas.length} pizzas</span>
          </div>

          {visiblePizzas.length ? (
            <div className="recipe-menu-grid pizza-grid">
              {visiblePizzas.map((pizza) => {
          const selectedSize =
            selectedSizes[pizza.id] || "medium";

          const quantity = getQuantity(
            pizza.id,
            selectedSize
          );

          return (
            <article className="recipe-menu-card pizza-card" key={pizza.id}>
              <Link
                to={`/pizza/${pizza.id}`}
                className="recipe-menu-image pizza-image"
              >
                <img
                  src={pizza.image}
                  alt={pizza.name}
                />

                <span className="recipe-feature-badge"><Star size={12} fill="currentColor" /> {pizza.rating}</span>
                <span className="customize-hint">Details <ArrowRight size={12} /></span>
              </Link>

              <div className="pizza-info">
                <div>
                  <span className="pizza-category">
                    {pizza.category}
                  </span>

                  <div className="pizza-name-row">
                    <h2>{pizza.name}</h2>

                    <span className="recipe-menu-time"><Clock3 size={13} /> 20–25 min</span>
                  </div>
                </div>
              </div>

              <p className="pizza-description">
                {pizza.description}
              </p>

              {openPizza === pizza.id ? (
                <div className="size-picker">
                  <div className="size-options">
                    {["small", "medium", "large"].map(
                      (size) => {
                        const isSelected =
                          selectedSize === size;

                        return (
                          <button
                            key={size}
                            type="button"
                            className="size-option"
                            onClick={() =>
                              selectSize(
                                pizza.id,
                                size
                              )
                            }
                          >
                            <span className="size-name">
                              {size
                                .charAt(0)
                                .toUpperCase() +
                                size.slice(1)}
                            </span>

                            <span className="size-price">
                              ₹{pizza.prices[size]}
                            </span>

                            <span
                              className={`size-circle ${
                                isSelected
                                  ? "selected"
                                  : ""
                              }`}
                            />
                          </button>
                        );
                      }
                    )}
                  </div>

                  {quantity > 0 ? (
                    <div className="quantity-control">
                      <button
                        type="button"
                        className="quantity-button"
                        onClick={() =>
                          handleRemove(pizza)
                        }
                      >
                        −
                      </button>

                      <span className="quantity-number">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        className="quantity-button"
                        onClick={() =>
                          handleAdd(pizza)
                        }
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="add-button"
                      onClick={() =>
                        handleAdd(pizza)
                      }
                    >
                      Add to bag · ₹{pizza.prices[selectedSize]}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="add-button"
                  onClick={() =>
                    openSizePicker(pizza)
                  }
                >
                  Add to bag · ₹{pizza.prices[selectedSize]}
                </button>
              )}
            </article>
          );
              })}
            </div>
          ) : (
            <div className="recipe-empty-state">
              <span>🍕</span>
              <h3>No pizzas found</h3>
              <p>Try a different search or category.</p>
              <button type="button" onClick={() => { setSearch(""); setCategory("All"); }}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      </div>

      <nav className="recipe-mobile-nav" aria-label="Quick navigation">
        <Link to="/"><span className="recipe-mobile-nav-icon">⌂</span><span>Home</span></Link>
        <Link className="is-active" to="/menu"><Search size={19} /><span>Explore</span></Link>
        <Link to="/orders"><Clock3 size={19} /><span>Orders</span></Link>
        <Link to="/cart"><ShoppingBag size={19} /><span>Bag {cartCount > 0 ? `(${cartCount})` : ""}</span></Link>
      </nav>
    </main>
  );
}

export default Menu;