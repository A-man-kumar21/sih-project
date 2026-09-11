import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const AVAILABLE_CHECKS = [
  { key: "udyam", label: "Udyam / MSME Registration", desc: "Verifies enterprise classification and MSME certificate validity" },
  { key: "gstn", label: "GSTN Registration & Filings", desc: "Checks active GST status, return filing regularities, and tax compliance" },
  { key: "pan_it", label: "PAN & Income Tax Compliance", desc: "Validates Permanent Account Number legal entity matching and ITR filing" },
  { key: "epfo_esic", label: "EPFO & ESIC Labor Compliance", desc: "Validates employer contribution regularity under statutory labor laws" },
  { key: "digilocker", label: "DigiLocker Verified Proof", desc: "Confirms cryptographic issuer authenticity of identity credentials" },
  { key: "blacklist", label: "Central Debarment / Blacklist", desc: "Queries national debarment registry to prevent blacklisted entities" },
];

export default function CreateTenderModal({ isOpen, onClose, onCreated }) {
  const { authFetch } = useAuth();
  const [formData, setFormData] = useState({
    tender_id: "",
    title: "",
    category: "Goods",
    description: "",
    deadline: "",
    mandatory_checks: ["udyam", "gstn", "pan_it"],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const toggleCheck = (checkKey) => {
    setFormData((prev) => {
      const current = prev.mandatory_checks;
      if (current.includes(checkKey)) {
        if (current.length === 1) return prev; // At least one check required
        return { ...prev, mandatory_checks: current.filter((k) => k !== checkKey) };
      } else {
        return { ...prev, mandatory_checks: [...current, checkKey] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authFetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to create tender.");
      }
      onCreated(data.tender);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: "680px" }}>
        <div className="modal-header">
          <h3>Create New Procurement Tender</h3>
          <button onClick={onClose} className="btn-close">&times;</button>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Tender Reference ID *</label>
              <input
                type="text"
                placeholder="e.g. GEM/2026/B/990001"
                value={formData.tender_id}
                onChange={(e) => setFormData({ ...formData, tender_id: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Goods">Goods</option>
                <option value="Services">Services</option>
                <option value="Works & Infrastructure">Works & Infrastructure</option>
                <option value="Medical Devices">Medical Devices</option>
                <option value="IT & Telecom">IT & Telecom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Tender Title *</label>
            <input
              type="text"
              placeholder="e.g. Supply of High-Security Cyber Defense Hardware"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description & Scope of Work</label>
            <textarea
              rows="3"
              placeholder="Detailed procurement requirements and technical scope..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Submission Deadline</label>
            <input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          {/* Dynamic Mandatory Compliance Checklist */}
          <div className="form-group">
            <label style={{ fontWeight: 700, color: "#1a365d" }}>
              Mandatory Statutory Compliance Checks *
            </label>
            <p style={{ fontSize: "0.82rem", color: "#5d6e86", marginTop: "0.2rem", marginBottom: "0.6rem" }}>
              Selected checks will be mandatory for bidding. Bidders must have these certificates in their vault to apply.
            </p>
            <div className="checks-selection-grid">
              {AVAILABLE_CHECKS.map((chk) => {
                const isChecked = formData.mandatory_checks.includes(chk.key);
                return (
                  <div
                    key={chk.key}
                    onClick={() => toggleCheck(chk.key)}
                    className={`check-toggle-card ${isChecked ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ cursor: "pointer" }}
                    />
                    <div>
                      <div className="check-title">{chk.label}</div>
                      <div className="check-desc">{chk.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Publishing Tender..." : "Publish Tender"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
