import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RegisterBidder() {
  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { registerBidder } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirm_password) {
      setError("Password confirmation does not match password.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await registerBidder(formData);
      navigate("/bidder/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to register enterprise bidder account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card" style={{ maxWidth: "600px" }}>
        <div className="auth-header">
          <div className="auth-emblem">GeM</div>
          <h2>Enterprise Bidder Registration</h2>
          <p className="auth-subtext">
            Register your enterprise to participate in GeM public procurement tenders
          </p>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <div className="alert-box alert-info" style={{ fontSize: "0.85rem", padding: "0.6rem 0.8rem", marginBottom: "1rem" }}>
          Notice: Statutory certificates (PAN, GSTIN, Udyam, EPFO/ESIC) are not required right now and can be uploaded anytime into your reusable Document Vault.
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="company_name">Company / Enterprise Legal Name *</label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              placeholder="e.g. Aarohan Office Systems Private Limited"
              value={formData.company_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="contact_person">Authorized Contact Person *</label>
              <input
                id="contact_person"
                name="contact_person"
                type="text"
                placeholder="e.g. Amit Kumar"
                value={formData.contact_person}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone / Mobile Number *</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Official Business Email *</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="e.g. contact@aarohan.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Confirm Password *</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Re-enter password"
                value={formData.confirm_password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
            {loading ? "Registering Enterprise..." : "Create Bidder Account"}
          </button>
        </form>

        <div className="auth-footer-links">
          <p>
            Already have an enterprise account?{" "}
            <Link to="/login" className="auth-link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
