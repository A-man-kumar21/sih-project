import React, { useEffect, useState } from "react";
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setSuccess(data.message || "Document uploaded successfully to your vault.");
      if (data.document?.extracted_data) {
        setExtractedInfo(data.document.extracted_data.extracted || data.document.extracted_data);
      }
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById("vault-file-input");
      if (fileInput) fileInput.value = "";

      await loadDocuments();
    } catch (err) {
      setError(err.message);
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
        <div className="alert-box alert-info">
          <strong>AI Document Extraction Notice:</strong>
          <div style={{ marginTop: "0.4rem", fontSize: "0.85rem" }}>
            The AI engine automatically parsed this certificate and updated your enterprise compliance credentials:
            <ul style={{ margin: "0.3rem 0 0 1.2rem" }}>
              {extractedInfo.pan && <li>PAN: <strong>{extractedInfo.pan}</strong></li>}
              {extractedInfo.gstin && <li>GSTIN: <strong>{extractedInfo.gstin}</strong></li>}
              {extractedInfo.udyam_number && <li>Udyam: <strong>{extractedInfo.udyam_number}</strong></li>}
              {extractedInfo.epfo_esic_number && <li>EPFO/ESIC: <strong>{extractedInfo.epfo_esic_number}</strong></li>}
            </ul>
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
                      {doc.extracted_data ? (
                        <span className="badge status-approved">AI Extracted</span>
                      ) : (
                        <span className="badge status-submitted">Verified</span>
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
