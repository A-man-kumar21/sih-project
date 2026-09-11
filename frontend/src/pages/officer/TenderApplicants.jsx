import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function TenderApplicants() {
  const { id: tenderId } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [tender, setTender] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadApplicants() {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/api/tenders/${tenderId}/applications`);
        const data = await res.json();
        if (res.ok) {
          setTender(data.tender);
          // Backend guarantees descending compliance score order
          setApplicants(data.applicants || []);
        } else {
          throw new Error(data.error || "Failed to load tender applicants.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadApplicants();
  }, [tenderId]);

  return (
    <div className="dashboard-container">
      <div className="breadcrumb-nav">
        <Link to="/officer/dashboard">&larr; Officer Cockpit</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/officer/tenders">Tenders</Link>
        <span className="breadcrumb-separator">/</span>
        <span>{tenderId} Applicants</span>
      </div>

      {/* Tender Header Banner */}
      <div className="tender-applicant-header">
        <div>
          <div className="eyebrow">Tender Applicant Evaluation</div>
          <h1>{tender?.title || tenderId}</h1>
          <p className="dashboard-subtitle">
            Reference: <strong>{tenderId}</strong> &bull; Category: <strong>{tender?.category || "General"}</strong>
          </p>
        </div>
        <div className="applicant-counter-badge">
          <div className="counter-num">{applicants.length}</div>
          <div className="counter-label">Verified Applicants</div>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Ranked Applicant Pipeline</h2>
            <p className="section-subtext">
              Showing <strong>only bidders who submitted an application</strong> for this tender, ordered strictly by <strong>Compliance Score (Highest First)</strong>.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading applicants and evaluating scores...</div>
        ) : applicants.length === 0 ? (
          <div className="empty-state-card">
            <h3>No Bidders Have Applied Yet</h3>
            <p>Once enterprise bidders satisfy all mandatory document requirements and apply, their scores will be ranked here.</p>
          </div>
        ) : (
          <div className="tenders-table-card">
            <table className="gem-table">
              <thead>
                <tr>
                  <th style={{ width: "80px" }}>Rank</th>
                  <th>Enterprise / Bidder</th>
                  <th>Compliance Score</th>
                  <th>Risk Level</th>
                  <th>Submitted Docs</th>
                  <th>Application Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((app) => (
                  <tr key={app.id} className={`rank-row rank-${app.rank}`}>
                    <td>
                      <span className={`rank-badge rank-badge-${app.rank <= 3 ? app.rank : "default"}`}>
                        #{app.rank}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{app.company_name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        ID: {app.bidder_id} &bull; Contact: {app.contact_person} ({app.phone})
                      </div>
                    </td>
                    <td>
                      <div className="score-display-cell">
                        <div className="score-number">{app.compliance_score} <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/ 100</span></div>
                        <div className="score-bar-bg">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${app.compliance_score}%`,
                              backgroundColor: app.compliance_score >= 85 ? "#08724b" : app.compliance_score >= 60 ? "#d97706" : "#dc2626",
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge risk-${app.risk_level?.toLowerCase()}`}>
                        {app.risk_level}
                      </span>
                    </td>
                    <td>
                      <span className="doc-count-pill">{app.submitted_documents_count} Files</span>
                    </td>
                    <td>
                      <span className={`badge status-${app.status}`}>
                        {app.status?.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/officer/applications/${app.id}`)}
                        className="btn-primary"
                        style={{ fontSize: "0.85rem", padding: "0.45rem 0.85rem" }}
                      >
                        Review Application &rarr;
                      </button>
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
