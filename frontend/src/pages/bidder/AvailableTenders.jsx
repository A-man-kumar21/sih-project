import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AvailableTenders() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();

  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Apply Modal state
  const [activeTender, setActiveTender] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [applySuccess, setApplySuccess] = useState(null);

  // In-modal quick upload for missing doc
  const [missingUploadType, setMissingUploadType] = useState(null);
  const [missingFile, setMissingFile] = useState(null);
  const [uploadingMissing, setUploadingMissing] = useState(false);

  const loadTenders = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/bidder/tenders");
      const data = await res.json();
      if (res.ok) {
        setTenders(data.tenders || []);
      } else {
        throw new Error(data.error || "Failed to load tenders.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenders();
  }, []);

  const handleOpenApplyModal = (tender) => {
    setActiveTender(tender);
    setApplyError(null);
    setApplySuccess(null);
    setMissingUploadType(null);
    setMissingFile(null);
  };

  const handleUploadMissingDoc = async (docType) => {
    if (!missingFile) {
      setApplyError("Please select a document file to upload.");
      return;
    }
    setUploadingMissing(true);
    setApplyError(null);
    try {
      const formData = new FormData();
      formData.append("file", missingFile);
      formData.append("document_type", docType);

      const res = await authFetch("/api/bidder/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      // Refresh tenders to update requirements state
      await loadTenders();

      // Update active tender in modal
      const updatedTendersRes = await authFetch("/api/bidder/tenders");
      const updatedData = await updatedTendersRes.json();
      if (updatedTendersRes.ok) {
        setTenders(updatedData.tenders);
        const refreshedActive = updatedData.tenders.find((t) => t.tender_id === activeTender.tender_id);
        setActiveTender(refreshedActive || null);
      }

      setMissingFile(null);
      setMissingUploadType(null);
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setUploadingMissing(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!activeTender) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await authFetch(`/api/tenders/${activeTender.tender_id}/apply`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit application.");
      }
      setApplySuccess(data.message || "Application successfully submitted!");
      await loadTenders();
      setTimeout(() => {
        setActiveTender(null);
        navigate("/bidder/applications");
      }, 1500);
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplying(false);
    }
  };

  const filteredTenders = tenders.filter(
    (t) =>
      t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tender_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">Public Procurement Opportunities</div>
          <h1>Browse Available Tenders</h1>
          <p className="dashboard-subtitle">
            Find open GeM procurement tenders and submit bids with 1-click reusable compliance verification.
          </p>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      <div className="search-filter-bar">
        <input
          type="text"
          placeholder="Search by tender ID, title, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading open tenders...</div>
      ) : filteredTenders.length === 0 ? (
        <div className="empty-state-card">
          <h3>No Open Tenders Found</h3>
          <p>There are currently no tenders matching your criteria.</p>
        </div>
      ) : (
        <div className="tenders-grid">
          {filteredTenders.map((tender) => {
            const hasApplied = tender.has_applied;
            const allSatisfied = tender.all_requirements_satisfied;

            return (
              <div key={tender.tender_id} className={`tender-card-item ${hasApplied ? "applied-card" : ""}`}>
                <div className="tender-card-header">
                  <span className="tender-id-badge">{tender.tender_id}</span>
                  <span className="category-pill">{tender.category}</span>
                </div>

                <h3 className="tender-card-title">{tender.title}</h3>
                <p className="tender-card-desc">{tender.description}</p>

                {/* Requirements Indicator */}
                <div className="tender-card-meta">
                  <span className="meta-label">Mandatory Verification Checklist:</span>
                  <div className="requirements-checklist-mini">
                    {tender.requirements?.map((req) => (
                      <div
                        key={req.check_key}
                        className={`req-chip ${req.satisfied ? "satisfied" : "missing"}`}
                        title={req.satisfied ? "Available in your vault" : "Missing from your vault"}
                      >
                        {req.satisfied ? "✓" : "!"} {req.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tender-card-footer">
                  <div>
                    {hasApplied ? (
                      <span className={`badge status-${tender.application?.status}`}>
                        Applied: {tender.application?.status?.replaceAll("_", " ")}
                      </span>
                    ) : allSatisfied ? (
                      <span className="badge status-approved">All Documents in Vault</span>
                    ) : (
                      <span className="badge risk-medium">{tender.missing_count} Document(s) Needed</span>
                    )}
                  </div>

                  {hasApplied ? (
                    <Link to="/bidder/applications" className="btn-secondary" style={{ fontSize: "0.85rem" }}>
                      View Status &rarr;
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleOpenApplyModal(tender)}
                      className="btn-primary"
                      style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}
                    >
                      Apply Now &rarr;
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Apply Modal with Document Validation & In-Modal Upload */}
      {activeTender && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "620px" }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Apply for {activeTender.tender_id}</h3>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{activeTender.title}</span>
              </div>
              <button onClick={() => setActiveTender(null)} className="btn-close">&times;</button>
            </div>

            {applySuccess && <div className="alert-box alert-success">{applySuccess}</div>}
            {applyError && <div className="alert-box alert-error">{applyError}</div>}

            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", color: "#1a365d" }}>Mandatory Document Pre-Check</h4>
              <p style={{ fontSize: "0.85rem", color: "#5d6e86", marginTop: 0 }}>
                This tender requires the following statutory certificates. Existing documents in your vault will be reused automatically.
              </p>

              <div className="modal-req-list">
                {activeTender.requirements?.map((req) => (
                  <div key={req.check_key} className={`modal-req-row ${req.satisfied ? "row-satisfied" : "row-missing"}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span className="req-status-icon">{req.satisfied ? "✓" : "⚠"}</span>
                      <div>
                        <strong>{req.label}</strong>
                        <div style={{ fontSize: "0.78rem", color: req.satisfied ? "#08724b" : "#dc2626" }}>
                          {req.satisfied ? "Ready in Vault (Auto-Reused)" : "Missing from Document Vault"}
                        </div>
                      </div>
                    </div>

                    {!req.satisfied && (
                      <div>
                        {missingUploadType === req.doc_type ? (
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) => setMissingFile(e.target.files[0])}
                              style={{ fontSize: "0.78rem" }}
                            />
                            <button
                              type="button"
                              onClick={() => handleUploadMissingDoc(req.doc_type)}
                              disabled={uploadingMissing}
                              className="btn-accent"
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                            >
                              {uploadingMissing ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setMissingUploadType(null)}
                              className="btn-secondary"
                              style={{ padding: "0.3rem 0.5rem", fontSize: "0.78rem" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setMissingUploadType(req.doc_type);
                              setMissingFile(null);
                            }}
                            className="btn-primary"
                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                          >
                            + Upload Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!activeTender.all_requirements_satisfied && (
                <div className="alert-box alert-warning" style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
                  <strong>Application Blocked:</strong> You have {activeTender.missing_count} missing mandatory document(s). Upload them above or visit your Document Vault to satisfy all requirements.
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => setActiveTender(null)}
                className="btn-secondary"
                disabled={applying}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmApply}
                disabled={!activeTender.all_requirements_satisfied || applying}
                className="btn-primary"
              >
                {applying ? "Evaluating Compliance & Submitting..." : "Confirm & Submit Bid Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
