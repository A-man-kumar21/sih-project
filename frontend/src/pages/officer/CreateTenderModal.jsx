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

  // Compute current workflow step (01 Upload, 02 Extract, 03 Review, 04 Publish)
  let currentStep = 1;
  if (extracting) currentStep = 2;
  else if (extractSuccess || formData.tender_id) currentStep = 3;
  if (loading) currentStep = 4;

  const handleExtractPdf = async () => {
    if (!tenderFile) {
      setExtractError("Please select a tender PDF notice to extract.");
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
        if (current.length === 1) return prev;
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
      <div className="modal-card" style={{ maxWidth: "760px", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ color: "#2563eb" }}>GOVTECH PROCUREMENT PIPELINE</div>
            <h3 style={{ margin: "0.2rem 0 0" }}>Create New Procurement Tender</h3>
          </div>
          <button onClick={onClose} className="btn-close" aria-label="Close modal">&times;</button>
        </div>

        {/* 4-Step Workflow Visual Indicator */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", padding: "0.75rem 1rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: currentStep >= 1 ? "#1e3a8a" : "#94a3b8", fontWeight: currentStep === 1 ? 800 : 600, fontSize: "0.82rem" }}>
            <span style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: currentStep >= 1 ? "#1e3a8a" : "#e2e8f0", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>1</span>
            <span>Upload PDF</span>
          </div>
          <span style={{ color: "#cbd5e1" }}>&rarr;</span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: currentStep >= 2 ? "#1e3a8a" : "#94a3b8", fontWeight: currentStep === 2 ? 800 : 600, fontSize: "0.82rem" }}>
            <span style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: currentStep >= 2 ? "#1e3a8a" : "#e2e8f0", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>2</span>
            <span>Auto-Extract</span>
          </div>
          <span style={{ color: "#cbd5e1" }}>&rarr;</span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: currentStep >= 3 ? "#1e3a8a" : "#94a3b8", fontWeight: currentStep === 3 ? 800 : 600, fontSize: "0.82rem" }}>
            <span style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: currentStep >= 3 ? "#1e3a8a" : "#e2e8f0", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>3</span>
            <span>Review & Edit</span>
          </div>
          <span style={{ color: "#cbd5e1" }}>&rarr;</span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: currentStep >= 4 ? "#1e3a8a" : "#94a3b8", fontWeight: currentStep === 4 ? 800 : 600, fontSize: "0.82rem" }}>
            <span style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: currentStep >= 4 ? "#1e3a8a" : "#e2e8f0", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>4</span>
            <span>Publish Tender</span>
          </div>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        {/* 01 & 02: Upload & Extract Section */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #bfdbfe",
            borderRadius: "10px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
            boxShadow: "0 1px 3px rgba(37, 99, 235, 0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h4 style={{ margin: 0, color: "#1e3a8a", fontSize: "1rem", fontWeight: 700 }}>
              01 & 02 · Auto-Populate from Tender Notice PDF
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
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 0.85rem" }}>
            Select an official procurement tender notice PDF to parse reference IDs, category, title, deadlines, and statutory checks automatically.
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
                  fontSize: "0.84rem",
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
              style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
            >
              {extracting ? "Extracting Parameters..." : "Extract Tender Notice &rarr;"}
            </button>
          </div>

          {extractSuccess && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.85rem",
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
                padding: "0.6rem 0.85rem",
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

        {/* 03 & 04: Review, Edit & Publish Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "0.4rem" }}>
            <h4 style={{ margin: 0, color: "#0f172a", fontSize: "0.95rem" }}>03 · Review & Edit Tender Parameters</h4>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>
                Tender Reference ID *
                {extractedMissing.tender_id && (
                  <span style={{ fontSize: "0.72rem", color: "#b45309", marginLeft: "0.4rem", fontWeight: 600 }}>
                    (Please enter manually)
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. GEM/2026/B/990001"
                value={formData.tender_id}
                onChange={(e) => setFormData({ ...formData, tender_id: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Procurement Category *</label>
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
                <span style={{ fontSize: "0.72rem", color: "#b45309", marginLeft: "0.4rem", fontWeight: 600 }}>
                  (Please enter manually)
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder="e.g. Supply and Commissioning of Solar Photovoltaic Panels"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description & Scope of Work *</label>
            <textarea
              rows={3}
              placeholder="Detailed technical specifications and delivery milestones..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Bid Submission Deadline *
              {extractedMissing.deadline && (
                <span style={{ fontSize: "0.72rem", color: "#b45309", marginLeft: "0.4rem", fontWeight: 600 }}>
                  (Please specify deadline)
                </span>
              )}
            </label>
            <input
              type="date"
              value={formData.deadline ? formData.deadline.split("T")[0] : ""}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              required
            />
          </div>

          {/* Mandatory Checks Section */}
          <div className="form-group">
            <label style={{ marginBottom: "0.4rem" }}>
              Mandatory Statutory Compliance Checks *
              <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 400, marginLeft: "0.4rem" }}>
                (Bidders must possess verified documents for selected checks to achieve 100% score)
              </span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.6rem" }}>
              {AVAILABLE_CHECKS.map((chk) => {
                const isChecked = formData.mandatory_checks.includes(chk.key);
                return (
                  <div
                    key={chk.key}
                    onClick={() => toggleCheck(chk.key)}
                    style={{
                      padding: "0.65rem 0.85rem",
                      borderRadius: "8px",
                      border: isChecked ? "1px solid #2563eb" : "1px solid #e2e8f0",
                      backgroundColor: isChecked ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      gap: "0.6rem",
                      alignItems: "flex-start",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ marginTop: "0.2rem" }}
                    />
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isChecked ? "#1e3a8a" : "#0f172a" }}>
                        {chk.label}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem" }}>
                        {chk.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1.25rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Publishing Tender..." : "04 · Publish Procurement Tender"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
