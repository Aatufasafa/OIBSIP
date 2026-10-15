
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock3,
  ChevronRight,
  ArrowLeft,
  ShoppingBag,
  RefreshCw,
  Check,
  PackageCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import RecipePageHeader from "../components/RecipePageHeader";
import { API_BASE_URL } from "../api";
import {
  formatOrderAmount,
  getOrderPaymentDisplay,
} from "../utils/orderPaymentDisplay";

const STATUS_STEPS = [
  { name: "Order Received", description: "Order confirmed" },
  { name: "In Kitchen", description: "Freshly prepared" },
  { name: "Sent to Delivery", description: "On its way" },
  { name: "Delivered", description: "Enjoy your meal" },
];

function formatDate(date) {
  if (!date) return "Recently placed";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Recently placed";

  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Orders() {
  const { cartCount } = useCart();
  const { token } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadOrders(showLoading = false) {
    if (!token) {
      const resetTimer = setTimeout(() => {
        setOrders([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    try {
      if (showLoading) setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/orders/my-orders`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load orders.");
      }

      setOrders(data.orders || []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load your orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (!active) return;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/orders/my-orders`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load orders.");
        }

        if (active) {
          setOrders(data.orders || []);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load your orders.");
          setLoading(false);
        }
      }
    }

    if (!token) {
      const resetTimer = setTimeout(() => {
        setOrders([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    refresh();

    const refreshTimer = setInterval(refresh, 10000);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, [token]);

  async function handleCancelOrder(orderId) {
    if (
      !window.confirm(
        "Are you sure you want to cancel this order?"
      )
    ) {
      return;
    }

    try {
      setCancellingId(orderId);

      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/cancel`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to cancel order.");
      }

      await loadOrders(false);
    } catch (err) {
      window.alert(err.message || "Could not cancel the order.");
    } finally {
      setCancellingId(null);
    }
  }

  function getTimeLeft(order) {
    if (order.status === "Cancelled" || !order.cancellationDeadline) {
      return 0;
    }

    return Math.max(
      0,
      new Date(order.cancellationDeadline).getTime() - currentTime
    );
  }

  function formatTime(milliseconds) {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);

    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function getOrderId(order) {
    return order._id
      ? order._id.slice(-8).toUpperCase()
      : order.id || "UNKNOWN";
  }

  function getStatusIndex(status) {
    return STATUS_STEPS.findIndex((step) => step.name === status);
  }

  function getInstructions(instructions) {
    if (Array.isArray(instructions)) return instructions.join(" · ");
    return instructions || "";
  }

  const activeOrders = orders.filter(
    (order) => !["Delivered", "Cancelled"].includes(order.status)
  ).length;

  return (
    <main className="recipe-app recipe-orders-page">
      <RecipePageHeader activePage="orders" />
      <div className="recipe-shell">
      <header className="orders-header">
        <Link to="/menu" className="orders-back-link">
          <ArrowLeft size={16} />
          <span>Back to menu</span>
        </Link>

        <Link to="/cart" className="orders-cart-link">
          <ShoppingBag size={17} />
          <span>Cart</span>
          <span className="orders-cart-count">{cartCount}</span>
        </Link>
      </header>

      <section className="orders-hero">
        <div className="orders-hero-copy">
          <span className="orders-eyebrow">
            THE PIZZARO EXPERIENCE
          </span>

          <h1>
            Your orders<span>.</span>
          </h1>

          <p>
            Every order, every update, all in one place.
          </p>
        </div>

        <div className="orders-hero-mark" aria-hidden="true">
          <span>EST.</span>
          <strong>P</strong>
          <span>PIZZARO</span>
        </div>
      </section>

      <div className="orders-summary">
        <div className="orders-summary-item">
          <span className="orders-summary-label">TOTAL ORDERS</span>
          <strong>{loading ? "—" : orders.length}</strong>
          <span className="orders-summary-caption">Your order history</span>
        </div>

        <div className="orders-summary-divider" />

        <div className="orders-summary-item">
          <span className="orders-summary-label">IN PROGRESS</span>
          <strong>{loading ? "—" : activeOrders}</strong>
          <span className="orders-summary-caption">Currently being prepared</span>
        </div>

        <div className="orders-summary-divider" />

        <div className="orders-summary-item">
          <span className="orders-summary-label">ORDER UPDATES</span>
          <strong className="orders-live-indicator">
            <span />
            LIVE
          </strong>
          <span className="orders-summary-caption">Refreshes automatically</span>
        </div>
      </div>

      <section className="orders-content">
        <div className="orders-section-heading">
          <div>
            <span className="orders-eyebrow">YOUR HISTORY</span>
            <h2>Order history</h2>
          </div>

          {!loading && !error && orders.length > 0 && (
            <span className="orders-count-label">
              {orders.length} {orders.length === 1 ? "ORDER" : "ORDERS"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="orders-state-card">
            <span className="orders-state-icon">
              <Clock3 size={25} />
            </span>
            <h3>Gathering your orders</h3>
            <p>Just a moment while we bring up your history.</p>
          </div>
        ) : error ? (
          <div className="orders-state-card">
            <span className="orders-state-icon">
              <RefreshCw size={25} />
            </span>
            <h3>Couldn't load your orders</h3>
            <p>{error}</p>
            <button
              type="button"
              className="orders-primary-button"
              onClick={() => loadOrders(true)}
            >
              Try again <ChevronRight size={16} />
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="orders-state-card orders-empty-state">
            <span className="orders-state-icon">
              <ShoppingBag size={26} />
            </span>
            <span className="orders-eyebrow">A LITTLE SPACE FOR SOMETHING DELICIOUS</span>
            <h3>Your story starts here.</h3>
            <p>
              Your orders will show up here once you've picked your
              favourites and placed your first order.
            </p>
            <Link to="/menu" className="orders-primary-button">
              Explore the menu <ChevronRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const timeLeft = getTimeLeft(order);
              const canCancel =
                order.status === "Order Received" && timeLeft > 0;
              const currentIndex = getStatusIndex(order.status);
              const isCancelled = order.status === "Cancelled";
              const isDelivered = order.status === "Delivered";
              const paymentDisplay = getOrderPaymentDisplay(order);

              return (
                <article className="order-card" key={order._id}>
                  <div className="order-card-top">
                    <div className="order-card-identity">
                      <div className="order-number-line">
                        <span className="order-number-label">ORDER</span>
                        <span className="order-number">#{getOrderId(order)}</span>
                      </div>

                      <span className="order-date">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>

                    <div className="order-card-total">
                      <span className="order-total-label">ORDER TOTAL</span>
                      <strong>{formatOrderAmount(paymentDisplay.total)}</strong>
                      <span className={`order-status ${isCancelled ? "cancelled" : isDelivered ? "delivered" : ""}`}>
                        <span className="order-status-dot" />
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <section
                    className="order-payment-summary"
                    aria-label="Payment details"
                  >
                    <div className="order-payment-heading">
                      <span className="order-payment-method">
                        {paymentDisplay.methodLabel}
                      </span>
                      <strong
                        className={`order-payment-state ${paymentDisplay.statusTone}`}
                      >
                        {paymentDisplay.statusLabel}
                      </strong>
                    </div>
                    <div className="order-payment-amounts">
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

                  {!isCancelled && (
                    <div className="order-tracking">
                      <div className="order-tracking-heading">
                        <div>
                          <span className="orders-eyebrow">ORDER JOURNEY</span>
                          <h3>
                            {isDelivered
                              ? "Delivered with care."
                              : currentIndex === 0
                              ? "We've got your order."
                              : currentIndex === 1
                              ? "Something good is cooking."
                              : "Your pizza is on the move."}
                          </h3>
                        </div>

                        <PackageCheck size={22} />
                      </div>

                      <div className="order-timeline">
                        {STATUS_STEPS.map((step, index) => {
                          const completed =
                            currentIndex >= 0 && index < currentIndex;
                          const current = index === currentIndex;
                          const upcoming =
                            currentIndex >= 0 && index > currentIndex;

                          return (
                            <div
                              key={step.name}
                              className={[
                                "timeline-step",
                                completed ? "completed" : "",
                                current ? "current" : "",
                                upcoming ? "upcoming" : "",
                              ].filter(Boolean).join(" ")}
                            >
                              <div className="timeline-marker-wrap">
                                <span className="timeline-marker">
                                  {completed ? <Check size={14} /> : index + 1}
                                </span>
                                {index < STATUS_STEPS.length - 1 && (
                                  <span className="timeline-connector" />
                                )}
                              </div>

                              <div className="timeline-copy">
                                <strong>{step.name}</strong>
                                <span>{step.description}</span>
                                {current && !isDelivered && (
                                  <small>IN PROGRESS</small>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="order-cancelled-notice">
                      This order has been cancelled.
                    </div>
                  )}

                  <div className="order-items-heading">
                    <h3>In this order</h3>
                    <span>
                      {order.items.reduce(
                        (sum, item) => sum + Number(item.quantity || 0),
                        0
                      )}{" "}
                      items
                    </span>
                  </div>

                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div
                        className="order-item"
                        key={`${item.pizzaId}-${item.size}-${index}`}
                      >
                        <div className="order-item-number">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="order-item-details">
                          <strong>{item.name}</strong>
                          <span className="order-item-meta">
                            {item.size} · Qty {item.quantity}
                          </span>

                          {item.customization && (
                            <div className="order-customization">
                              {[
                                item.customization.base === "classic"
                                  ? "Classic base"
                                  : item.customization.base,
                                item.customization.sauce === "tomato"
                                  ? "Classic tomato"
                                  : item.customization.sauce,
                                item.customization.cheese === "mozzarella"
                                  ? "Mozzarella"
                                  : item.customization.cheese,
                                ...(item.customization.vegetables || []),
                              ]
                                .filter(Boolean)
                                .map((option) => (
                                  <span key={option}>{option}</span>
                                ))}
                            </div>
                          )}
                        </div>

                        <strong className="order-item-price">
                          ₹{Number(item.price * item.quantity).toFixed(2).replace(/\.00$/, "")}
                        </strong>
                      </div>
                    ))}
                  </div>

                  {(order.cookingRequest ||
                    getInstructions(order.instructions) ||
                    order.tipAmount > 0) && (
                    <div className="order-notes">
                      {order.cookingRequest && (
                        <div className="order-note">
                          <span>COOKING REQUEST</span>
                          <p>{order.cookingRequest}</p>
                        </div>
                      )}

                      {getInstructions(order.instructions) && (
                        <div className="order-note">
                          <span>DELIVERY INSTRUCTIONS</span>
                          <p>{getInstructions(order.instructions)}</p>
                        </div>
                      )}

                      {order.tipAmount > 0 && (
                        <div className="order-note">
                          <span>RIDER TIP</span>
                          <p>₹{order.tipAmount}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {canCancel && (
                    <div className="order-cancel-area">
                      <div className="cancel-clock">
                        <Clock3 size={17} />
                      </div>

                      <div className="cancel-copy">
                        <strong>Need to change your mind?</strong>
                        <span>
                          Cancellation available for{" "}
                          <b>{formatTime(timeLeft)}</b>
                        </span>
                      </div>

                      <button
                        type="button"
                        className="cancel-order-button"
                        disabled={cancellingId === order._id}
                        onClick={() => handleCancelOrder(order._id)}
                      >
                        {cancellingId === order._id
                          ? "Cancelling..."
                          : "Cancel order"}
                      </button>
                    </div>
                  )}

                  {!canCancel && order.status === "Order Received" && (
                    <p className="cancel-expired">
                      The cancellation window has closed. Your order will proceed.
                    </p>
                  )}

                  <div className="order-card-footer">
                    <span>
                      {isCancelled
                        ? "We hope to serve you another time."
                        : isDelivered
                        ? "Thank you for choosing PIZZARO."
                        : "Made fresh. Made for you."}
                    </span>

                    <Link to="/menu" className="order-again">
                      Order again <ChevronRight size={17} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="orders-footer">
        <span>PIZZARO</span>
        <span>GOOD PIZZA. GOOD MOMENTS.</span>
      </footer>
      </div>
    </main>
  );
}

export default Orders;