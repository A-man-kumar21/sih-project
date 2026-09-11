import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function DeleteTenderModal({
  isOpen,
  tender,
  onClose,
  onDeleted,
}) {
  const { authFetch } = useAuth();
  const [appCount, setAppCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && tender?.tender_id) {
      setDeleting(false);
      setDeleted(false);
      setError(null);

      // Initial estimate from tender object if available
      const initialCount =
        tender.applications_summary?.total ??
        tender.applications_count ??
        0;
      setAppCount(initialCount);

      // Dynamically fetch live application count from backend
      setLoadingCount(true);
      authFetch(`/api/tenders/${encodeURIComponent(tender.tender_id)}/applications`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Could not fetch applicants");
        })
        .then((data) => {
          const liveCount =
            data.total_applicants ??
            (Array.isArray(data.applicants) ? data.applicants.length : initialCount);
          setAppCount(liveCount);
        })
        .catch(() => {
          // Keep existing initialCount if live count fetch fails
        })
        .finally(() => {
          setLoadingCount(false);
        });
    }
  }, [isOpen, tender, authFetch]);

  if (!isOpen || !tender) return null;

  const hasApplications = appCount > 0;

  const handleConfirmDelete = async () => {
    if (deleting || deleted) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await authFetch(`/api/tenders/${encodeURIComponent(tender.tender_id)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to delete tender.");
      }

      setDeleted(true);
      // Brief pause so user sees "Tender deleted successfully."
      setTimeout(() => {
        if (onDeleted) {
          onDeleted(tender.tender_id, data);
        }
        onClose();
      }, 500);
    } catch (err) {
      setDeleting(false);
      setError(err.message || "Unable to delete tender.");
    }
  };

  return (
    <div className="modal-overlay" onClick={!deleting ? onClose : undefined}>
      <div
        className="modal-card modal-card-delete"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: hasApplications ? "580px" : "480px" }}
      >
        <div className="modal-header">
          <h2 style={{ color: "#0f172a", fontSize: "1.25rem", fontWeight: 700 }}>
            {hasApplications ? "Delete Tender & Applications?" : "Delete Tender?"}
          </h2>
          <button
            onClick={onClose}
            className="btn-close"
            disabled={deleting}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Tender Reference Identification */}
        <div className="delete-tender-info">
          <div style={{ marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
              Tender Reference:
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <strong className="tender-id-badge" style={{ fontSize: "1rem", padding: "0.3rem 0.6rem" }}>
              {tender.tender_id}
            </strong>
            {tender.category && (
              <span className="category-pill">{tender.category}</span>
            )}
          </div>
          {tender.title && (
            <div style={{ marginTop: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>
              {tender.title}
            </div>
          )}
        </div>

        {/* Dynamic Applications Breakdown */}
        {loadingCount ? (
          <div style={{ padding: "1rem 0", color: "#64748b", fontSize: "0.85rem" }}>
            Checking application records...
          </div>
        ) : hasApplications ? (
          <div className="tender-has-apps-box" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#991b1b" }}>
                Applications:
              </span>
              <span
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "0.15rem 0.55rem",
                  borderRadius: "999px",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                }}
              >
                {appCount}
              </span>
              <span style={{ fontSize: "0.85rem", color: "#475569" }}>
                ({appCount === 1 ? "1 application will be removed" : `${appCount} applications will be removed`})
              </span>
            </div>

            <div className="delete-scope-container">
              {/* WILL BE REMOVED */}
              <div className="scope-group remove-group">
                <div className="scope-heading text-danger">WILL BE REMOVED:</div>
                <ul className="scope-list">
                  <li>✓ This tender</li>
                  <li>✓ All applications submitted to this tender ({appCount})</li>
                  <li>✓ Tender-specific compliance/evaluation records</li>
                  <li>✓ Tender-specific documents/data that belong exclusively to this tender, if applicable</li>
                </ul>
              </div>

              {/* WILL NOT BE REMOVED */}
              <div className="scope-group keep-group">
                <div className="scope-heading text-safe">WILL NOT BE REMOVED:</div>
                <ul className="scope-list">
                  <li>✓ Bidder accounts</li>
                  <li>✓ Bidder Enterprise Profiles</li>
                  <li>✓ Bidder Document Vault</li>
                  <li>✓ Bidder credentials</li>
                  <li>✓ Applications submitted to other tenders</li>
                  <li>✓ Other tenders</li>
                  <li>✓ Unrelated compliance records</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.85rem 1rem",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <p style={{ margin: 0, color: "#334155", fontSize: "0.9rem", fontWeight: 500 }}>
              "This tender has no applications."
            </p>
          </div>
        )}

        {/* Non-reversible Warning */}
        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.75rem 1rem",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "6px",
            color: "#9f1239",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          "This action cannot be undone."
        </div>

        {/* Error message */}
        {error && (
          <div className="alert-box alert-error" style={{ marginTop: "1rem" }}>
            Unable to delete tender: {error}
          </div>
        )}

        {/* Actions Footer */}
        <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="btn-destructive"
            disabled={deleting || deleted}
          >
            {deleted
              ? "Tender deleted successfully."
              : deleting
              ? "Deleting..."
              : hasApplications
              ? "Delete Tender & Applications"
              : "Delete Tender"}
          </button>
        </div>
      </div>
    </div>
  );
}
