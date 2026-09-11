import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      // Role-based redirection
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === "officer") {
        navigate("/officer/dashboard", { replace: true });
      } else {
        navigate("/bidder/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-emblem">BidSetu</div>
          <h2>Sign In to BidSetu</h2>
          <p className="auth-subtext">
            AI-Powered Bid Compliance Verification & Governance System
          </p>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="e.g. officer@gem.gov.in or contact@enterprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="auth-footer-links">
          <p>
            Need a Government Officer account?{" "}
            <Link to="/register/officer" className="auth-link">
              Register as Officer
            </Link>
          </p>
          <p>
            Participating enterprise bidder?{" "}
            <Link to="/register/bidder" className="auth-link">
              Register as Bidder
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
