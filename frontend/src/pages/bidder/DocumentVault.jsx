import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const DOCUMENT_TYPES = [
  { value: "pan_card", label: "Permanent Account Number (PAN) Card", check: "pan_it", category: "identity" },
  { value: "gstin_cert", label: "GST Registration Certificate", check: "gstn", category: "statutory" },
  { value: "udyam_cert", label: "Udyam / MSME Certificate", check: "udyam", category: "statutory" },
  { value: "epfo_esic_cert", label: "EPFO & ESIC Labor Compliance Proof", check: "epfo_esic", category: "labor" },
  { value: "digilocker_proof", label: "DigiLocker Verified Credential", check: "digilocker", category: "identity" },
  { value: "other_statutory", label: "Other Statutory / Technical Document", check: "other", category: "other" },
];

export default function DocumentVault() {
  const { authFetch } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Category Filter State
  const [activeCategory, setActiveCategory] = useState("all");
  const [showUploadCard, setShowUploadCard] = useState(false);

  // Upload Form state
  const [selectedType, setSelectedType] = useState("pan_card");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/bidder/documents");
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      } else {
        throw new Error(data.error || "Failed to load document vault.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a PDF or image file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setExtractedInfo(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("document_type", selectedType);

      const res = await authFetch("/api/bidder/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || `Upload failed with HTTP status ${res.status}.`);
      }

      setSuccess(data.message || "Document uploaded successfully to your vault.");
      if (data.document?.extracted_data) {
        const extData = data.document.extracted_data;
        setExtractedInfo({
          ...(extData.fields || extData.extracted || extData),
          _method: extData.extractionMethod || extData.extraction_method || "pymupdf",
          _confidence: extData.confidence,
        });
      }
      setSelectedFile(null);
      const fileInput = document.getElementById("vault-file-input");
      if (fileInput) fileInput.value = "";

      await loadDocuments();
    } catch (err) {
      setError(err.message || "An unexpected error occurred during document upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc) => {
    try {
      const res = await authFetch(`/api/documents/${doc.id}/view`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to view document.");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await authFetch(`/api/documents/${doc.id}/download`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to download document.");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = doc.original_name || doc.file_name || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (docId, docLabel) => {
    if (!window.confirm(`Remove ${docLabel} from your vault?`)) return;
    try {
      const res = await authFetch(`/api/bidder/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccess(`${docLabel} removed from vault.`);
        await loadDocuments();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Helper to map document to category
  const getDocCategory = (doc) => {
    const t = doc.document_type || "";
    if (t.includes("pan") || t.includes("digilocker")) return "identity";
    if (t.includes("gst") || t.includes("udyam")) return "statutory";
    if (t.includes("epfo") || t.includes("esic")) return "labor";
    return "other";
  };

  const otherDocs = documents.filter((d) => d.document_type === "other" || d.document_type === "other_statutory");

  const filteredDocs = activeCategory === "all"
    ? documents
    : documents.filter((d) => getDocCategory(d) === activeCategory);

  return (
    <div className="dashboard-container">
      {/* Document Vault Header */}
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">DOCUMENT VAULT</div>
          <h1>Your compliance documents, securely organized.</h1>
          <p className="dashboard-subtitle">
            Upload enterprise certificates once. They are verified locally and reused across all tender bids without re-uploading.
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowUploadCard(!showUploadCard)}
            className="btn-primary"
          >
            {showUploadCard ? "✕ Hide Upload" : "+ Add Document"}
          </button>
          <Link to="/bidder/profile" className="btn-secondary">
            Enterprise Profile &rarr;
          </Link>
        </div>
      </div>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-error">{error}</div>}

      {/* Extracted Data Synchronization Banner */}
      {extractedInfo && (
        <div className="alert-box alert-info" style={{ borderLeft: "4px solid #059669" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong style={{ color: "#065f46", fontSize: "0.95rem" }}>
                  ✓ Local Deterministic Extraction & Profile Auto-Population
                </strong>
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
                  {extractedInfo._method?.toLowerCase().includes("ocr") ? "PaddleOCR" : "PyMuPDF"}
                  {extractedInfo._confidence != null
                    ? ` (${extractedInfo._confidence > 1 ? extractedInfo._confidence.toFixed(0) : (extractedInfo._confidence * 100).toFixed(0)}% conf)`
                    : ""}
                </span>
              </div>
              <p style={{ margin: "0.2rem 0 0.5rem", fontSize: "0.85rem", color: "#334155" }}>
                Certificate parsed locally with zero external LLM dependencies. Synchronized attributes:
              </p>
            </div>
            <Link
              to="/bidder/profile"
              className="btn-primary"
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", whiteSpace: "nowrap" }}
            >
              View Enterprise Profile &rarr;
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", marginTop: "0.4rem", fontSize: "0.85rem", background: "white", padding: "0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            {(extractedInfo.enterprise_name || extractedInfo.company_name) && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>Enterprise Legal Name</span>
                <strong>{extractedInfo.enterprise_name || extractedInfo.company_name}</strong>
              </div>
            )}
            {extractedInfo.pan && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>PAN</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.pan}</strong>
              </div>
            )}
            {extractedInfo.gstin && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>GSTIN</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.gstin}</strong>
              </div>
            )}
            {(extractedInfo.udyam_number || extractedInfo.udyam) && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>Udyam MSME</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.udyam_number || extractedInfo.udyam}</strong>
              </div>
            )}
            {extractedInfo.cin && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>CIN</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.cin}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Document Box (Collapsible / Focused) */}
      {(showUploadCard || documents.length === 0) && (
        <div className="dashboard-section" id="vault-upload-section" style={{ border: "1px solid #93c5fd", backgroundColor: "#f8fafc" }}>
          <div className="section-header">
            <div>
              <h3 style={{ margin: 0 }}>Add New Statutory Certificate</h3>
              <p className="section-subtext">
                Upload your PDF or image certificate. Deterministic OCR locally extracts registration numbers and verifies issuer format.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="vault-upload-card" style={{ boxShadow: "none", border: "1px solid #e2e8f0" }}>
            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="doc-type-select">Document Classification *</label>
                <select
                  id="doc-type-select"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ padding: "0.65rem" }}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="vault-file-input">Select Document (PDF, PNG, JPG) *</label>
                <input
                  id="vault-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  required
                  style={{ padding: "0.45rem" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", gap: "0.6rem" }}>
              {documents.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUploadCard(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="btn-primary" disabled={uploading}>
                {uploading ? "Extracting & Uploading..." : "Upload to Vault"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Filter Pills Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`btn-secondary ${activeCategory === "all" ? "active-filter-btn" : ""}`}
          style={{
            fontSize: "0.82rem",
            padding: "0.4rem 0.85rem",
            borderRadius: "20px",
            backgroundColor: activeCategory === "all" ? "#1e3a8a" : "#ffffff",
            color: activeCategory === "all" ? "#ffffff" : "#475569",
            borderColor: activeCategory === "all" ? "#1e3a8a" : "#cbd5e1",
          }}
        >
          All Documents ({documents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("identity")}
          className={`btn-secondary ${activeCategory === "identity" ? "active-filter-btn" : ""}`}
          style={{
            fontSize: "0.82rem",
            padding: "0.4rem 0.85rem",
            borderRadius: "20px",
            backgroundColor: activeCategory === "identity" ? "#1e3a8a" : "#ffffff",
            color: activeCategory === "identity" ? "#ffffff" : "#475569",
            borderColor: activeCategory === "identity" ? "#1e3a8a" : "#cbd5e1",
          }}
        >
          Identity & PAN ({documents.filter((d) => getDocCategory(d) === "identity").length})
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("statutory")}
          className={`btn-secondary ${activeCategory === "statutory" ? "active-filter-btn" : ""}`}
          style={{
            fontSize: "0.82rem",
            padding: "0.4rem 0.85rem",
            borderRadius: "20px",
            backgroundColor: activeCategory === "statutory" ? "#1e3a8a" : "#ffffff",
            color: activeCategory === "statutory" ? "#ffffff" : "#475569",
            borderColor: activeCategory === "statutory" ? "#1e3a8a" : "#cbd5e1",
          }}
        >
          Statutory (GST & Udyam) ({documents.filter((d) => getDocCategory(d) === "statutory").length})
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("labor")}
          className={`btn-secondary ${activeCategory === "labor" ? "active-filter-btn" : ""}`}
          style={{
            fontSize: "0.82rem",
            padding: "0.4rem 0.85rem",
            borderRadius: "20px",
            backgroundColor: activeCategory === "labor" ? "#1e3a8a" : "#ffffff",
            color: activeCategory === "labor" ? "#ffffff" : "#475569",
            borderColor: activeCategory === "labor" ? "#1e3a8a" : "#cbd5e1",
          }}
        >
          Labor Compliance ({documents.filter((d) => getDocCategory(d) === "labor").length})
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("other")}
          className={`btn-secondary ${activeCategory === "other" ? "active-filter-btn" : ""}`}
          style={{
            fontSize: "0.82rem",
            padding: "0.4rem 0.85rem",
            borderRadius: "20px",
            backgroundColor: activeCategory === "other" ? "#1e3a8a" : "#ffffff",
            color: activeCategory === "other" ? "#ffffff" : "#475569",
            borderColor: activeCategory === "other" ? "#1e3a8a" : "#cbd5e1",
          }}
        >
          Other Technical Credentials ({otherDocs.length})
        </button>
      </div>

      {/* Feature: Dedicated Other Statutory / Technical Multi-Document Section */}
      {(activeCategory === "all" || activeCategory === "other") && (
        <div className="dashboard-section" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div className="section-header">
            <div>
              <h3>Other Statutory / Technical ({otherDocs.length} Document{otherDocs.length === 1 ? "" : "s"})</h3>
              <p className="section-subtext">
                Supports multiple technical certificates, ISO proofs, OEM authorizations, and experience credentials. Each document coexists independently without overwriting.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSelectedType("other_statutory");
                setShowUploadCard(true);
                setTimeout(() => {
                  const el = document.getElementById("vault-upload-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }, 50);
              }}
              style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem", whiteSpace: "nowrap" }}
            >
              + Upload Another Technical Document
            </button>
          </div>

          {otherDocs.length === 0 ? (
            <div style={{ padding: "1.25rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", textAlign: "center", color: "#64748b", fontSize: "0.88rem" }}>
              No technical or additional statutory documents uploaded yet. Upload ISO certifications, OEM authorization forms, or past experience proofs.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {otherDocs.map((doc) => {
                const ext = doc.extracted_data;
                const method = (ext?.extractionMethod || ext?.extraction_method || "").toLowerCase().includes("ocr") ? "PaddleOCR" : "PyMuPDF";
                const conf = ext?.confidence ? (ext.confidence > 1 ? ext.confidence.toFixed(0) : (ext.confidence * 100).toFixed(0)) : null;

                return (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.25rem",
                      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{doc.original_name}</strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          ({(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.uploaded_at).toLocaleDateString()})
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span className="badge status-approved">✓ Extracted & Synced</span>
                        <span style={{ fontSize: "0.72rem", color: "#475569", backgroundColor: "#f1f5f9", padding: "0.15rem 0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                          {method} {conf ? `· ${conf}% confidence` : ""}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        onClick={() => handleView(doc)}
                        className="btn-action-view"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        className="btn-secondary"
                        style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id, doc.original_name || doc.document_label)}
                        className="btn-reject"
                        style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Document Inventory */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Verified Vault Inventory ({filteredDocs.length})</h2>
            <p className="section-subtext">
              Certificates stored and cryptographically mapped to your legal enterprise profile.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading document vault...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="empty-state-card">
            <h3>No Documents Found in this Category</h3>
            <p>Upload your statutory certificates to ensure 100% compliance score across tenders.</p>
            <button onClick={() => setShowUploadCard(true)} className="btn-primary" style={{ marginTop: "1rem" }}>
              + Add Document
            </button>
          </div>
        ) : (
          <div className="tenders-table-card">
            <table className="gem-table">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>File Name</th>
                  <th>Size</th>
                  <th>Upload Date</th>
                  <th>Extraction Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const ext = doc.extracted_data;
                  const method = (ext?.extractionMethod || ext?.extraction_method || "").toLowerCase().includes("ocr") ? "PaddleOCR" : "PyMuPDF";
                  const conf = ext?.confidence ? (ext.confidence > 1 ? ext.confidence.toFixed(0) : (ext.confidence * 100).toFixed(0)) : null;

                  return (
                    <tr key={doc.id}>
                      <td>
                        <strong style={{ color: "#0f172a" }}>{doc.document_label}</strong>
                      </td>
                      <td>
                        <span style={{ color: "#334155" }}>{doc.original_name}</span>
                      </td>
                      <td>{(doc.file_size / 1024).toFixed(1)} KB</td>
                      <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td>
                        {ext?.success === false ? (
                          <span className="badge" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
                            Manual Verification
                          </span>
                        ) : ext ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start" }}>
                            <span className="badge status-approved">✓ Extracted & Synced</span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                backgroundColor: "#f1f5f9",
                                color: "#334155",
                                padding: "0.1rem 0.45rem",
                                borderRadius: "3px",
                                fontWeight: 600,
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              {method} {conf ? `· ${conf}% confidence` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="badge status-submitted">Stored in Vault</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => handleView(doc)}
                            className="btn-action-view"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            className="btn-secondary"
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id, doc.document_label)}
                            className="btn-reject"
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
