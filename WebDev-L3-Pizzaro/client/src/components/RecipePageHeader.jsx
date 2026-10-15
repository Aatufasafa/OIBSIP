import {
  Bell,
  ChefHat,
  Home as HomeIcon,
  LogOut,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

function RecipePageHeader({ activePage }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate("/");
  }

  return (
    <>
      <header className="recipe-topbar">
        <Link to="/" className="recipe-brand" aria-label="Pizzaro home">
          <span className="recipe-brand-mark"><ChefHat size={19} /></span>
          <span>pizzaro<span className="recipe-brand-dot">.</span></span>
        </Link>
        <nav className="recipe-desktop-nav" aria-label="Main navigation">
          <Link className={activePage === "home" ? "is-active" : ""} to="/">Discover</Link>
          <Link className={activePage === "menu" ? "is-active" : ""} to="/menu">Menu</Link>
          <Link className={activePage === "orders" ? "is-active" : ""} to="/orders">My orders</Link>
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
      <nav className="recipe-mobile-nav" aria-label="Quick navigation">
        <Link className={activePage === "home" ? "is-active" : ""} to="/">
          <HomeIcon size={19} /><span>Home</span>
        </Link>
        <Link className={activePage === "menu" ? "is-active" : ""} to="/menu">
          <Search size={19} /><span>Explore</span>
        </Link>
        <Link className={activePage === "orders" ? "is-active" : ""} to="/orders">
          <Bell size={19} /><span>Orders</span>
        </Link>
        <Link to={isAuthenticated ? "/orders" : "/login"}>
          <UserRound size={19} /><span>Profile</span>
        </Link>
      </nav>
    </>
  );
}

export default RecipePageHeader;
