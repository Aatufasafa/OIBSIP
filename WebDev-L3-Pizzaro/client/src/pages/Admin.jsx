
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import RecipePageHeader from "../components/RecipePageHeader";
import { API_BASE_URL } from "../api";
import {
  RefreshCw,
  Package,
  Clock,
  IndianRupee,
  ArrowLeft,
} from "lucide-react";
import {
  formatOrderAmount,
  getOrderPaymentDisplay,
} from "../utils/orderPaymentDisplay";

const STATUSES = [
  "Order Received",
  "In Kitchen",
  "Sent to Delivery",
  "Delivered",
  "Cancelled",
];

function Admin() {
  const { token, user } = useAuth();
  const { cartCount } = useCart();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [inventorySavingId, setInventorySavingId] = useState("");
  const [inventoryEdits, setInventoryEdits] = useState({});

  const fetchOrders = useCallback(async () => {
    if (!token) {
      setError("Please sign in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/orders/admin/all`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load orders.");
      }

      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchInventory = useCallback(async () => {
    try {
      setInventoryLoading(true);
      setInventoryError("");
      const response = await fetch(`${API_BASE_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load inventory");
      setIngredients(data.ingredients || []);
    } catch (err) {
      setInventoryError(err.message || "Unable to load inventory");
    } finally {
      setInventoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 0);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  useEffect(() => {
    const timer = setTimeout(fetchInventory, 0);
    return () => clearTimeout(timer);
  }, [fetchInventory]);

  function changeInventoryEdit(ingredient, field, value) {
    setInventoryEdits((current) => ({
      ...current,
      [ingredient._id]: {
        stock: String(current[ingredient._id]?.stock ?? ingredient.stock),
        lowStockThreshold: String(
          current[ingredient._id]?.lowStockThreshold ??
            ingredient.lowStockThreshold
        ),
        [field]: value,
      },
    }));
  }

  async function updateInventory(ingredient) {
    const edit = inventoryEdits[ingredient._id] || {
      stock: String(ingredient.stock),
      lowStockThreshold: String(ingredient.lowStockThreshold),
    };
    const stock = Number(edit.stock);
    const lowStockThreshold = Number(edit.lowStockThreshold);
    if (
      !Number.isInteger(stock) ||
      stock < 0 ||
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setInventoryError("Stock and threshold must be non-negative whole numbers.");
      return;
    }

    try {
      setInventorySavingId(ingredient._id);
      setInventoryError("");
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/${ingredient._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ stock, lowStockThreshold }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update inventory");
      setIngredients((current) =>
        current.map((item) =>
          item._id === ingredient._id ? data.ingredient : item
        )
      );
      setInventoryEdits((current) => {
        const next = { ...current };
        delete next[ingredient._id];
        return next;
      });
    } catch (err) {
      setInventoryError(err.message || "Unable to update inventory");
    } finally {
      setInventorySavingId("");
    }
  }

  async function updateStatus(orderId, status) {
    try {
      setUpdatingId(orderId);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/orders/admin/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update status.");
      }

      setOrders((current) =>
        current.map((order) =>
          order._id === orderId ? data.order : order
        )
      );
    } catch (err) {
      setError(err.message || "Unable to update order.");
    } finally {
      setUpdatingId("");
    }
  }

  const totalRevenue = orders
    .filter((order) => order.status !== "Cancelled")
    .reduce((sum, order) => sum + order.total, 0);

  const activeOrders = orders.filter(
    (order) =>
      !["Delivered", "Cancelled"].includes(order.status)
  ).length;

  if (user?.role !== "admin") {
    return (
      <main className="recipe-app recipe-admin-page">
        <RecipePageHeader />
        <div className="recipe-shell">
        <div className="admin-message">
          <h1>Admin access required</h1>
          <p>Sign in with your administrator account to continue.</p>
          <Link to="/" className="order-button">
            Return home
          </Link>
        </div>
        </div>
      </main>
    );
  }

  return (
    <main className="recipe-app recipe-admin-page">
      <RecipePageHeader activePage="orders" />
      <div className="recipe-shell">
      <header className="admin-header">
        <Link to="/" className="admin-back">
          <ArrowLeft size={18} /> PIZZARO
        </Link>

        <div className="admin-heading">
          <span className="section-label">CONTROL CENTRE</span>
          <h1>Order dashboard</h1>
          <p>Welcome, {user?.name || "Admin"}.</p>
        </div>

        <button
          type="button"
          className="admin-refresh"
          onClick={fetchOrders}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <section className="admin-stats">
        <article className="admin-stat-card">
          <Package size={22} />
          <span>Total orders</span>
          <strong>{orders.length}</strong>
        </article>

        <article className="admin-stat-card">
          <Clock size={22} />
          <span>Active orders</span>
          <strong>{activeOrders}</strong>
        </article>

        <article className="admin-stat-card">
          <IndianRupee size={22} />
          <span>Order value</span>
          <strong>₹{totalRevenue}</strong>
        </article>
      </section>

      <section className="admin-inventory-section">
        <div className="admin-section-heading">
          <div>
            <span className="section-label">STOCK CONTROL</span>
            <h2>Ingredient inventory</h2>
          </div>
          <button
            type="button"
            className="admin-refresh"
            onClick={fetchInventory}
            disabled={inventoryLoading}
          >
            <RefreshCw size={16} />
            Refresh stock
          </button>
        </div>
        {inventoryError && <div className="admin-error">{inventoryError}</div>}
        {inventoryLoading ? (
          <p className="admin-empty">Loading inventory...</p>
        ) : (
          <div className="admin-inventory-grid">
            {ingredients.map((ingredient) => {
              const edit = inventoryEdits[ingredient._id] || {
                stock: String(ingredient.stock),
                lowStockThreshold: String(ingredient.lowStockThreshold),
              };
              const isLowStock = ingredient.stock <= ingredient.lowStockThreshold;
              return (
                <article className="admin-inventory-card" key={ingredient._id}>
                  <div className="admin-inventory-title">
                    <div>
                      <span className="section-label">{ingredient.type}</span>
                      <h3>{ingredient.name}</h3>
                    </div>
                    <span className={isLowStock ? "inventory-low" : "inventory-ok"}>
                      {isLowStock ? "Low stock" : "In stock"}
                    </span>
                  </div>
                  <p className="admin-inventory-current">
                    Current stock: <strong>{ingredient.stock}</strong>
                  </p>
                  <div className="admin-inventory-fields">
                    <label>
                      Stock
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={edit.stock}
                        onChange={(event) =>
                          changeInventoryEdit(ingredient, "stock", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Low-stock threshold
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={edit.lowStockThreshold}
                        onChange={(event) =>
                          changeInventoryEdit(
                            ingredient,
                            "lowStockThreshold",
                            event.target.value
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-inventory-save"
                      onClick={() => updateInventory(ingredient)}
                      disabled={inventorySavingId === ingredient._id}
                    >
                      {inventorySavingId === ingredient._id ? "Saving..." : "Update"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-orders-section">
        <div className="admin-section-heading">
          <div>
            <span className="section-label">LIVE MANAGEMENT</span>
            <h2>Customer orders</h2>
          </div>
          <span>{orders.length} orders</span>
        </div>

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="admin-empty">Loading orders...</p>
        ) : orders.length === 0 && !error ? (
          <p className="admin-empty">No customer orders yet.</p>
        ) : (
          <div className="admin-orders-list">
            {orders.map((order) => {
              const paymentDisplay = getOrderPaymentDisplay(order);

              return (
                <article className="admin-order-card" key={order._id}>
                  <div className="admin-order-top">
                    <div>
                      <span className="section-label">
                        ORDER #{order._id.slice(-8).toUpperCase()}
                      </span>
                      <h3>{order.customerName}</h3>
                      <p>{order.mobile}</p>
                      <p>
                        {order.address}, {order.city} - {order.pincode}
                      </p>
                      {order.user?.email && (
                        <p>{order.user.email}</p>
                      )}
                    </div>

                    <strong className="admin-order-total">
                      {formatOrderAmount(paymentDisplay.total)}
                    </strong>
                  </div>

                  <section
                    className="admin-payment-summary"
                    aria-label="Payment details"
                  >
                    <div>
                      <span className="admin-payment-label">Payment method</span>
                      <strong>{paymentDisplay.methodLabel}</strong>
                    </div>
                    <div>
                      <span className="admin-payment-label">Payment status</span>
                      <strong className={`admin-payment-state ${paymentDisplay.statusTone}`}>
                        {paymentDisplay.statusLabel}
                      </strong>
                    </div>
                    <div className="admin-payment-amounts">
                      <span>
                        Total <strong>{formatOrderAmount(paymentDisplay.total)}</strong>
                      </span>
                      <span>
                        {paymentDisplay.paidLabel}{" "}
                        <strong>{formatOrderAmount(paymentDisplay.paid)}</strong>
                      </span>
                      <span>
                        Due <strong>{formatOrderAmount(paymentDisplay.due)}</strong>
                      </span>
                      {paymentDisplay.refundInitiated && (
                        <span>
                          Refund initiated{" "}
                          <strong>{formatOrderAmount(paymentDisplay.refundAmount)}</strong>
                        </span>
                      )}
                    </div>
                  </section>

                  <div className="admin-order-items">
                    {order.items.map((item, index) => (
                      <div key={`${order._id}-${index}`}>
                        <span>
                          {item.name} · {item.size} × {item.quantity}
                        </span>
                        <span>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {order.cookingRequest && (
                    <p className="admin-order-note">
                      <strong>Cooking request:</strong>{" "}
                      {order.cookingRequest}
                    </p>
                  )}

                  {order.instructions?.length > 0 && (
                    <p className="admin-order-note">
                      <strong>Delivery instructions:</strong>{" "}
                      {order.instructions.join(", ")}
                    </p>
                  )}

                  <div className="admin-order-footer">
                    <div>
                      <label htmlFor={`status-${order._id}`}>
                        Order status
                      </label>
                      <select
                        id={`status-${order._id}`}
                        value={order.status}
                        disabled={updatingId === order._id}
                        onChange={(event) =>
                          updateStatus(order._id, event.target.value)
                        }
                      >
                        {STATUSES.filter((status) => {
                          if (status === order.status) return true;
                          if (status === "Cancelled") return order.status === "Order Received";
                          return status === STATUSES[STATUSES.indexOf(order.status) + 1];
                        }).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {updatingId === order._id && (
                    <p className="admin-saving">Saving status...</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="admin-footer">
        <Link to="/menu">Menu</Link>
        <Link to="/cart">Cart ({cartCount})</Link>
        <Link to="/orders">Customer order history</Link>
      </footer>
      </div>
    </main>
  );
}

export default Admin;