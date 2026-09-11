import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import CreateTenderModal from "./CreateTenderModal";

export default function OfficerTenders() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadTenders = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/officer/tenders");
      const data = await res.json();
      if (res.ok) {
        setTenders(data.tenders || []);
      } else {
        throw new Error(data.error || "Failed to load tenders");
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
          <div className="eyebrow">Tender Procurement Directory</div>
          <h1>Manage Procurement Tenders</h1>
          <p className="dashboard-subtitle">
            Create and manage public procurement tenders with tailored statutory compliance checks.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          + Create New Tender
        </button>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      <div className="search-filter-bar">
        <input
          type="text"
          placeholder="Search by tender reference ID, title, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading tenders...</div>
      ) : tenders.length === 0 ? (
        <div className="empty-state-card">
          <h3>No Tenders Created Yet</h3>
          <p>You have not published any procurement tenders yet.</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ marginTop: "1rem" }}>
            + Create Your First Tender
          </button>
        </div>
      ) : filteredTenders.length === 0 ? (
        <div className="empty-state-card">
          <h3>No Matching Tenders Found</h3>
          <p>No tenders match your search criteria.</p>
        </div>
      ) : (
        <div className="tenders-grid">
          {filteredTenders.map((tender) => {
            const summary = tender.applications_summary || { total: 0 };
            return (
              <div key={tender.tender_id} className="tender-card-item">
                <div className="tender-card-header">
                  <span className="tender-id-badge">{tender.tender_id}</span>
                  <span className="category-pill">{tender.category}</span>
                </div>
                <h3 className="tender-card-title">{tender.title}</h3>
                <p className="tender-card-desc">{tender.description}</p>

                <div className="tender-card-meta">
                  <div>
                    <span className="meta-label">Mandatory Checks:</span>
                    <div className="checks-tags-group" style={{ marginTop: "0.3rem" }}>
                      {tender.mandatory_checks?.map((chk) => (
                        <span key={chk} className="check-tag">{chk}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="tender-card-footer">
                  <div className="applicant-stat">
                    <strong>{summary.total}</strong> Applicant{summary.total === 1 ? "" : "s"}
                  </div>
                  <button
                    onClick={() => navigate(`/officer/tenders/${encodeURIComponent(tender.tender_id)}`)}
                    className="btn-primary"
                    style={{ fontSize: "0.85rem", padding: "0.45rem 0.85rem" }}
                  >
                    View Applicants &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTenderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => loadTenders()}
      />
    </div>
  );
}
