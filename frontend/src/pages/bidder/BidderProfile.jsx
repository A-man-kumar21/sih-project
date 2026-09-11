import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function BidderProfile() {
  const { authFetch, user } = useAuth();

  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    bidder_id: "",
    pan: "",
    gstin: "",
    udyam_number: "",
    epfo_esic_number: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await authFetch("/api/bidder/profile");
        const data = await res.json();
        if (res.ok) {
          const prof = data.profile;
          setFormData({
            company_name: prof.company_name || "",
            contact_person: prof.contact_person || "",
            email: prof.email || "",
            phone: prof.phone || "",
            bidder_id: prof.bidder_id || "",
            pan: prof.statutory?.pan || "",
            gstin: prof.statutory?.gstin || "",
            udyam_number: prof.statutory?.udyam_number || "",
            epfo_esic_number: prof.statutory?.epfo_esic_number || "",
          });
        } else {
          throw new Error(data.error || "Failed to load profile.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await authFetch("/api/bidder/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: formData.company_name,
          contact_person: formData.contact_person,
          phone: formData.phone,
          pan: formData.pan,
          gstin: formData.gstin,
          udyam_number: formData.udyam_number,
          epfo_esic_number: formData.epfo_esic_number,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile.");
      setSuccess("Profile and statutory identifiers successfully synchronized with compliance engine.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading enterprise profile...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">Enterprise Identity & Statutory Registry</div>
          <h1>Enterprise Compliance Profile</h1>
          <p className="dashboard-subtitle">
            Manage your legal entity profile, primary contact details, and central statutory registration identifiers.
          </p>
        </div>
      </div>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="profile-card">
        <div className="form-section-title">
          <h3>General Enterprise Information</h3>
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            GeM Assigned Bidder Reference ID: <strong>{formData.bidder_id}</strong>
          </span>
        </div>

        <div className="form-grid-2" style={{ marginTop: "1rem" }}>
          <div className="form-group">
            <label>Enterprise Legal Name *</label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Authorized Contact Person *</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Business Email (Login Identifier)</label>
            <input
              type="email"
              value={formData.email}
              disabled
              style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed" }}
            />
          </div>

          <div className="form-group">
            <label>Primary Phone / Mobile *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "2rem 0 1.5rem" }} />

        <div className="form-section-title">
          <h3>Statutory Registry Identifiers</h3>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
            These identifiers are verified against official portals (Udyam, GSTN, Income Tax, EPFO/ESIC, DigiLocker).
          </p>
        </div>

        <div className="form-grid-2" style={{ marginTop: "1rem" }}>
          <div className="form-group">
            <label>Permanent Account Number (PAN)</label>
            <input
              type="text"
              placeholder="e.g. AABCA1234A"
              value={formData.pan}
              onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
          </div>

          <div className="form-group">
            <label>GST Identification Number (GSTIN)</label>
            <input
              type="text"
              placeholder="e.g. 07AABCA1234A1Z5"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Udyam / MSME Registration Number</label>
            <input
              type="text"
              placeholder="e.g. UDYAM-DL-05-0012345"
              value={formData.udyam_number}
              onChange={(e) => setFormData({ ...formData, udyam_number: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
          </div>

          <div className="form-group">
            <label>EPFO / ESIC Establishment Code</label>
            <input
              type="text"
              placeholder="e.g. DLCPM1234567000"
              value={formData.epfo_esic_number}
              onChange={(e) => setFormData({ ...formData, epfo_esic_number: e.target.value })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Synchronizing with Engine..." : "Save & Synchronize Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
