import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RegisterOfficer() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    employee_id: "",
    password: "",
    confirm_password: "",
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { registerOfficer } = useAuth();
  const navigate = useNavigate();

  const isGovEmail = formData.email && (formData.email.endsWith(".gov.in") || formData.email.endsWith(".nic.in"));
  const showEmailWarning = formData.email && formData.email.includes("@") && !isGovEmail;

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
      await registerOfficer(formData);
      navigate("/officer/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to register officer account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card" style={{ maxWidth: "600px" }}>
        <div className="auth-header">
          <div className="auth-emblem">GeM</div>
          <h2>Government Officer Registration</h2>
          <p className="auth-subtext">
            Official portal for GeM procurement officers and statutory compliance evaluators
          </p>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="full_name">Full Name *</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Dr. Rajesh Sharma"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Official Email Address *</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="officer@department.gov.in"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {showEmailWarning && (
            <div className="alert-box alert-warning" style={{ fontSize: "0.85rem", padding: "0.5rem 0.8rem", marginTop: "-0.5rem", marginBottom: "0.8rem" }}>
              Advisory: Official government domain (e.g. @gov.in or @nic.in) recommended for procurement officers.
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="department">Department / Ministry *</label>
              <input
                id="department"
                name="department"
                type="text"
                placeholder="e.g. Ministry of Defence"
                value={formData.department}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="designation">Designation *</label>
              <input
                id="designation"
                name="designation"
                type="text"
                placeholder="e.g. Director Procurement"
                value={formData.designation}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="phone">Phone / Official Extension</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="employee_id">Officer / Employee ID (Optional)</label>
              <input
                id="employee_id"
                name="employee_id"
                type="text"
                placeholder="e.g. GOV-PROC-8812"
                value={formData.employee_id}
                onChange={handleChange}
              />
            </div>
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
            {loading ? "Registering Officer Account..." : "Create Officer Account"}
          </button>
        </form>

        <div className="auth-footer-links">
          <p>
            Already registered?{" "}
            <Link to="/login" className="auth-link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
