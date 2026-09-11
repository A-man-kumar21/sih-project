import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function MyApplications() {
  const { authFetch } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Clarification resubmit modal
  const [selectedApp, setSelectedApp] = useState(null);
  const [clarificationNote, setClarificationNote] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState(null);
  const [resubmitError, setResubmitError] = useState(null);

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/bidder/applications");
      const data = await res.json();
      if (res.ok) {
        setApplications(data.applications || []);
      } else {
        throw new Error(data.error || "Failed to load submitted applications.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleResubmitInfo = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    setResubmitting(true);
    setResubmitError(null);
    try {
      const res = await authFetch(`/api/applications/${selectedApp.id}/resubmit-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: clarificationNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resubmit clarification.");
      setResubmitSuccess("Clarification and updated documents submitted for review.");
      setSelectedApp(null);
      setClarificationNote("");
      await loadApplications();
    } catch (err) {
      setResubmitError(err.message);
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">Enterprise Bid Tracking</div>
          <h1>My Tender Applications</h1>
          <p className="dashboard-subtitle">
            Track your submitted bids, live compliance scores, and official officer governance determinations.
          </p>
        </div>
        <Link to="/bidder/tenders" className="btn-primary">
          Browse More Tenders &rarr;
        </Link>
      </div>

      {resubmitSuccess && <div className="alert-box alert-success">{resubmitSuccess}</div>}
      {error && <div className="alert-box alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading your applications...</div>
      ) : applications.length === 0 ? (
        <div className="empty-state-card">
          <h3>No Tender Applications Submitted Yet</h3>
          <p>Browse open procurement tenders and apply using your reusable statutory document vault.</p>
          <Link to="/bidder/tenders" className="btn-primary" style={{ marginTop: "1rem", display: "inline-block" }}>
            Explore Open Tenders
          </Link>
        </div>
      ) : (
        <div className="tenders-table-card">
          <table className="gem-table">
            <thead>
              <tr>
                <th>Tender Reference</th>
                <th>Tender Title</th>
                <th>Applied Date</th>
                <th>Compliance Score</th>
                <th>Risk Level</th>
                <th>Application Status</th>
                <th>Officer Comments / Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <strong className="tender-id-badge">{app.tender_id}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{app.tender_title}</div>
                    <span className="category-pill" style={{ marginTop: "0.2rem" }}>
                      {app.tender_category}
                    </span>
                  </td>
                  <td>{new Date(app.applied_at).toLocaleDateString()}</td>
                  <td>
                    <div className="score-display-cell">
                      <strong>{app.compliance_score} / 100</strong>
                    </div>
                  </td>
                  <td>
                    <span className={`badge risk-${app.risk_level?.toLowerCase()}`}>
                      {app.risk_level}
                    </span>
                  </td>
                  <td>
                    <span className={`badge status-${app.status}`}>
                      {app.status?.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    {app.status === "info_requested" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "#b45309", fontWeight: 600 }}>
                          &#9888; Action Required
                        </span>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          "{app.officer_comment}"
                        </div>
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setClarificationNote("");
                            setResubmitError(null);
                          }}
                          className="btn-accent"
                          style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                        >
                          Provide Requested Info &rarr;
                        </button>
                      </div>
                    ) : app.officer_comment ? (
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                          "{app.officer_comment}"
                        </div>
                        {app.decided_at && (
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            {new Date(app.decided_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                        Under statutory officer review
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clarification Resubmit Modal */}
      {selectedApp && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Provide Requested Information</h3>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Tender: {selectedApp.tender_id}
                </span>
              </div>
              <button onClick={() => setSelectedApp(null)} className="btn-close">&times;</button>
            </div>

            {resubmitError && <div className="alert-box alert-error">{resubmitError}</div>}

            <div className="alert-box alert-warning" style={{ margin: "1rem 0" }}>
              <strong>Officer Instruction:</strong>
              <div style={{ marginTop: "0.2rem" }}>"{selectedApp.officer_comment}"</div>
            </div>

            <form onSubmit={handleResubmitInfo}>
              <div className="form-group">
                <label>Your Clarification & Response Note *</label>
                <textarea
                  rows="4"
                  placeholder="Explain the changes made or details of updated certificates uploaded in your Document Vault..."
                  value={clarificationNote}
                  onChange={(e) => setClarificationNote(e.target.value)}
                  required
                />
              </div>

              <p style={{ fontSize: "0.82rem", color: "#64748b" }}>
                Tip: If you need to replace or add a new certificate, update it in your{" "}
                <Link to="/bidder/documents" target="_blank" style={{ color: "#1a365d", fontWeight: 600 }}>
                  Document Vault
                </Link>{" "}
                first. Submitting this form will re-snapshot all your vault documents and notify the reviewing officer.
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="btn-secondary"
                  disabled={resubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={resubmitting}>
                  {resubmitting ? "Submitting..." : "Submit Clarification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
