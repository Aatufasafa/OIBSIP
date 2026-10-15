import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RecipePageHeader from "../components/RecipePageHeader";
import { API_BASE_URL } from "../api";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const verificationStarted = useRef(false);
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;
    fetch(`${API_BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Email verification failed");
        setMessage(data.message);
      })
      .catch((err) => {
        setError(err.message || "Email verification failed");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  async function resendVerification(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to resend verification email");
      setMessage(data.message);
    } catch (err) {
      setError(err.message || "Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="recipe-app recipe-auth-page">
      <RecipePageHeader />
      <div className="auth-card">
        <Link to="/" className="auth-logo">PIZZARO</Link>
        <div className="auth-heading">
          <span>ACCOUNT VERIFICATION</span>
          <h1>Verify your email</h1>
          <p>Follow the link we emailed you to activate your account.</p>
        </div>
        {loading ? (
          <p className="auth-switch">Verifying your email...</p>
        ) : (
          <>
            {message && <p className="auth-success">{message}</p>}
            {error && <p className="auth-error">{error}</p>}
            {!message && (
              <form onSubmit={resendVerification} className="auth-form">
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
                <button type="submit" className="auth-submit" disabled={loading}>
                  Send a new verification link
                </button>
              </form>
            )}
          </>
        )}
        <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
      </div>
    </main>
  );
}

export default VerifyEmail;
