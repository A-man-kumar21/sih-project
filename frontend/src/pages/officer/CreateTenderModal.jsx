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

  // PDF Extraction State
  const [tenderFile, setTenderFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(null);
  const [extractError, setExtractError] = useState(null);
  const [extractedMissing, setExtractedMissing] = useState({});

  if (!isOpen) return null;

  const handleExtractPdf = async () => {
    if (!tenderFile) {
      setExtractError("Please choose a tender PDF file to extract.");
      return;
    }
    setExtracting(true);
    setExtractError(null);
    setExtractSuccess(null);
    setExtractedMissing({});

    try {
      const uploadData = new FormData();
      uploadData.append("file", tenderFile);

      const res = await authFetch("/api/extract/tender-pdf", {
        method: "POST",
        body: uploadData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || "Failed to extract tender parameters from PDF.");
      }

      const f = data.fields || data.extracted || {};
      const method = (data.extractionMethod || data.source || "pymupdf").toLowerCase().includes("ocr") ? "PaddleOCR" : "PyMuPDF";
      const conf = data.confidence ? `${data.confidence > 1 ? data.confidence.toFixed(0) : (data.confidence * 100).toFixed(0)}%` : "";

      const missing = {};
      const newTenderId = f.tenderReferenceId || f.tender_id || "";
      if (!newTenderId) missing.tender_id = true;

      const newTitle = f.title || "";
      if (!newTitle) missing.title = true;

      const newCategory = f.category || "Goods";
      const newDesc = f.description || "";
      const newDeadline = f.submissionDeadline || f.deadline || "";
      if (!newDeadline) missing.deadline = true;

      const newChecks = Array.isArray(f.mandatoryChecks) && f.mandatoryChecks.length > 0
        ? f.mandatoryChecks
        : Array.isArray(f.mandatory_checks) && f.mandatory_checks.length > 0
        ? f.mandatory_checks
        : [];

      setFormData((prev) => ({
        ...prev,
        tender_id: newTenderId || prev.tender_id,
        title: newTitle || prev.title,
        category: newCategory,
        description: newDesc || prev.description,
        deadline: newDeadline || prev.deadline,
        mandatory_checks: newChecks.length > 0 ? newChecks : prev.mandatory_checks,
      }));

      setExtractedMissing(missing);
      setExtractSuccess({
        message: `Tender parameters extracted successfully using local ${method} (${conf} confidence). Review and edit all fields below before publishing.`,
        method,
        confidence: conf,
      });
    } catch (err) {
      setExtractError(err.message || "Could not auto-extract from PDF. You can fill the fields manually.");
    } finally {
      setExtracting(false);
    }
  };

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
      <div className="modal-card" style={{ maxWidth: "720px", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3>Create New Procurement Tender</h3>
          <button onClick={onClose} className="btn-close">&times;</button>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        {/* Feature 1: Create Tender from PDF Section */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h4 style={{ margin: 0, color: "#1a365d", fontSize: "1rem", fontWeight: 700 }}>
              Create Tender from PDF
            </h4>
            <span
              style={{
                fontSize: "0.72rem",
                backgroundColor: "#ecfdf5",
                color: "#065f46",
                padding: "0.15rem 0.5rem",
                borderRadius: "4px",
                border: "1px solid #a7f3d0",
                fontWeight: 600,
              }}
            >
              100% Local PyMuPDF / PaddleOCR
            </span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 0.8rem" }}>
            Upload Tender PDF notice to auto-populate form fields deterministically. Review and edit extracted values before confirming.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px" }}>
              <input
                id="tender-pdf-file-input"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  setTenderFile(e.target.files[0] || null);
                  setExtractError(null);
                  setExtractSuccess(null);
                }}
                style={{
                  fontSize: "0.82rem",
                  padding: "0.4rem",
                  backgroundColor: "white",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  width: "100%",
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleExtractPdf}
              disabled={extracting || !tenderFile}
              className="btn-primary"
              style={{ padding: "0.45rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
            >
              {extracting ? "Extracting Tender Information..." : "Extract Tender Information"}
            </button>
          </div>

          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.4rem" }}>
            Supported format: <strong>PDF</strong>
          </div>

          {extractSuccess && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: "6px",
                fontSize: "0.82rem",
                color: "#065f46",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>✓</span>
              <span>{extractSuccess.message}</span>
            </div>
          )}

          {extractError && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "6px",
                fontSize: "0.82rem",
                color: "#92400e",
              }}
            >
              ⚠ {extractError}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>
                Tender Reference ID *
                {extractedMissing.tender_id && (
                  <span style={{ fontSize: "0.75rem", color: "#b45309", marginLeft: "0.4rem", fontWeight: 500 }}>
                    (Could not extract — Enter manually)
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder={extractedMissing.tender_id ? "Could not extract — Enter manually (e.g. GEM/2026/B/990001)" : "e.g. GEM/2026/B/990001"}
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
            <label>
              Tender Title *
              {extractedMissing.title && (
                <span style={{ fontSize: "0.75rem", color: "#b45309", marginLeft: "0.4rem", fontWeight: 500 }}>
                  (Could not extract — Enter manually)
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder={extractedMissing.title ? "Could not extract — Enter manually" : "e.g. Supply of High-Security Cyber Defense Hardware"}
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
            <label>
              Submission Deadline
              {extractedMissing.deadline && (
                <span style={{ fontSize: "0.75rem", color: "#b45309", marginLeft: "0.4rem", fontWeight: 500 }}>
                  (Could not extract — Enter manually)
                </span>
              )}
            </label>
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
