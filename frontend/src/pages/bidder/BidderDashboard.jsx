import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function BidderDashboard() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    available_tenders: 0,
    my_applications: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    info_requested: 0,
  });
  const [recentApps, setRecentApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [tendersRes, appsRes] = await Promise.all([
          authFetch("/api/bidder/tenders"),
          authFetch("/api/bidder/applications"),
        ]);

        if (tendersRes.ok && appsRes.ok) {
          const tendersData = await tendersRes.json();
          const appsData = await appsRes.json();

          const apps = appsData.applications || [];
          setRecentApps(apps.slice(0, 5));

          setMetrics({
            available_tenders: tendersData.tenders?.length || 0,
            my_applications: apps.length,
            under_review: apps.filter((a) => a.status === "under_review" || a.status === "submitted").length,
            approved: apps.filter((a) => a.status === "approved").length,
            rejected: apps.filter((a) => a.status === "rejected").length,
            info_requested: apps.filter((a) => a.status === "info_requested").length,
          });
        }
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">Enterprise Procurement Workspace</div>
          <h1>Bidder Compliance Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome, <strong>{user?.company_name}</strong> (Bidder ID: <strong>{user?.bidder_id}</strong>)
          </p>
        </div>
        <div className="header-actions">
          <Link to="/bidder/tenders" className="btn-primary">
            Explore Open Tenders &rarr;
          </Link>
          <Link to="/bidder/documents" className="btn-secondary">
            Manage Document Vault
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card highlight-blue">
          <div className="metric-value">{metrics.available_tenders}</div>
          <div className="metric-label">Available Tenders</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{metrics.my_applications}</div>
          <div className="metric-label">My Applications</div>
        </div>

        <div className="metric-card highlight-amber">
          <div className="metric-value">{metrics.under_review}</div>
          <div className="metric-label">Under Review</div>
        </div>

        <div className="metric-card highlight-green">
          <div className="metric-value">{metrics.approved}</div>
          <div className="metric-label">Approved Bids</div>
        </div>

        <div className="metric-card highlight-purple">
          <div className="metric-value">{metrics.info_requested}</div>
          <div className="metric-label">Action Required</div>
        </div>
      </div>

      {/* Action Required Banner if info requested */}
      {metrics.info_requested > 0 && (
        <div className="alert-box alert-warning" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <strong>Officer Clarification Requested:</strong> You have {metrics.info_requested} application(s) requiring additional statutory documents or responses.
          </div>
          <Link to="/bidder/applications" className="btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            View Requests &rarr;
          </Link>
        </div>
      )}

      {/* Quick Access Feature Cards */}
      <div className="quick-access-grid">
        <div className="quick-card" onClick={() => navigate("/bidder/documents")}>
          <div className="quick-card-icon">&#128193;</div>
          <h3>Reusable Document Vault</h3>
          <p>Store your PAN, GSTIN, and Udyam certificates once to automatically apply across all tenders.</p>
          <span className="quick-card-link">Open Vault &rarr;</span>
        </div>

        <div className="quick-card" onClick={() => navigate("/bidder/tenders")}>
          <div className="quick-card-icon">&#128269;</div>
          <h3>Browse Active Tenders</h3>
          <p>Explore high-value public procurement opportunities with instant pre-compliance validation.</p>
          <span className="quick-card-link">Find Tenders &rarr;</span>
        </div>

        <div className="quick-card" onClick={() => navigate("/bidder/profile")}>
          <div className="quick-card-icon">&#127970;</div>
          <h3>Enterprise Profile</h3>
          <p>Keep your registered statutory identifiers and authorized contact person details synchronized.</p>
          <span className="quick-card-link">View Profile &rarr;</span>
        </div>
      </div>

      {/* Recent Applications Section */}
      <div className="dashboard-section" style={{ marginTop: "2rem" }}>
        <div className="section-header">
          <div>
            <h2>Recent Tender Applications</h2>
            <p className="section-subtext">Recent bid evaluations and officer determinations.</p>
          </div>
          {recentApps.length > 0 && (
            <Link to="/bidder/applications" className="btn-secondary" style={{ fontSize: "0.85rem" }}>
              View All Applications &rarr;
            </Link>
          )}
        </div>

        {loading ? (
          <div className="loading-state">Loading your activity...</div>
        ) : recentApps.length === 0 ? (
          <div className="empty-state-card">
            <p>You haven't submitted any bids yet. Head over to <strong>Browse Tenders</strong> to get started.</p>
          </div>
        ) : (
          <div className="tenders-table-card">
            <table className="gem-table">
              <thead>
                <tr>
                  <th>Tender</th>
                  <th>Applied On</th>
                  <th>Compliance Score</th>
                  <th>Risk Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <strong>{app.tender_title}</strong>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{app.tender_id}</div>
                    </td>
                    <td>{new Date(app.applied_at).toLocaleDateString()}</td>
                    <td>
                      <strong style={{ color: "#1a365d" }}>{app.compliance_score} / 100</strong>
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
