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
  const [documents, setDocuments] = useState([]);
  const [openTenders, setOpenTenders] = useState([]);
  const [recentApps, setRecentApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [tendersRes, appsRes, docsRes] = await Promise.all([
          authFetch("/api/bidder/tenders"),
          authFetch("/api/bidder/applications"),
          authFetch("/api/bidder/documents"),
        ]);

        if (tendersRes.ok && appsRes.ok) {
          const tendersData = await tendersRes.json();
          const appsData = await appsRes.json();

          const allTenders = tendersData.tenders || [];
          setOpenTenders(allTenders.slice(0, 4));

          const apps = appsData.applications || [];
          setRecentApps(apps.slice(0, 5));

          setMetrics({
            available_tenders: allTenders.length,
            my_applications: apps.length,
            under_review: apps.filter((a) => a.status === "under_review" || a.status === "submitted").length,
            approved: apps.filter((a) => a.status === "approved").length,
            rejected: apps.filter((a) => a.status === "rejected").length,
            info_requested: apps.filter((a) => a.status === "info_requested").length,
          });
        }

        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData.documents || []);
        }
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const bidderName = user?.company_name || user?.contact_person || "Enterprise Bidder";

  // Check real document presence in vault (NO fake percentages)
  const hasPan = documents.some((d) => d.document_type === "pan_card" || d.document_type === "pan");
  const hasGst = documents.some((d) => d.document_type === "gstin_cert" || d.document_type === "gst");
  const hasUdyam = documents.some((d) => d.document_type === "udyam_cert" || d.document_type === "udyam");
  const hasEpfoEsic = documents.some((d) => d.document_type === "epfo_esic_cert" || d.document_type === "epfo_esic");
  const hasOther = documents.some((d) => d.document_type === "other_statutory" || d.document_type === "other");

  const readinessItems = [
    { key: "pan", label: "Permanent Account Number (PAN)", verified: hasPan, required: true },
    { key: "gst", label: "GST Registration Certificate (GSTIN)", verified: hasGst, required: true },
    { key: "udyam", label: "Udyam / MSME Registration Certificate", verified: hasUdyam, required: true },
    { key: "epfo_esic", label: "EPFO & ESIC Labor Compliance Proof", verified: hasEpfoEsic, required: false },
    { key: "other", label: "Technical Credentials / Experience Proofs", verified: hasOther, required: false },
  ];

  const verifiedCount = readinessItems.filter((i) => i.verified).length;
  const isFullyReady = hasPan && hasGst && hasUdyam;

  return (
    <div className="dashboard-container">
      {/* Bidder Header */}
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">YOUR PROCUREMENT WORKSPACE</div>
          <h1>{getGreeting()}, {bidderName}.</h1>
          <p className="dashboard-subtitle">
            Everything you need to stay procurement-ready.
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

      {/* Action Required Banner if clarifications requested */}
      {metrics.info_requested > 0 && (
        <div
          className="alert-box alert-warning"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <strong>Officer Clarification Requested:</strong> You have {metrics.info_requested} application(s) requiring updated statutory documents or clarification responses.
          </div>
          <Link
            to="/bidder/applications"
            className="btn-primary"
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
          >
            Respond Now &rarr;
          </Link>
        </div>
      )}

      {/* Main Procurement Readiness Card (Real Vault Compliance Data) */}
      <div className="dashboard-section" style={{ borderLeft: isFullyReady ? "4px solid #059669" : "4px solid #d97706" }}>
        <div className="section-header" style={{ marginBottom: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h2 style={{ margin: 0 }}>Procurement Readiness</h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.6rem",
                  borderRadius: "99px",
                  backgroundColor: isFullyReady ? "#ecfdf5" : "#fffbeb",
                  color: isFullyReady ? "#065f46" : "#92400e",
                  border: isFullyReady ? "1px solid #a7f3d0" : "1px solid #fde68a",
                }}
              >
                {isFullyReady ? "✓ Procurement Ready" : "Action Recommended"}
              </span>
            </div>
            <p className="section-subtext" style={{ marginTop: "0.3rem" }}>
              {verifiedCount} of {readinessItems.length} statutory certificates verified and reusable across all GeM tender submissions.
            </p>
          </div>
          <Link
            to="/bidder/documents"
            className="btn-secondary"
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem", whiteSpace: "nowrap" }}
          >
            + Upload to Vault
          </Link>
        </div>

        {/* Readiness Checklist Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.85rem" }}>
          {readinessItems.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                backgroundColor: item.verified ? "#f8fafc" : "#ffffff",
                border: item.verified ? "1px solid #e2e8f0" : "1px dashed #cbd5e1",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    backgroundColor: item.verified ? "#dcfce7" : "#fee2e2",
                    color: item.verified ? "#15803d" : "#b91c1c",
                  }}
                >
                  {item.verified ? "✓" : "!"}
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>{item.label}</span>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: item.verified ? "#059669" : "#d97706",
                  whiteSpace: "nowrap",
                  marginLeft: "0.5rem",
                }}
              >
                {item.verified ? "In Vault" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Your Activity Metrics Section */}
      <div className="section-header" style={{ marginTop: "2rem", marginBottom: "0.75rem" }}>
        <div>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Your Activity</h2>
          <p className="section-subtext">Summary of your current procurement submissions and active bids.</p>
        </div>
      </div>

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
          <div className="metric-label">Approved Applications</div>
        </div>

        <div className="metric-card highlight-purple">
          <div className="metric-value">{metrics.info_requested}</div>
          <div className="metric-label">Clarifications</div>
        </div>
      </div>

      {/* Recommended / Available Tenders Section (Real Tenders) */}
      <div className="dashboard-section" style={{ marginTop: "1.5rem" }}>
        <div className="section-header">
          <div>
            <h2>Available Procurement Tenders</h2>
            <p className="section-subtext">Open public tenders eligible for 1-click submission with your verified vault.</p>
          </div>
          <Link to="/bidder/tenders" className="btn-secondary" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Browse All Tenders &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="loading-state">Loading open procurement tenders...</div>
        ) : openTenders.length === 0 ? (
          <div className="empty-state-card">
            <p>No open tenders currently available. Check back soon for new opportunities.</p>
          </div>
        ) : (
          <div className="tenders-grid" style={{ marginTop: "0.5rem" }}>
            {openTenders.map((tender) => {
              const hasApplied = tender.has_applied;
              const allSatisfied = tender.all_requirements_satisfied;

              return (
                <div key={tender.tender_id} className={`tender-card-item ${hasApplied ? "applied-card" : ""}`}>
                  <div className="tender-card-header">
                    <span className="tender-id-badge">{tender.tender_id}</span>
                    <span className="category-pill">{tender.category || "Goods"}</span>
                  </div>

                  <h3 className="tender-card-title">{tender.title}</h3>
                  <p className="tender-card-desc">{tender.description}</p>

                  <div className="tender-card-footer">
                    <div>
                      {hasApplied ? (
                        <span className={`badge status-${tender.application?.status || "submitted"}`}>
                          Applied: {tender.application?.status?.replaceAll("_", " ") || "Submitted"}
                        </span>
                      ) : allSatisfied ? (
                        <span className="badge status-approved">All Docs in Vault</span>
                      ) : (
                        <span className="badge status-under_review">Requirements Apply</span>
                      )}
                    </div>

                    <button
                      onClick={() => navigate(`/bidder/tenders`)}
                      className="btn-primary"
                      style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem" }}
                    >
                      {hasApplied ? "View Bid &rarr;" : "View Details &rarr;"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Applications Section */}
      {recentApps.length > 0 && (
        <div className="dashboard-section" style={{ marginTop: "1.5rem" }}>
          <div className="section-header">
            <div>
              <h2>Recent Tender Submissions</h2>
              <p className="section-subtext">Recent bid compliance evaluations and officer determinations.</p>
            </div>
            <Link to="/bidder/applications" className="btn-secondary" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
              View All Applications &rarr;
            </Link>
          </div>

          <div className="tenders-table-card">
            <table className="gem-table">
              <thead>
                <tr>
                  <th>Tender Reference</th>
                  <th>Title</th>
                  <th>Applied Date</th>
                  <th>Compliance Score</th>
                  <th>Risk Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <strong className="tender-id-badge">{app.tender_id}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{app.tender_title}</div>
                    </td>
                    <td>{new Date(app.applied_at).toLocaleDateString()}</td>
                    <td>
                      <strong style={{ color: "#0f172a" }}>{app.compliance_score} / 100</strong>
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
        </div>
      )}
    </div>
  );
}
