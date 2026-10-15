import {
  ArrowRight,
  Bell,
  ChefHat,
  ChevronRight,
  Clock3,
  Flame,
  Home as HomeIcon,
  LogOut,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import pizzas from "../data/pizzas";

function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const featured = pizzas[2];
  const popular = [pizzas[3], pizzas[4]];

  function handleSignOut() {
    logout();
    navigate("/");
  }

  return (
    <main className="recipe-app recipe-home">
      <header className="recipe-topbar">
        <Link to="/" className="recipe-brand" aria-label="Pizzaro home">
          <span className="recipe-brand-mark"><ChefHat size={19} /></span>
          <span>pizzaro<span className="recipe-brand-dot">.</span></span>
        </Link>
        <nav className="recipe-desktop-nav" aria-label="Main navigation">
          <Link className="is-active" to="/">Discover</Link>
          <Link to="/menu">Menu</Link>
          <Link to="/orders">My orders</Link>
        </nav>
        <div className="recipe-top-actions">
          {isAuthenticated ? (
            <>
              <span className="recipe-greeting">Hi, {user?.name?.split(" ")[0]}</span>
              <button
                type="button"
                className="recipe-signout"
                onClick={handleSignOut}
              >
                <LogOut size={15} />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <Link className="recipe-login" to="/login">Sign in</Link>
          )}
          <Link to="/cart" className="recipe-cart-link" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingBag size={18} />
            <span className="recipe-cart-count">{cartCount}</span>
          </Link>
        </div>
      </header>

      <div className="recipe-shell">
        <section className="recipe-welcome">
          <div>
            <p className="recipe-overline">
              {isAuthenticated ? `GOOD TO SEE YOU, ${user?.name?.split(" ")[0]?.toUpperCase()}` : "FRESH FROM OUR OVEN"}
            </p>
            <h1>What are you<br />craving today?</h1>
            <p className="recipe-welcome-copy">Big flavours, fresh ingredients, and a little something for every kind of hunger.</p>
            <Link to="/menu" className="recipe-primary-button">
              Find your pizza <ArrowRight size={17} />
            </Link>
          </div>
          <div className="recipe-welcome-art" aria-hidden="true">
            <span className="recipe-art-orbit" />
            <img src="/pizzas/home-pizza.png" alt="" />
            <span className="recipe-art-spark recipe-art-spark-one">✳</span>
            <span className="recipe-art-spark recipe-art-spark-two">✦</span>
            <span className="recipe-art-tag"><Flame size={14} /> OVEN HOT</span>
          </div>
        </section>

        <section className="recipe-trending-section">
          <div className="recipe-section-heading">
            <div>
              <p className="recipe-overline"><Flame size={13} /> HOT RIGHT NOW</p>
              <h2>Popular pizzas</h2>
            </div>
            <Link to="/menu" className="recipe-text-link">See all <ChevronRight size={16} /></Link>
          </div>

          <Link to={`/pizza/${featured.id}`} className="recipe-feature-card">
            <div className="recipe-feature-image">
              <img src={featured.image} alt={featured.name} />
              <span className="recipe-feature-badge"><Flame size={13} /> MOST LOVED</span>
            </div>
            <div className="recipe-feature-info">
              <div className="recipe-feature-title-row">
                <div>
                  <p className="recipe-card-kicker">THE PIZZARO FAVOURITE</p>
                  <h3>{featured.name}</h3>
                </div>
                <span className="recipe-rating">★ {featured.rating}</span>
              </div>
              <p>{featured.description}</p>
              <div className="recipe-feature-meta">
                <span><Clock3 size={14} /> 20–25 min</span>
                <span>From ₹{featured.prices.small}</span>
                <span className="recipe-round-arrow"><ArrowRight size={16} /></span>
              </div>
            </div>
          </Link>
        </section>

        <section className="recipe-popular-section">
          <div className="recipe-section-heading">
            <div>
              <p className="recipe-overline">PICKED FOR YOU</p>
              <h2>More to try</h2>
            </div>
            <Link to="/menu" className="recipe-text-link">Full menu <ChevronRight size={16} /></Link>
          </div>
          <div className="recipe-mini-grid">
            {popular.map((pizza) => (
              <Link to={`/pizza/${pizza.id}`} className="recipe-mini-card" key={pizza.id}>
                <div className="recipe-mini-image">
                  <img src={pizza.image} alt={pizza.name} loading="lazy" />
                  <span className="recipe-rating">★ {pizza.rating}</span>
                </div>
                <div className="recipe-mini-info">
                  <div>
                    <h3>{pizza.name}</h3>
                    <p>From ₹{pizza.prices.small}</p>
                  </div>
                  <span className="recipe-mini-arrow"><ArrowRight size={15} /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="recipe-footer">
          <span>GOOD FOOD. NO FUSS. ALWAYS FRESH.</span>
          <Link to="/menu">Explore the menu <ArrowRight size={14} /></Link>
        </footer>
      </div>

      <nav className="recipe-mobile-nav" aria-label="Quick navigation">
        <Link className="is-active" to="/"><HomeIcon size={19} /><span>Home</span></Link>
        <Link to="/menu"><Search size={19} /><span>Explore</span></Link>
        <Link to="/orders"><Bell size={19} /><span>Orders</span></Link>
        <Link to={isAuthenticated ? "/orders" : "/login"}><UserRound size={19} /><span>Profile</span></Link>
      </nav>
    </main>
  );
}

export default Home;
