import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ApplicationDetail() {
  const { id: applicationId } = useParams();
  const { authFetch, user, isOfficer } = useAuth();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Decision state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals for Reject & Request Info comments
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const loadApplication = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/applications/${applicationId}`);
      const data = await res.json();
      if (res.ok) {
        setApp(data.application);
      } else {
        throw new Error(data.error || "Failed to load application details.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [applicationId]);

  const handleApprove = async () => {
    if (!window.confirm(`Are you sure you want to APPROVE the application for ${app.company_name}?`)) {
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authFetch(`/api/applications/${applicationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Approved after verifying statutory compliance." }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve application.");
      setActionSuccess(data.message);
      await loadApplication();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setActionError("Please provide a rejection reason.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authFetch(`/api/applications/${applicationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject application.");
      setActionSuccess(data.message);
      setRejectModalOpen(false);
      await loadApplication();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async (e) => {
    e.preventDefault();
    if (!infoMessage.trim()) {
      setActionError("Please enter the required information/clarification details.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authFetch(`/api/applications/${applicationId}/request-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: infoMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request more information.");
      setActionSuccess(data.message);
      setInfoModalOpen(false);
      await loadApplication();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDoc = async (url) => {
    try {
      const res = await authFetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to view document.");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownloadDoc = async (url, fileName) => {
    try {
      const res = await authFetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to download document.");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading application evaluation...</div>;
  }

  if (error || !app) {
    return (
      <div className="dashboard-container">
        <div className="alert-box alert-error">{error || "Application not found."}</div>
        <Link to="/officer/dashboard" className="btn-secondary">&larr; Back to Dashboard</Link>
      </div>
    );
  }

  const isDecided = app.status === "approved" || app.status === "rejected";

  return (
    <div className="dashboard-container">
      <div className="breadcrumb-nav">
        <Link to="/officer/dashboard">&larr; Officer Cockpit</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to={`/officer/tenders/${encodeURIComponent(app.tender_id)}`}>Tender {app.tender_id}</Link>
        <span className="breadcrumb-separator">/</span>
        <span>Application Detail</span>
      </div>

      {actionSuccess && <div className="alert-box alert-success">{actionSuccess}</div>}
      {actionError && <div className="alert-box alert-error">{actionError}</div>}

      {/* Top Banner with Score Gauge and Status */}
      <div className="application-detail-banner">
        <div className="banner-left">
          <span className={`badge status-${app.status}`}>
            Status: {app.status?.replaceAll("_", " ").toUpperCase()}
          </span>
          <h1>{app.company_name}</h1>
          <p className="dashboard-subtitle">
            Applying for: <strong>{app.tender_title}</strong> ({app.tender_id})
          </p>
          <div className="applicant-meta-chips">
            <span>Bidder ID: <strong>{app.bidder_id}</strong></span>
            <span>Contact: <strong>{app.contact_person}</strong></span>
            <span>Email: <strong>{app.email}</strong></span>
            <span>Phone: <strong>{app.phone}</strong></span>
            <span>Applied: <strong>{new Date(app.applied_at).toLocaleString()}</strong></span>
          </div>
        </div>

        <div className="banner-right">
          <div className="score-hero-box">
            <div className="score-hero-number">{app.compliance_score}</div>
            <div className="score-hero-denom">/ 100 Score</div>
            <span className={`badge risk-${app.risk_level?.toLowerCase()}`} style={{ marginTop: "0.5rem" }}>
              {app.risk_level} Risk
            </span>
          </div>
        </div>
      </div>

      {/* Officer Decision Box */}
      {isOfficer && (
        <div className="decision-action-card">
          <div className="decision-header">
            <h3>Officer Evaluation Governance Decision</h3>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Officer: <strong>{user.full_name}</strong> &bull; Decisions are immutably signed to MongoDB Audit Trail
            </span>
          </div>

          {app.officer_comment && (
            <div className="recorded-decision-note">
              <strong>Recorded Officer Note:</strong> {app.officer_comment}
              {app.decided_at && (
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                  Decided at: {new Date(app.decided_at).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {app.bidder_response_note && (
            <div className="recorded-bidder-reply">
              <strong>Bidder Clarification Response:</strong> {app.bidder_response_note}
            </div>
          )}

          <div className="decision-buttons-row">
            <button
              onClick={handleApprove}
              disabled={actionLoading || app.status === "approved"}
              className="btn-accent"
              style={{ padding: "0.65rem 1.4rem", fontSize: "0.95rem" }}
            >
              &#10003; {app.status === "approved" ? "Approved" : "Approve Bidder"}
            </button>

            <button
              onClick={() => setInfoModalOpen(true)}
              disabled={actionLoading || isDecided}
              className="btn-secondary"
              style={{ padding: "0.65rem 1.2rem", fontSize: "0.95rem" }}
            >
              &#9998; Request More Information
            </button>

            <button
              onClick={() => setRejectModalOpen(true)}
              disabled={actionLoading || app.status === "rejected"}
              className="btn-reject"
              style={{ padding: "0.65rem 1.2rem", fontSize: "0.95rem" }}
            >
              &#10007; {app.status === "rejected" ? "Rejected" : "Reject Bidder"}
            </button>
          </div>
        </div>
      )}

      {/* Gemini LLM Executive Briefing */}
      {app.llm_briefing && (
        <div className="llm-briefing-card">
          <div className="llm-header">
            <h4>Google Gemini Advisory Briefing</h4>
            <span className="badge-gemini">
              AI: {app.llm_briefing.model || "gemini-3.5-flash"}
            </span>
          </div>
          <p className="llm-text">{app.llm_briefing.text || app.llm_briefing}</p>
        </div>
      )}

      {/* Submitted Documents Section */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h3>Submitted Statutory Verification Documents</h3>
            <p className="section-subtext">
              Reused documents verified against mandatory requirements for tender {app.tender_id}.
            </p>
          </div>
        </div>

        {(!app.submitted_documents || app.submitted_documents.length === 0) ? (
          <div className="empty-state-card">No physical documents uploaded with this bid.</div>
        ) : (
          <div className="submitted-docs-grid">
            {app.submitted_documents.map((doc, idx) => (
              <div key={idx} className="submitted-doc-card">
                <div className="doc-icon">&#128196;</div>
                <div className="doc-info">
                  <div className="doc-name">{doc.file_name}</div>
                  <div className="doc-type-badge">{doc.document_type}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                    Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="doc-actions">
                  <button
                    type="button"
                    onClick={() => handleViewDoc(doc.view_url)}
                    className="btn-doc-link"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(doc.download_url, doc.file_name)}
                    className="btn-doc-link download"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statutory Checks Evaluation Cards */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h3>Statutory Verification Breakdown</h3>
            <p className="section-subtext">
              Detailed breakdown of deterministic scoring verification across all statutory government registries.
            </p>
          </div>
        </div>

        <div className="checks-detail-grid">
          {app.checks?.map((chk) => (
            <div key={chk.source} className={`check-result-card border-${chk.status}`}>
              <div className="check-card-header">
                <span className="check-source-title">{chk.source_label || chk.source}</span>
                <span className={`badge check-status-${chk.status}`}>{chk.status}</span>
              </div>
              <div className="check-confidence">
                Confidence: {(chk.confidence * 100).toFixed(0)}%
              </div>
              <div className="check-raw-box">
                <pre>{JSON.stringify(chk.raw_fields, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h3>Reject Bidder Application</h3>
              <button onClick={() => setRejectModalOpen(false)} className="btn-close">&times;</button>
            </div>
            <form onSubmit={handleReject}>
              <div className="form-group">
                <label>Official Rejection Reason *</label>
                <textarea
                  rows="4"
                  placeholder="Explain the specific statutory failure or disqualification reason..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setRejectModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-reject" disabled={actionLoading}>
                  {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request More Information Modal */}
      {infoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "540px" }}>
            <div className="modal-header">
              <h3>Request Clarification / Additional Documents</h3>
              <button onClick={() => setInfoModalOpen(false)} className="btn-close">&times;</button>
            </div>
            <form onSubmit={handleRequestInfo}>
              <div className="form-group">
                <label>Officer Instruction to Bidder *</label>
                <textarea
                  rows="4"
                  placeholder="e.g. Please upload the latest valid GST certificate and provide updated EPFO proof for the current quarter..."
                  value={infoMessage}
                  onChange={(e) => setInfoMessage(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setInfoModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? "Sending..." : "Send Request to Bidder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
