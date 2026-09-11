import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const DOCUMENT_TYPES = [
  { value: "pan_card", label: "Permanent Account Number (PAN) Card", check: "pan_it" },
  { value: "gstin_cert", label: "GST Registration Certificate", check: "gstn" },
  { value: "udyam_cert", label: "Udyam / MSME Certificate", check: "udyam" },
  { value: "epfo_esic_cert", label: "EPFO & ESIC Labor Compliance Proof", check: "epfo_esic" },
  { value: "digilocker_proof", label: "DigiLocker Verified Credential", check: "digilocker" },
  { value: "other", label: "Other Statutory / Technical Document", check: "other" },
];

export default function DocumentVault() {
  const { authFetch, user } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
      // Reset file input
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">Enterprise Profile & Statutory Storage</div>
          <h1>Reusable Document Vault</h1>
          <p className="dashboard-subtitle">
            Upload your enterprise certificates <strong>once</strong>. They are automatically reused across all tender bids without re-uploading.
          </p>
        </div>
      </div>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-error">{error}</div>}

      {/* Extracted Data Callout */}
      {extractedInfo && (
        <div className="alert-box alert-info" style={{ borderLeft: "4px solid #10b981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
                  {extractedInfo._confidence != null ? ` (${extractedInfo._confidence > 1 ? extractedInfo._confidence.toFixed(0) : (extractedInfo._confidence * 100).toFixed(0)}% conf)` : ""}
                </span>
              </div>
              <p style={{ margin: "0.2rem 0 0.5rem", fontSize: "0.85rem", color: "#334155" }}>
                Certificate parsed locally with zero external LLM/API calls. The following structured attributes were synchronized to your Enterprise Profile:
              </p>
            </div>
            <Link
              to="/bidder/profile"
              className="btn-primary"
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", whiteSpace: "nowrap" }}
            >
              View Enterprise Profile →
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.5rem", marginTop: "0.4rem", fontSize: "0.85rem", background: "white", padding: "0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            {(extractedInfo.enterprise_name || extractedInfo.company_name || extractedInfo.companyName) && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Enterprise Legal Name</span>
                <strong>{extractedInfo.enterprise_name || extractedInfo.company_name || extractedInfo.companyName}</strong>
              </div>
            )}
            {extractedInfo.pan && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Permanent Account Number (PAN)</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.pan}</strong>
              </div>
            )}
            {extractedInfo.gstin && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>GSTIN</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.gstin}</strong>
              </div>
            )}
            {(extractedInfo.udyam_number || extractedInfo.udyam) && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Udyam / MSME Registration</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.udyam_number || extractedInfo.udyam}</strong>
              </div>
            )}
            {extractedInfo.cin && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Corporate Identity Number (CIN)</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.cin}</strong>
              </div>
            )}
            {(extractedInfo.epfo_number || extractedInfo.epfo) && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>EPFO Registration Code</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.epfo_number || extractedInfo.epfo}</strong>
              </div>
            )}
            {(extractedInfo.esic_number || extractedInfo.esic) && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>ESIC Employer Code</span>
                <strong style={{ fontFamily: "monospace" }}>{extractedInfo.esic_number || extractedInfo.esic}</strong>
              </div>
            )}
            {extractedInfo.business_constitution && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Business Constitution</span>
                <strong>{extractedInfo.business_constitution}</strong>
              </div>
            )}
            {extractedInfo.registration_date && (
              <div>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Registration Date</span>
                <strong>{extractedInfo.registration_date}</strong>
              </div>
            )}
            {(extractedInfo.registered_address || extractedInfo.address) && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Principal Place of Business</span>
                <span>{extractedInfo.registered_address || extractedInfo.address}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Box */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h3>Upload New Statutory Certificate</h3>
            <p className="section-subtext">
              Supports PDF, PNG, and JPG. Uploading an existing type will automatically update the vault to the latest version.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="vault-upload-card">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Statutory Document Category *</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{ padding: "0.6rem" }}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Select Document File (PDF / Image) *</label>
              <input
                id="vault-file-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                required
                style={{ padding: "0.5rem" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? "Extracting & Uploading..." : "Upload to Vault"}
            </button>
          </div>
        </form>
      </div>

      {/* Vault Inventory Table */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h3>Vault Inventory ({documents.length} Active Certificates)</h3>
            <p className="section-subtext">
              These documents are available for 1-click reuse across any GeM procurement tenders.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading document vault...</div>
        ) : documents.length === 0 ? (
          <div className="empty-state-card">
            <h3>Your Document Vault is Empty</h3>
            <p>Upload your PAN, GSTIN, and Udyam certificates above to be ready for instant bidding.</p>
          </div>
        ) : (
          <div className="tenders-table-card">
            <table className="gem-table">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Original File Name</th>
                  <th>File Size</th>
                  <th>Uploaded Date</th>
                  <th>Extraction Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong style={{ color: "#1a365d" }}>{doc.document_label}</strong>
                    </td>
                    <td>
                      <span>{doc.original_name}</span>
                    </td>
                    <td>{(doc.file_size / 1024).toFixed(1)} KB</td>
                    <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                    <td>
                      {doc.extracted_data?.success === false ? (
                        <span className="badge" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
                          Manual Verification
                        </span>
                      ) : doc.extracted_data ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start" }}>
                          <span className="badge status-approved">✓ Extracted & Synced</span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              backgroundColor: "#f1f5f9",
                              color: "#334155",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "3px",
                              fontWeight: 600,
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {(doc.extracted_data.extractionMethod || doc.extracted_data.extraction_method || "").toLowerCase().includes("ocr") ? "PaddleOCR" : "PyMuPDF"}
                            {doc.extracted_data.confidence ? ` (${doc.extracted_data.confidence > 1 ? doc.extracted_data.confidence.toFixed(0) : (doc.extracted_data.confidence * 100).toFixed(0)}%)` : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="badge status-submitted">Stored in Vault</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
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
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id, doc.document_label)}
                          className="btn-reject"
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
