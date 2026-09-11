import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function BidderProfile() {
  const { authFetch } = useAuth();

  const [formData, setFormData] = useState({
    company_name: "",
    enterprise_name: "",
    contact_person: "",
    email: "",
    phone: "",
    bidder_id: "",
    pan: "",
    gstin: "",
    udyam_number: "",
    cin: "",
    epfo_number: "",
    esic_number: "",
    epfo_esic_number: "",
    business_constitution: "",
    registered_address: "",
    registration_date: "",
    enterprise_type: "",
  });

  const [provenance, setProvenance] = useState({});
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
          const ep = prof.enterprise_profile || {};
          setProvenance(ep);

          setFormData({
            company_name: ep.enterprise_name?.value || prof.company_name || "",
            enterprise_name: ep.enterprise_name?.value || prof.company_name || "",
            contact_person: prof.contact_person || "",
            email: prof.email || "",
            phone: prof.phone || "",
            bidder_id: prof.bidder_id || "",
            pan: ep.pan?.value || prof.statutory?.pan || "",
            gstin: ep.gstin?.value || prof.statutory?.gstin || "",
            udyam_number: ep.udyam_number?.value || prof.statutory?.udyam_number || "",
            cin: ep.cin?.value || prof.statutory?.cin || "",
            epfo_number: ep.epfo_number?.value || prof.statutory?.epfo_number || "",
            esic_number: ep.esic_number?.value || prof.statutory?.esic_number || "",
            epfo_esic_number: ep.epfo_esic_number?.value || prof.statutory?.epfo_esic_number || "",
            business_constitution: ep.business_constitution?.value || "",
            registered_address: ep.registered_address?.value || "",
            registration_date: ep.registration_date?.value || "",
            enterprise_type: ep.enterprise_type?.value || "",
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
          company_name: formData.enterprise_name || formData.company_name,
          enterprise_name: formData.enterprise_name || formData.company_name,
          contact_person: formData.contact_person,
          phone: formData.phone,
          pan: formData.pan,
          gstin: formData.gstin,
          udyam_number: formData.udyam_number,
          cin: formData.cin,
          epfo_number: formData.epfo_number,
          esic_number: formData.esic_number,
          epfo_esic_number: formData.epfo_esic_number || formData.epfo_number,
          business_constitution: formData.business_constitution,
          registered_address: formData.registered_address,
          registration_date: formData.registration_date,
          enterprise_type: formData.enterprise_type,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile.");
      if (data.profile?.enterprise_profile) {
        setProvenance(data.profile.enterprise_profile);
      }
      setSuccess("Enterprise profile and statutory identifiers successfully synchronized with compliance engine.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderProvenanceBadge = (fieldKey) => {
    const meta = provenance[fieldKey];
    if (!meta || !meta.value) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            backgroundColor: "#fffbeb",
            color: "#b45309",
            padding: "0.15rem 0.5rem",
            borderRadius: "4px",
            fontWeight: 500,
            border: "1px solid #fde68a",
          }}
        >
          ⚠ Could not extract [Edit manually]
        </span>
      );
    }

    if (meta.source === "Manual Entry" || meta.extraction_status === "manual") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            fontSize: "0.75rem",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            padding: "0.15rem 0.5rem",
            borderRadius: "4px",
            fontWeight: 500,
          }}
        >
          ✎ Manually Entered
        </span>
      );
    }

    const methodStr = meta.extraction_method
      ? meta.extraction_method.toLowerCase().includes("ocr")
        ? "PaddleOCR"
        : "PyMuPDF"
      : "";
    const confVal = meta.confidence ? (meta.confidence > 1 ? meta.confidence : meta.confidence * 100) : null;
    const confStr = confVal ? `${confVal.toFixed(0)}% conf` : "";
    const details = [methodStr, confStr].filter(Boolean).join(", ");

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          fontSize: "0.75rem",
          backgroundColor: "#ecfdf5",
          color: "#065f46",
          padding: "0.15rem 0.5rem",
          borderRadius: "4px",
          fontWeight: 500,
          border: "1px solid #a7f3d0",
        }}
      >
        ✓ Auto-extracted from {meta.source || "Document"}
        {details ? ` (${details})` : ""}
        {meta.source_doc_name ? ` • ${meta.source_doc_name}` : ""}
      </span>
    );
  };

  const renderConflictBadge = (fieldKey, formProp) => {
    const meta = provenance[fieldKey];
    if (!meta || !meta.conflict || !meta.conflict.conflicting_value) return null;

    const conflictVal = meta.conflict.conflicting_value;
    const conflictSrc = meta.conflict.conflicting_source || "Another Document";
    const conflictDoc = meta.conflict.conflicting_doc_name ? ` (${meta.conflict.conflicting_doc_name})` : "";

    return (
      <div
        style={{
          marginTop: "0.35rem",
          padding: "0.4rem 0.65rem",
          backgroundColor: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.8rem",
          color: "#92400e",
        }}
      >
        <span>
          ⚠ <strong>Conflicting Data:</strong> Extracted <strong>"{conflictVal}"</strong> from {conflictSrc}{conflictDoc}.
        </span>
        <button
          type="button"
          onClick={() => {
            setFormData((prev) => {
              const updated = { ...prev, [formProp || fieldKey]: conflictVal };
              if (fieldKey === "enterprise_name") {
                updated.company_name = conflictVal;
              }
              return updated;
            });
          }}
          className="btn-secondary"
          style={{
            fontSize: "0.75rem",
            padding: "0.2rem 0.55rem",
            whiteSpace: "nowrap",
            backgroundColor: "#fef3c7",
            border: "1px solid #d97706",
            color: "#92400e",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Use "{conflictVal}"
        </button>
      </div>
    );
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
            Manage your legal entity profile, business classifications, and central statutory registration identifiers.
          </p>
        </div>
      </div>

      {/* Document Vault Auto-Extraction Banner */}
      <div
        className="alert-box alert-info"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <strong>⚡ Automatic Document Vault Extraction:</strong> Information from certificates uploaded to your{" "}
          <Link to="/bidder/vault" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "underline" }}>
            Document Vault
          </Link>{" "}
          is automatically extracted and populated below. You can also manually review or update any field.
        </div>
        <Link
          to="/bidder/vault"
          className="btn-secondary"
          style={{ whiteSpace: "nowrap", marginLeft: "1rem", fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
        >
          Open Document Vault →
        </Link>
      </div>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="profile-card">
        {/* Section 1: Enterprise Legal Identity */}
        <div className="form-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>Enterprise Legal Identity</h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.2rem 0 0" }}>
              Core legal establishment attributes extracted from statutory registration certificates.
            </p>
          </div>
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            GeM Assigned Bidder Reference ID: <strong>{formData.bidder_id}</strong>
          </span>
        </div>

        <div className="form-grid-2" style={{ marginTop: "1rem" }}>
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Enterprise Legal Name *</label>
              {renderProvenanceBadge("enterprise_name")}
            </div>
            <input
              type="text"
              placeholder="e.g. Bharat Supplies and Services LLP"
              value={formData.enterprise_name}
              onChange={(e) => setFormData({ ...formData, enterprise_name: e.target.value, company_name: e.target.value })}
              required
            />
            {renderConflictBadge("enterprise_name", "enterprise_name")}
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Constitution of Business</label>
              {renderProvenanceBadge("business_constitution")}
            </div>
            <input
              type="text"
              placeholder="e.g. Private Limited Company / LLP / Proprietorship"
              value={formData.business_constitution}
              onChange={(e) => setFormData({ ...formData, business_constitution: e.target.value })}
            />
            {renderConflictBadge("business_constitution", "business_constitution")}
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Enterprise Classification / Category</label>
              {renderProvenanceBadge("enterprise_type")}
            </div>
            <select
              value={formData.enterprise_type}
              onChange={(e) => setFormData({ ...formData, enterprise_type: e.target.value })}
              style={{ padding: "0.6rem" }}
            >
              <option value="">-- Select or Auto-Extracted from Udyam --</option>
              <option value="Micro">Micro Enterprise</option>
              <option value="Small">Small Enterprise</option>
              <option value="Medium">Medium Enterprise</option>
              <option value="Large">Large / Non-MSME Enterprise</option>
            </select>
            {renderConflictBadge("enterprise_type", "enterprise_type")}
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Date of Registration / Incorporation</label>
              {renderProvenanceBadge("registration_date")}
            </div>
            <input
              type="text"
              placeholder="e.g. 01/07/2018 or YYYY-MM-DD"
              value={formData.registration_date}
              onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
            />
            {renderConflictBadge("registration_date", "registration_date")}
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <label style={{ margin: 0 }}>Registered Address / Principal Place of Business</label>
            {renderProvenanceBadge("registered_address")}
          </div>
          <input
            type="text"
            placeholder="e.g. Plot No. 12, Okhla Industrial Area Phase-III, New Delhi, 110020"
            value={formData.registered_address}
            onChange={(e) => setFormData({ ...formData, registered_address: e.target.value })}
          />
          {renderConflictBadge("registered_address", "registered_address")}
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "2rem 0 1.5rem" }} />

        {/* Section 2: Statutory Registry Identifiers */}
        <div className="form-section-title">
          <h3 style={{ margin: 0 }}>Central Statutory Registry Identifiers</h3>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.2rem 0 0" }}>
            These identifiers feed directly into official compliance adapters (GSTN, Udyam, Income Tax, EPFO/ESIC).
          </p>
        </div>

        <div className="form-grid-2" style={{ marginTop: "1rem" }}>
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Permanent Account Number (PAN) *</label>
              {renderProvenanceBadge("pan")}
            </div>
            <input
              type="text"
              placeholder="e.g. AABCA1234A"
              value={formData.pan}
              onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              required
            />
            {renderConflictBadge("pan", "pan")}
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>GST Identification Number (GSTIN) *</label>
              {renderProvenanceBadge("gstin")}
            </div>
            <input
              type="text"
              placeholder="e.g. 07AABCA1234A1Z5"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              required
            />
            {renderConflictBadge("gstin", "gstin")}
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Udyam / MSME Registration Number</label>
              {renderProvenanceBadge("udyam_number")}
            </div>
            <input
              type="text"
              placeholder="e.g. UDYAM-DL-05-0012345"
              value={formData.udyam_number}
              onChange={(e) => setFormData({ ...formData, udyam_number: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
            {renderConflictBadge("udyam_number", "udyam_number")}
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Corporate Identification Number (CIN)</label>
              {renderProvenanceBadge("cin")}
            </div>
            <input
              type="text"
              placeholder="e.g. U72900MH2021PTC123456"
              value={formData.cin}
              onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
            {renderConflictBadge("cin", "cin")}
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>EPFO Establishment Code</label>
              {renderProvenanceBadge("epfo_number")}
            </div>
            <input
              type="text"
              placeholder="e.g. MH/BAN/0012345/000"
              value={formData.epfo_number}
              onChange={(e) => setFormData({ ...formData, epfo_number: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
            {renderConflictBadge("epfo_number", "epfo_number")}
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>ESIC Employer Code</label>
              {renderProvenanceBadge("esic_number")}
            </div>
            <input
              type="text"
              placeholder="e.g. 31000123450000101"
              value={formData.esic_number}
              onChange={(e) => setFormData({ ...formData, esic_number: e.target.value.toUpperCase() })}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
            {renderConflictBadge("esic_number", "esic_number")}
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "2rem 0 1.5rem" }} />

        {/* Section 3: Contact & Communication */}
        <div className="form-section-title">
          <h3 style={{ margin: 0 }}>Authorized Contact & Communication</h3>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.2rem 0 0" }}>
            Primary liaison details for procurement queries and officer clarification notices.
          </p>
        </div>

        <div className="form-grid-2" style={{ marginTop: "1rem" }}>
          <div className="form-group">
            <label>Authorized Contact Person *</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              required
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

        <div className="form-group">
          <label>Business Email (Login & Audit Identifier)</label>
          <input
            type="email"
            value={formData.email}
            disabled
            style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Synchronizing with Engine..." : "Save & Synchronize Enterprise Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
