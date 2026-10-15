import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RecipePageHeader from "../components/RecipePageHeader";
import { CreditCard, MapPin, Wallet } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../api";

const PIN_API =
  "https://aniket-thapa.github.io/india-pincode-api/pincodes";

function Checkout() {
  const navigate = useNavigate();
  const { cartItems, cartCount, cartTotal, clearCart } = useCart();
  const { token } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [verificationRetry, setVerificationRetry] = useState(null);
  const checkoutLock = useRef(false);
  const requestId = useRef(null);

  const [address, setAddress] = useState({
    name: "",
    phone: "",
    house: "",
    street: "",
    city: "",
    pincode: "",
  });

  const [pincodeStatus, setPincodeStatus] = useState("");

  const locationState = window.history.state?.usr || {};

  const cookingRequest = locationState.cookingRequest || "";
  const instructions = locationState.instructions || [];
  const tipAmount = Number(locationState.tipAmount || 0);

  async function loadRazorpay() {
    if (window.Razorpay) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Unable to load Razorpay Checkout"));
      document.body.appendChild(script);
    });
    if (!window.Razorpay) throw new Error("Razorpay Checkout did not initialize");
  }

  async function cancelPaymentAttempt(attemptId, message) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/razorpay/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attemptId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to close payment attempt");
      requestId.current = null;
      setOrderError(message || data.message);
    } catch (error) {
      setOrderError(error.message || "Unable to confirm payment cancellation");
    } finally {
      checkoutLock.current = false;
      setPlacingOrder(false);
    }
  }

  async function verifyPayment(attemptId, paymentResponse) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/razorpay/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attemptId, ...paymentResponse }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Payment verification failed");
      setVerificationRetry(null);
      clearCart();
      navigate("/orders");
    } catch (error) {
      setVerificationRetry({ attemptId, paymentResponse });
      setOrderError(
        `${error.message || "Payment verification failed"}. Your order is not confirmed; retry verification.`
      );
      checkoutLock.current = false;
    } finally {
      setPlacingOrder(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setAddress((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function checkPincode(value) {
    if (!/^\d{6}$/.test(value)) {
      setPincodeStatus("");
      return;
    }

    setPincodeStatus("checking");

    try {
      const response = await fetch(`${PIN_API}/${value}.json`);

      if (!response.ok) {
        throw new Error("Invalid PIN code");
      }

      const data = await response.json();

      if (!data || !data.district) {
        setPincodeStatus("invalid");
        return;
      }

      setPincodeStatus("valid");
    } catch {
      setPincodeStatus("invalid");
    }
  }

  function handlePincodeChange(event) {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 6);

    setAddress((current) => ({
      ...current,
      pincode: value,
    }));

    checkPincode(value);
  }

  function validateForm() {
    if (!address.name.trim()) {
      setOrderError("Please enter your name.");
      return false;
    }

    if (!/^[6-9]\d{9}$/.test(address.phone)) {
      setOrderError("Please enter a valid 10-digit mobile number.");
      return false;
    }

    if (!address.house.trim()) {
      setOrderError("Please enter your house or building.");
      return false;
    }

    if (!address.street.trim()) {
      setOrderError("Please enter your street or area.");
      return false;
    }

    if (!address.city.trim()) {
      setOrderError("Please enter your city.");
      return false;
    }

    if (!/^\d{6}$/.test(address.pincode)) {
      setOrderError("Please enter a valid 6-digit PIN code.");
      return false;
    }

    if (pincodeStatus !== "valid") {
      setOrderError("Please wait for the PIN code to be verified.");
      return false;
    }

    return true;
  }

  async function handlePlaceOrder(event) {
    event.preventDefault();

    setOrderError("");
    setVerificationRetry(null);
    if (checkoutLock.current) return;

    if (!validateForm()) {
      return;
    }

    if (!token) {
      setOrderError("Please sign in before placing your order.");
      return;
    }

    if (cartItems.length === 0) {
      setOrderError("Your cart is empty.");
      return;
    }

    checkoutLock.current = true;
    setPlacingOrder(true);

    const requestFingerprint = JSON.stringify({
      cartItems,
      tipAmount,
      address,
      paymentMethod,
      cookingRequest,
      instructions,
    });
    if (requestId.current?.fingerprint !== requestFingerprint) {
      requestId.current = {
        fingerprint: requestFingerprint,
        id: crypto.randomUUID(),
      };
    }
    const orderData = {
      items: cartItems.map((item) => ({
        pizzaId: item.id,
        name: item.name,
        size: item.size,
        price: item.price,
        quantity: item.quantity,
        customization: {
          base: item.customization?.base || "classic",
          crust: item.customization?.crust || "classic",
          sauce: item.customization?.sauce || "tomato",
          cheese: item.customization?.cheese || "mozzarella",
          vegetables: item.customization?.vegetables || [],
          customizationPrice:
            item.customization?.customizationPrice || 0,
        },
      })),

      total: cartTotal + tipAmount,
      tipAmount,

      customerName: address.name,
      mobile: address.phone,

      address: `${address.house}, ${address.street}`,

      city: address.city,
      pincode: address.pincode,

      paymentMethod,
      cookingRequest,
      instructions,
      checkoutRequestId: requestId.current.id,
    };

    let activeAttemptId = null;
    let serverResponded = false;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(orderData),
        }
      );
      serverResponded = true;

      let data;
      try {
        data = await response.json();
      } catch {
        console.error("Order API returned an invalid response", {
          status: response.status,
          contentType: response.headers.get("content-type"),
        });
        throw new Error(
          `The server returned an invalid response (HTTP ${response.status}). Check the backend logs and retry.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to place order"
        );
      }

      if (paymentMethod === "cod") {
        clearCart();
        navigate("/orders");
        return;
      }

      const payment = data.payment;
      if (!payment?.attemptId || !payment?.orderId || !payment?.keyId) {
        throw new Error("The server returned incomplete payment details");
      }
      activeAttemptId = payment.attemptId;

      await loadRazorpay();
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "PIZZARO",
        description: "Pizza delivery order",
        order_id: payment.orderId,
        theme: { color: "#bd1010" },
        handler: (paymentResponse) => {
          void verifyPayment(payment.attemptId, paymentResponse);
        },
        modal: {
          ondismiss: () => {
            void cancelPaymentAttempt(
              payment.attemptId,
              "Checkout closed. Any payment cancellation is confirmed by the server."
            );
          },
        },
      });
      checkout.on("payment.failed", () => {
        void cancelPaymentAttempt(
          payment.attemptId,
          "Payment failed. Your order was not placed."
        );
      });
      checkout.open();
    } catch (error) {
      console.error("Place order error:", error);
      if (serverResponded) requestId.current = null;
      if (activeAttemptId) {
        await cancelPaymentAttempt(
          activeAttemptId,
          `${error.message || "Checkout could not start"}. The server will confirm whether stock can be released.`
        );
      } else {
        setOrderError(error.message || "Something went wrong.");
        checkoutLock.current = false;
        setPlacingOrder(false);
      }
    }
  }

  function retryPaymentVerification() {
    if (!verificationRetry || checkoutLock.current) return;
    checkoutLock.current = true;
    setPlacingOrder(true);
    void verifyPayment(
      verificationRetry.attemptId,
      verificationRetry.paymentResponse
    );
  }

  if (cartItems.length === 0) {
    return (
      <main className="recipe-app recipe-checkout-page">
        <RecipePageHeader activePage="cart" />
        <div className="recipe-shell">
        <div className="empty-checkout">
          <p className="section-label">CHECKOUT</p>

          <h1>Your cart is empty.</h1>

          <p>Add something from the menu first.</p>

          <Link to="/menu" className="order-button">
            Browse menu
          </Link>
        </div>
        </div>
      </main>
    );
  }

  return (
    <main className="recipe-app recipe-checkout-page">
      <RecipePageHeader activePage="cart" />
      <div className="recipe-shell">
      <header className="checkout-header">
        <Link to="/cart" className="back-link">
          ← Cart
        </Link>

        <div>
          <p className="section-label">CHECKOUT</p>
          <h1>Almost there.</h1>
        </div>

        <span className="checkout-count">
          {cartCount} {cartCount === 1 ? "item" : "items"}
        </span>
      </header>

      <form
        className="checkout-layout"
        onSubmit={handlePlaceOrder}
      >
        <div className="checkout-main">
          <section className="checkout-section">
            <div className="checkout-section-heading">
              <MapPin size={20} />

              <div>
                <h2>Delivery address</h2>
                <span>Where should we deliver?</span>
              </div>
            </div>

            <div className="checkout-fields">
              <input
                type="text"
                name="name"
                value={address.name}
                onChange={handleChange}
                placeholder="Full name"
              />

              <input
                type="tel"
                name="phone"
                value={address.phone}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                maxLength="10"
              />

              <input
                type="text"
                name="house"
                value={address.house}
                onChange={handleChange}
                placeholder="House / Flat / Building"
              />

              <input
                type="text"
                name="street"
                value={address.street}
                onChange={handleChange}
                placeholder="Street / Area"
              />

              <div className="checkout-field-row">
                <input
                  type="text"
                  name="city"
                  value={address.city}
                  onChange={handleChange}
                  placeholder="City"
                />

                <div className="pincode-field">
                  <input
                    type="text"
                    name="pincode"
                    value={address.pincode}
                    onChange={handlePincodeChange}
                    placeholder="6-digit PIN code"
                    maxLength="6"
                  />

                  {pincodeStatus === "checking" && (
                    <small>Checking PIN...</small>
                  )}

                  {pincodeStatus === "valid" && (
                    <small>PIN verified</small>
                  )}

                  {pincodeStatus === "invalid" && (
                    <small>Invalid PIN code</small>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-heading">
              <CreditCard size={20} />

              <div>
                <h2>Payment method</h2>
                <span>Choose how you'd like to pay</span>
              </div>
            </div>

            <div className="payment-options">
              <button
                type="button"
                className={
                  paymentMethod === "razorpay"
                    ? "selected"
                    : ""
                }
                onClick={() => setPaymentMethod("razorpay")}
              >
                <CreditCard size={20} />

                <div>
                  <strong>Razorpay</strong>
                  <span>UPI, cards and net banking</span>
                </div>

                <span className="payment-circle" />
              </button>

              <button
                type="button"
                className={
                  paymentMethod === "cod"
                    ? "selected"
                    : ""
                }
                onClick={() => setPaymentMethod("cod")}
              >
                <Wallet size={20} />

                <div>
                  <strong>Cash on delivery</strong>
                  <span>Pay when your order arrives</span>
                </div>

                <span className="payment-circle" />
              </button>
            </div>
          </section>
        </div>

        <aside className="checkout-summary">
          <p className="section-label">ORDER SUMMARY</p>

          {cartItems.map((item) => (
            <div
              className="checkout-summary-item"
              key={item.cartItemId}
            >
              <div>
                <strong>{item.name}</strong>

                <span>
                  {item.size} × {item.quantity}
                </span>
              </div>

              <span>
                ₹{item.price * item.quantity}
              </span>
            </div>
          ))}

          {instructions.length > 0 && (
            <div className="checkout-order-note">
              <strong>Delivery instructions</strong>

              <p>{instructions.join(" · ")}</p>
            </div>
          )}

          {cookingRequest && (
            <div className="checkout-order-note">
              <strong>Cooking request</strong>

              <p>{cookingRequest}</p>
            </div>
          )}

          {tipAmount > 0 && (
            <div className="checkout-order-note">
              <strong>Rider tip</strong>

              <p>₹{tipAmount}</p>
            </div>
          )}

          <div className="summary-row">
            <span>Items</span>
            <span>{cartCount}</span>
          </div>

          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{cartTotal}</span>
          </div>

          <div className="summary-total">
            <span>Total</span>

            <strong>
              ₹{cartTotal + tipAmount}
            </strong>
          </div>

          {orderError && (
            <p className="field-error checkout-order-error">
              {orderError}
            </p>
          )}
          {verificationRetry && (
            <button
              type="button"
              className="place-order-button"
              onClick={retryPaymentVerification}
              disabled={placingOrder}
            >
              Retry payment verification
            </button>
          )}

          <button
            type="submit"
            className="place-order-button"
            disabled={placingOrder}
          >
            {placingOrder
              ? "Placing order..."
              : "Place order →"}
          </button>

          <p className="secure-note">
            Secure payment · Test mode
          </p>
        </aside>
      </form>
      </div>
    </main>
  );
}

export default Checkout;