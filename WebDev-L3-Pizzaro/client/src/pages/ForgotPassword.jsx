
import { useState } from "react";
import { Link } from "react-router-dom";
import RecipePageHeader from "../components/RecipePageHeader";
import { API_BASE_URL } from "../api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            (response.status >= 500
              ? "The server could not process the reset request. Check the backend logs."
              : "Something went wrong")
        );
      }

      setMessage(data.message);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? `Cannot reach the PIZZARO API at ${API_BASE_URL}. Start the backend, or configure CLIENT_URL for the browser's network address.`
          : err.message || "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="recipe-app recipe-auth-page">
      <RecipePageHeader />
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          PIZZARO
        </Link>

        <div className="auth-heading">
          <span>ACCOUNT RECOVERY</span>
          <h1>Forgot password?</h1>
          <p>Enter your registered email to begin resetting your password.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          {message && <p className="auth-success">{message}</p>}
          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Processing..." : "Request reset"}
          </button>
        </form>

        <p className="auth-switch">
          Remember your password? <Link to="/login">Sign in</Link>
        </p>

        <p className="auth-switch">
          Have a reset token? <Link to="/reset-password">Reset password</Link>
        </p>
      </div>
    </main>
  );
}

export default ForgotPassword;