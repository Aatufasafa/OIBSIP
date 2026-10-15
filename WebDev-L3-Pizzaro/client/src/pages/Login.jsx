import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RecipePageHeader from "../components/RecipePageHeader";
import { API_BASE_URL } from "../api";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setNeedsVerification(false);
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
        }
        throw new Error(data.message || "Login failed");
      }

      login(data.user, data.token);
navigate("/");
    } catch (error) {
      setError(
        error instanceof TypeError
          ? `Cannot reach the PIZZARO API at ${API_BASE_URL}. Start the backend, or configure CLIENT_URL for the browser's network address.`
          : error.message || "Unable to connect to the server"
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
          <span>WELCOME BACK</span>
          <h1>Sign in</h1>
          <p>Enter your details to continue ordering.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </label>
          <p className="auth-switch">
  <Link to="/forgot-password">Forgot password?</Link>
</p>

          {error && <p className="auth-error">{error}</p>}
          {needsVerification && (
            <p className="auth-switch">
              <Link to={`/verify-email?email=${encodeURIComponent(formData.email.trim())}`}>
                Resend verification email
              </Link>
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </main>
  );
}

export default Login;