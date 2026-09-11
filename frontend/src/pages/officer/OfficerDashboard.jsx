import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import CreateTenderModal from "./CreateTenderModal";

export default function OfficerDashboard() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    total_tenders: 0,
    active_tenders: 0,
    total_applications: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    info_requested: 0,
  });
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, tendersRes] = await Promise.all([
        authFetch("/api/officer/overview"),
        authFetch("/api/officer/tenders"),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || {});
      }

      if (tendersRes.ok) {
        const data = await tendersRes.json();
        setTenders(data.tenders || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load procurement dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const officerName = user?.full_name?.split(" ")[0] || user?.full_name || "Officer";

  // Application Pipeline calculations
  const totalApps = metrics.total_applications || 0;
  const underReviewPct = totalApps > 0 ? ((metrics.under_review / totalApps) * 100).toFixed(0) : 0;
  const approvedPct = totalApps > 0 ? ((metrics.approved / totalApps) * 100).toFixed(0) : 0;
  const rejectedPct = totalApps > 0 ? ((metrics.rejected / totalApps) * 100).toFixed(0) : 0;
  const infoPct = totalApps > 0 ? ((metrics.info_requested / totalApps) * 100).toFixed(0) : 0;

  return (
    <div className="dashboard-container">
      {/* Officer Header */}
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">PROCUREMENT OPERATIONS</div>
          <h1>{getGreeting()}, {officerName}.</h1>
          <p className="dashboard-subtitle">
            Your tenders, applications and compliance decisions — in one place.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            + Create Tender
          </button>
          <Link to="/compliance-cockpit" className="btn-secondary">
            AI Evaluation Cockpit
          </Link>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      {/* Primary KPI Metrics Cards (Using REAL backend values) */}
      <div className="metrics-grid">
        <div className="metric-card highlight-blue">
          <div className="metric-value">{metrics.total_tenders || 0}</div>
          <div className="metric-label">Active Tenders</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{metrics.total_applications || 0}</div>
          <div className="metric-label">Applications</div>
        </div>

        <div className="metric-card highlight-amber">
          <div className="metric-value">{metrics.under_review || 0}</div>
          <div className="metric-label">Under Review</div>
        </div>

        <div className="metric-card highlight-green">
          <div className="metric-value">{metrics.approved || 0}</div>
          <div className="metric-label">Approved</div>
        </div>

        <div className="metric-card highlight-red">
          <div className="metric-value">{metrics.rejected || 0}</div>
          <div className="metric-label">Rejected</div>
        </div>

        <div className="metric-card highlight-purple">
          <div className="metric-value">{metrics.info_requested || 0}</div>
          <div className="metric-label">Info Requested</div>
        </div>
      </div>

      {/* Recent Tenders Section */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Recent Tenders</h2>
            <p className="section-subtext">
              Active procurement tenders managed by your division.
            </p>
          </div>
          {tenders.length > 0 && (
            <Link to="/officer/tenders" className="btn-secondary" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
              View All Tenders ({tenders.length}) &rarr;
            </Link>
          )}
        </div>

        {loading ? (
          <div className="loading-state">Loading tenders pipeline...</div>
        ) : tenders.length === 0 ? (
          /* Official Empty State for New Officers */
          <div className="empty-state-card">
            <h3>Your procurement workspace is ready.</h3>
            <p>Create your first tender to begin managing procurement.</p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ marginTop: "1rem" }}>
              + Create Tender
            </button>
          </div>
        ) : (
          <div className="tenders-table-card">
            <table className="gem-table">
              <thead>
                <tr>
                  <th>Tender Reference</th>
                  <th>Title & Scope</th>
                  <th>Category</th>
                  <th>Applications</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tenders.slice(0, 8).map((tender) => {
                  const summary = tender.applications_summary || { total: 0, under_review: 0, approved: 0, rejected: 0, info_requested: 0 };
                  const isDeadlinePassed = tender.deadline && new Date(tender.deadline) < new Date();
                  const statusLabel = isDeadlinePassed ? "Closed" : "Active";
                  const statusClass = isDeadlinePassed ? "status-rejected" : "status-approved";

                  return (
                    <tr key={tender.tender_id}>
                      <td>
                        <strong className="tender-id-badge">{tender.tender_id}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{tender.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.15rem" }}>
                          {tender.description ? (tender.description.length > 65 ? `${tender.description.slice(0, 65)}...` : tender.description) : "No description provided"}
                        </div>
                      </td>
                      <td>
                        <span className="category-pill">{tender.category || "Goods"}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: "1rem", color: "#0f172a" }}>{summary.total}</strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "0.3rem" }}>bids</span>
                      </td>
                      <td>
                        <span className={`badge ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.82rem", color: "#475569" }}>
                          {tender.deadline ? new Date(tender.deadline).toLocaleDateString() : "Open"}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/officer/tenders/${encodeURIComponent(tender.tender_id)}`)}
                          className="btn-action-view"
                        >
                          View Applicants ({summary.total}) &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Application Pipeline Visual Summary (Real Backend Data) */}
      {totalApps > 0 && (
        <div className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Application Pipeline</h2>
              <p className="section-subtext">
                Live compliance status distribution across {totalApps} total submitted bidder application{totalApps === 1 ? "" : "s"}.
              </p>
            </div>
          </div>

          {/* Segmented Pipeline Bar */}
          <div style={{ width: "100%", height: "10px", backgroundColor: "#e2e8f0", borderRadius: "99px", display: "flex", overflow: "hidden", marginBottom: "1.25rem" }}>
            {metrics.approved > 0 && (
              <div style={{ width: `${approvedPct}%`, backgroundColor: "#059669" }} title={`Approved: ${metrics.approved}`} />
            )}
            {metrics.under_review > 0 && (
              <div style={{ width: `${underReviewPct}%`, backgroundColor: "#d97706" }} title={`Under Review: ${metrics.under_review}`} />
            )}
            {metrics.info_requested > 0 && (
              <div style={{ width: `${infoPct}%`, backgroundColor: "#7c3aed" }} title={`Info Requested: ${metrics.info_requested}`} />
            )}
            {metrics.rejected > 0 && (
              <div style={{ width: `${rejectedPct}%`, backgroundColor: "#dc2626" }} title={`Rejected: ${metrics.rejected}`} />
            )}
          </div>

          {/* Pipeline Stage Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div style={{ padding: "0.85rem 1rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Approved</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#15803d", marginTop: "0.2rem" }}>{metrics.approved}</div>
              <div style={{ fontSize: "0.75rem", color: "#166534" }}>{approvedPct}% of total bids</div>
            </div>

            <div style={{ padding: "0.85rem 1rem", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>Under Review</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#b45309", marginTop: "0.2rem" }}>{metrics.under_review}</div>
              <div style={{ fontSize: "0.75rem", color: "#92400e" }}>{underReviewPct}% awaiting decision</div>
            </div>

            <div style={{ padding: "0.85rem 1rem", backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#5b21b6", textTransform: "uppercase" }}>Clarifications</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#6d28d9", marginTop: "0.2rem" }}>{metrics.info_requested}</div>
              <div style={{ fontSize: "0.75rem", color: "#5b21b6" }}>{infoPct}% info requested</div>
            </div>

            <div style={{ padding: "0.85rem 1rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>Rejected</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#b91c1c", marginTop: "0.2rem" }}>{metrics.rejected}</div>
              <div style={{ fontSize: "0.75rem", color: "#991b1b" }}>{rejectedPct}% non-compliant</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for Tender Creation */}
      <CreateTenderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => loadDashboardData()}
      />
    </div>
  );
}
