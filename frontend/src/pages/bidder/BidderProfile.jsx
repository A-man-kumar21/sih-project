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
            fontSize: "0.72rem",
            backgroundColor: "#fffbeb",
            color: "#b45309",
            padding: "0.15rem 0.5rem",
            borderRadius: "4px",
            fontWeight: 600,
            border: "1px solid #fde68a",
          }}
        >
          ⚠ Missing [Edit manually]
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
            fontSize: "0.72rem",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            padding: "0.15rem 0.5rem",
            borderRadius: "4px",
            fontWeight: 600,
            border: "1px solid #cbd5e1",
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
      : "PyMuPDF";
    const confVal = meta.confidence ? (meta.confidence > 1 ? meta.confidence : meta.confidence * 100) : null;
    const confStr = confVal ? `${confVal.toFixed(0)}% confidence` : "";
    const details = [methodStr, confStr].filter(Boolean).join(" · ");

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          fontSize: "0.72rem",
          backgroundColor: "#ecfdf5",
          color: "#065f46",
          padding: "0.15rem 0.5rem",
          borderRadius: "4px",
          fontWeight: 600,
          border: "1px solid #a7f3d0",
        }}
      >
        ✓ Extracted from {meta.source || "Certificate"}
        {details ? ` (${details})` : ""}
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
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">ENTERPRISE IDENTITY & STATUTORY REGISTRY</div>
          <h1>Enterprise Compliance Profile</h1>
          <p className="dashboard-subtitle">
            Manage your legal entity profile, business classifications, and central statutory registration identifiers.
          </p>
        </div>
        <div className="header-actions">
          <Link to="/bidder/documents" className="btn-secondary">
            Manage Document Vault &rarr;
          </Link>
        </div>
      </div>

      {/* Sync Banner */}
      <div
        className="alert-box alert-info"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
          gap: "0.6rem",
        }}
      >
        <div>
          <strong>⚡ Automatic Document Vault Synchronization:</strong> Attributes from certificates uploaded to your{" "}
          <Link to="/bidder/documents" style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
            Document Vault
          </Link>{" "}
          are deterministically extracted and pre-populated below. You may verify or manually edit any field.
        </div>
        <Link
          to="/bidder/documents"
          className="btn-secondary"
          style={{ whiteSpace: "nowrap", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
        >
          Manage Vault &rarr;
        </Link>
      </div>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-error">{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Section 1: Business Identity */}
        <div className="dashboard-section" style={{ margin: 0 }}>
          <div className="section-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Business Identity</h2>
              <p className="section-subtext">Legal establishment attributes and business classification.</p>
            </div>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              GeM Bidder ID: <strong style={{ color: "#0f172a" }}>{formData.bidder_id || "Registered"}</strong>
            </span>
          </div>

          <div className="form-grid-2" style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>Enterprise Legal Name *</label>
                {renderProvenanceBadge("enterprise_name")}
              </div>
              <input
                type="text"
                placeholder="e.g. Solaris GreenTech India Pvt. Ltd."
                value={formData.enterprise_name}
                onChange={(e) => setFormData({ ...formData, enterprise_name: e.target.value, company_name: e.target.value })}
                required
              />
              {renderConflictBadge("enterprise_name", "enterprise_name")}
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
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

          <div className="form-grid-2" style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>Enterprise Classification / Category</label>
                {renderProvenanceBadge("enterprise_type")}
              </div>
              <select
                value={
                  formData.enterprise_type === "Small Enterprise" ? "Small" :
                  formData.enterprise_type === "Micro Enterprise" ? "Micro" :
                  formData.enterprise_type === "Medium Enterprise" ? "Medium" :
                  formData.enterprise_type === "Large Enterprise" ? "Large" :
                  formData.enterprise_type
                }
                onChange={(e) => setFormData({ ...formData, enterprise_type: e.target.value })}
                style={{ padding: "0.65rem" }}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>Date of Incorporation / Registration</label>
                {renderProvenanceBadge("registration_date")}
              </div>
              <input
                type="text"
                placeholder="e.g. 10/02/2021 or YYYY-MM-DD"
                value={formData.registration_date}
                onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
              />
              {renderConflictBadge("registration_date", "registration_date")}
            </div>
          </div>
        </div>

        {/* Section 2: Government Registrations */}
        <div className="dashboard-section" style={{ margin: 0 }}>
          <div className="section-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Government Registrations</h2>
              <p className="section-subtext">Central statutory identifiers verified by government adapters.</p>
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>Permanent Account Number (PAN) *</label>
                {renderProvenanceBadge("pan")}
              </div>
              <input
                type="text"
                placeholder="e.g. AABCS1003C"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
                required
              />
              {renderConflictBadge("pan", "pan")}
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>GSTIN Registration Number *</label>
                {renderProvenanceBadge("gstin")}
              </div>
              <input
                type="text"
                placeholder="e.g. 24AABCS1003C1Z7"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
                required
              />
              {renderConflictBadge("gstin", "gstin")}
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>Udyam Registration Number</label>
                {renderProvenanceBadge("udyam_number")}
              </div>
              <input
                type="text"
                placeholder="e.g. UDYAM-GJ-00-0000003"
                value={formData.udyam_number}
                onChange={(e) => setFormData({ ...formData, udyam_number: e.target.value.toUpperCase() })}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              />
              {renderConflictBadge("udyam_number", "udyam_number")}
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>Corporate Identity Number (CIN)</label>
                {renderProvenanceBadge("cin")}
              </div>
              <input
                type="text"
                placeholder="e.g. U40106GJ2021PTC120003"
                value={formData.cin}
                onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              />
              {renderConflictBadge("cin", "cin")}
            </div>
          </div>
        </div>

        {/* Section 3: Statutory Registrations */}
        <div className="dashboard-section" style={{ margin: 0 }}>
          <div className="section-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Statutory Registrations</h2>
              <p className="section-subtext">Labor welfare and employer contribution compliance codes.</p>
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>EPFO Establishment Code</label>
                {renderProvenanceBadge("epfo_number")}
              </div>
              <input
                type="text"
                placeholder="e.g. GJAHD0012345000"
                value={formData.epfo_number}
                onChange={(e) => setFormData({ ...formData, epfo_number: e.target.value.toUpperCase() })}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              />
              {renderConflictBadge("epfo_number", "epfo_number")}
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <label style={{ margin: 0 }}>ESIC Employer Code</label>
                {renderProvenanceBadge("esic_number")}
              </div>
              <input
                type="text"
                placeholder="e.g. 38000123450000001"
                value={formData.esic_number}
                onChange={(e) => setFormData({ ...formData, esic_number: e.target.value.toUpperCase() })}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              />
              {renderConflictBadge("esic_number", "esic_number")}
            </div>
          </div>
        </div>

        {/* Section 4: Address */}
        <div className="dashboard-section" style={{ margin: 0 }}>
          <div className="section-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Registered Office Address</h2>
              <p className="section-subtext">Principal place of business as recorded on statutory certificates.</p>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.3rem" }}>
              <label style={{ margin: 0 }}>Principal / Registered Address</label>
              {renderProvenanceBadge("registered_address")}
            </div>
            <textarea
              rows={3}
              placeholder="e.g. 8 Renewable Energy Avenue, Ahmedabad, Gujarat - 380001"
              value={formData.registered_address}
              onChange={(e) => setFormData({ ...formData, registered_address: e.target.value })}
            />
            {renderConflictBadge("registered_address", "registered_address")}
          </div>
        </div>

        {/* Section 5: Contact & Communication */}
        <div className="dashboard-section" style={{ margin: 0 }}>
          <div className="section-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Authorized Contact & Communication</h2>
              <p className="section-subtext">Liaison information for procurement clarification queries.</p>
            </div>
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
              <label>Official Phone Number *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "1rem" }}>
            <label>Business Email (Login Identifier)</label>
            <input
              type="email"
              value={formData.email}
              disabled
              style={{ backgroundColor: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginBottom: "2rem" }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Synchronizing with Engine..." : "Save & Synchronize Enterprise Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
