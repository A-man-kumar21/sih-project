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
        setMetrics(data.metrics);
      }

      if (tendersRes.ok) {
        const data = await tendersRes.json();
        setTenders(data.tenders);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="dashboard-container">
      {/* Officer Welcome Header */}
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">Procurement Operations Division</div>
          <h1>Officer Procurement Cockpit</h1>
          <p className="dashboard-subtitle">
            Welcome, <strong>{user?.full_name}</strong> ({user?.designation}, {user?.department})
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            + Create New Tender
          </button>
          <Link to="/compliance-cockpit" className="btn-secondary">
            AI Evaluation Cockpit
          </Link>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      {/* Metrics Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{metrics.total_tenders}</div>
          <div className="metric-label">Active Tenders</div>
        </div>

        <div className="metric-card highlight-blue">
          <div className="metric-value">{metrics.total_applications}</div>
          <div className="metric-label">Total Applications</div>
        </div>

        <div className="metric-card highlight-amber">
          <div className="metric-value">{metrics.under_review}</div>
          <div className="metric-label">Under Review</div>
        </div>

        <div className="metric-card highlight-green">
          <div className="metric-value">{metrics.approved}</div>
          <div className="metric-label">Approved</div>
        </div>

        <div className="metric-card highlight-red">
          <div className="metric-value">{metrics.rejected}</div>
          <div className="metric-label">Rejected</div>
        </div>

        <div className="metric-card highlight-purple">
          <div className="metric-value">{metrics.info_requested}</div>
          <div className="metric-label">Info Requested</div>
        </div>
      </div>

      {/* Tenders Overview Section */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Tenders & Application Pipeline</h2>
            <p className="section-subtext">
              Select a tender below to review submitted bidder applications ranked by compliance score.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading tenders pipeline...</div>
        ) : tenders.length === 0 ? (
          <div className="empty-state-card">
            <h3>No Tenders Created Yet</h3>
            <p>Publish your first procurement tender to start receiving compliant bids.</p>
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
                  <th>Mandatory Checks</th>
                  <th>Applicants</th>
                  <th>Status Breakdown</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((tender) => {
                  const summary = tender.applications_summary || { total: 0, under_review: 0, approved: 0, rejected: 0, info_requested: 0 };
                  return (
                    <tr key={tender.tender_id}>
                      <td>
                        <strong className="tender-id-badge">{tender.tender_id}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{tender.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{tender.description?.slice(0, 70)}...</div>
                      </td>
                      <td>
                        <span className="category-pill">{tender.category}</span>
                      </td>
                      <td>
                        <div className="checks-tags-group">
                          {tender.mandatory_checks?.map((chk) => (
                            <span key={chk} className="check-tag">{chk}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong style={{ fontSize: "1.05rem" }}>{summary.total}</strong>
                      </td>
                      <td>
                        <div className="status-mini-breakdown">
                          {summary.under_review > 0 && <span className="badge status-submitted">{summary.under_review} Review</span>}
                          {summary.approved > 0 && <span className="badge status-approved">{summary.approved} Apprv</span>}
                          {summary.rejected > 0 && <span className="badge status-rejected">{summary.rejected} Rej</span>}
                          {summary.info_requested > 0 && <span className="badge status-info_requested">{summary.info_requested} Info</span>}
                          {summary.total === 0 && <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No bids yet</span>}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/officer/tenders/${tender.tender_id}`)}
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

      <CreateTenderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => loadDashboardData()}
      />
    </div>
  );
}
