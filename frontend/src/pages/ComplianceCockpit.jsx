import { useEffect, useMemo, useState } from "react";
import ComplianceSummary from "../components/compliance/ComplianceSummary";
import StatutoryCheckCard from "../components/compliance/StatutoryCheckCard";

const ALL_SOURCES = ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"];

const SOURCE_LABELS = {
  udyam: "Udyam / MSME Registration",
  gstn: "GSTN Registration & Tax Filing",
  pan_it: "PAN & Income Tax Compliance",
  epfo_esic: "EPFO & ESIC Labor Compliance",
  digilocker: "DigiLocker Verified Credentials",
  blacklist: "Debarment & Blacklist Clearance",
};




async function api(url, options = {}) {
  const token = localStorage.getItem("gem_token") || localStorage.getItem("gem_auth_token");
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || body.detail || "Request failed");
  return body;
}

const Risk = ({ value }) => <span className={`badge risk-${value?.toLowerCase()}`}>{value}</span>;
const Status = ({ value }) => {
  const displayVal =
    value === "compliant"
      ? "Found / Verified"
      : value === "not_found"
      ? "Not Found"
      : value === "non_compliant"
      ? "Non-Compliant"
      : value?.replaceAll("_", " ");
  return <span className={`badge status-${value}`}>{displayVal}</span>;
};

export default function ComplianceCockpit() {
  const [currentView, setCurrentView] = useState("detail"); // "overview" | "detail"
  const [bidders, setBidders] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [selectedBidderId, setSelectedBidderId] = useState("");
  const [selectedTenderId, setSelectedTenderId] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [trail, setTrail] = useState([]);
  const [decision, setDecision] = useState();
  const [decisionSuccessMsg, setDecisionSuccessMsg] = useState(null);
  const [decisionErrorMsg, setDecisionErrorMsg] = useState(null);
  const [error, setError] = useState();
  const [tenderSuccessMsg, setTenderSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);

  // Overview dashboard data
  const [overviewData, setOverviewData] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Modals state
  const [showBidderModal, setShowBidderModal] = useState(false);
  const [showTenderModal, setShowTenderModal] = useState(false);

  // PDF extraction states
  const [extractingBidder, setExtractingBidder] = useState(false);
  const [bidderExtractMsg, setBidderExtractMsg] = useState(null);
  const [bidderExtractStatus, setBidderExtractStatus] = useState(null);

  const [extractingTender, setExtractingTender] = useState(false);
  const [tenderExtractMsg, setTenderExtractMsg] = useState(null);
  const [tenderExtractStatus, setTenderExtractStatus] = useState(null);

  // Forms state
  const [bidderForm, setBidderForm] = useState({
    bidder_id: "",
    company_name: "",
    udyam_number: "",
    gstin: "",
    pan: "",
    epfo_esic_number: "",
  });

  const [tenderForm, setTenderForm] = useState({
    tender_id: "",
    title: "",
    category: "Goods",
    description: "",
    mandatory_checks: ["udyam", "gstn", "pan_it", "blacklist"],
  });

  const activeTender = useMemo(() => {
    return tenders.find((t) => t.tender_id === selectedTenderId) || tenders[0] || null;
  }, [tenders, selectedTenderId]);

  const activeBidder = useMemo(() => {
    return bidders.find((b) => b.bidder_id === selectedBidderId) || bidders[0];
  }, [bidders, selectedBidderId]);

  // Load Overview Data from backend and update applicants for the active tender
  async function loadOverview(tenderId = selectedTenderId) {
    try {
      setLoadingOverview(true);
      const data = await api(`/api/overview?tender_id=${encodeURIComponent(tenderId)}`);
      setOverviewData(data);
      const tenderApplicants = data.bidders || [];
      setBidders(tenderApplicants);
      return tenderApplicants;
    } catch (err) {
      console.warn("Could not load overview:", err.message);
      return [];
    } finally {
      setLoadingOverview(false);
    }
  }

  // Execute verification for a specific bidder + tender combination
  async function runVerification(bidderId, tenderId, tendersList = tenders, simFail = simulateFailure) {
    if (!bidderId) {
      setAssessment(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setDecision(null);
      setDecisionSuccessMsg(null);
      setDecisionErrorMsg(null);

      const tender = tendersList.find((t) => t.tender_id === tenderId) || tendersList[0];
      const requiredChecks = tender ? tender.mandatory_checks : ALL_SOURCES;

      const result = await api("/api/compliance/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bidder_id: bidderId,
          tender_id: tenderId,
          required_checks: requiredChecks,
          simulate_llm_failure: simFail,
        }),
      });

      setAssessment(result);

      // Load audit trail for this bidder
      try {
        const auditTrail = await api(`/api/audit/${bidderId}`);
        setTrail(auditTrail);
      } catch (auditErr) {
        console.warn("Could not load audit trail:", auditErr.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        let loadedTenders = [];

        try {
          const res = await api("/api/officer/tenders");
          if (res && Array.isArray(res.tenders)) {
            loadedTenders = res.tenders;
            setTenders(res.tenders);
          }
        } catch (e) {
          console.warn("Could not load officer tenders:", e.message);
        }

        if (loadedTenders.length > 0) {
          const initialTenderId = loadedTenders[0].tender_id;
          setSelectedTenderId(initialTenderId);

          const applicants = await loadOverview(initialTenderId);
          if (applicants && applicants.length > 0) {
            const initialBidderId = applicants[0].bidder_id;
            setSelectedBidderId(initialBidderId);
            await runVerification(initialBidderId, initialTenderId, loadedTenders, false);
          } else {
            setSelectedBidderId("");
            setAssessment(null);
          }
        } else {
          setSelectedTenderId("");
          setSelectedBidderId("");
          setAssessment(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function handleSelectBidder(bidderId) {
    setSelectedBidderId(bidderId);
    runVerification(bidderId, selectedTenderId, tenders, simulateFailure);
  }

  async function handleSelectTender(tenderId) {
    setSelectedTenderId(tenderId);
    const applicants = await loadOverview(tenderId);
    if (applicants && applicants.length > 0) {
      const nextBidderId = applicants[0].bidder_id;
      setSelectedBidderId(nextBidderId);
      runVerification(nextBidderId, tenderId, tenders, simulateFailure);
    } else {
      setSelectedBidderId("");
      setAssessment(null);
      setTrail([]);
    }
  }

  // FEATURE 1: Delete Bidder (Removes from active selectable list only, preserves MongoDB audit logs)
  async function handleDeleteBidder(bidderId, e) {
    e?.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to remove "${bidderId}" from the active bidders list?\n\n` +
      `Past scoring evaluations and recorded officer decisions in MongoDB will remain fully intact and queryable.`
    );
    if (!confirmed) return;

    try {
      setError(null);
      await api(`/api/bidders/${bidderId}`, { method: "DELETE" });

      const updatedBidders = await api("/api/bidders");
      setBidders(updatedBidders);

      // If the deleted bidder was selected, fall back to first remaining bidder or empty state
      if (selectedBidderId === bidderId) {
        const nextId = updatedBidders[0]?.bidder_id || null;
        setSelectedBidderId(nextId);
        if (nextId) {
          runVerification(nextId, selectedTenderId, tenders, simulateFailure);
        } else {
          setAssessment(null);
        }
      }
      loadOverview(selectedTenderId);
    } catch (err) {
      alert(`Could not delete bidder: ${err.message}`);
    }
  }

  // Delete Tender — encodes tenderId so IDs containing "/" (e.g. GEM/2026/A/6766)
  // are sent as a single encoded URL segment (GEM%2F2026%2FA%2F6766) which the
  // backend regex route decodes back to the full ID.
  async function handleDeleteTender(tenderId, e) {
    e?.stopPropagation();
    const confirmed = window.confirm(
      `Delete Tender?\n\n"${tenderId}"\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setError(null);
      setTenderSuccessMsg(null);
      // encodeURIComponent ensures slashes in the ID become %2F — one URL segment
      const result = await api(`/api/tenders/${encodeURIComponent(tenderId)}`, { method: "DELETE" });
      setTenderSuccessMsg(result.message || `Tender '${tenderId}' deleted successfully.`);

      // Reload tender list from backend (authoritative)
      try {
        const res = await api("/api/officer/tenders");
        const updatedTenders = res.tenders || [];
        setTenders(updatedTenders);

        if (selectedTenderId === tenderId) {
          const nextTenderId = updatedTenders[0]?.tender_id || null;
          setSelectedTenderId(nextTenderId || "");
          if (nextTenderId && selectedBidderId) {
            runVerification(selectedBidderId, nextTenderId, updatedTenders, simulateFailure);
            loadOverview(nextTenderId);
          } else {
            setAssessment(null);
            setBidders([]);
          }
        } else {
          loadOverview(selectedTenderId);
        }
      } catch (_) {
        // fallback: remove locally if reload fails
        setTenders((prev) => prev.filter((t) => t.tender_id !== tenderId));
      }
    } catch (err) {
      setError(`Could not delete tender: ${err.message}`);
    }
  }


  // Handle PDF upload for Bidder Registration
  async function handleBidderPdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractingBidder(true);
    setBidderExtractMsg(null);
    setBidderExtractStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract/bidder-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.extracted) {
        setBidderForm((prev) => ({
          ...prev,
          company_name: data.extracted.company_name || prev.company_name,
          udyam_number: data.extracted.udyam_number || prev.udyam_number,
          gstin: data.extracted.gstin || prev.gstin,
          pan: data.extracted.pan || prev.pan,
          epfo_esic_number: data.extracted.epfo_esic_number || prev.epfo_esic_number,
          bidder_id: prev.bidder_id || (data.extracted.pan ? `BIDDER-${data.extracted.pan.slice(0, 5)}` : prev.bidder_id),
        }));
        const sourceLabel = data.source === "gemini_llm" ? "Gemini AI" : "Document Parser";
        setBidderExtractMsg(`Auto-extracted candidate fields from "${file.name}" via ${sourceLabel}. Please review and edit before saving.`);
        setBidderExtractStatus("success");
      } else {
        setBidderExtractMsg(data.message || "Couldn't auto-extract, please fill manually.");
        setBidderExtractStatus("error");
      }
    } catch (err) {
      setBidderExtractMsg("Couldn't auto-extract, please fill manually.");
      setBidderExtractStatus("error");
    } finally {
      setExtractingBidder(false);
      e.target.value = "";
    }
  }

  // Handle PDF upload for Tender Creation
  async function handleTenderPdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractingTender(true);
    setTenderExtractMsg(null);
    setTenderExtractStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract/tender-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.extracted) {
        setTenderForm((prev) => ({
          ...prev,
          tender_id: data.extracted.tender_id || prev.tender_id,
          title: data.extracted.title || prev.title,
          category: data.extracted.category || prev.category,
          mandatory_checks: data.extracted.mandatory_checks?.length ? data.extracted.mandatory_checks : prev.mandatory_checks,
        }));
        const sourceLabel = data.source === "gemini_llm" ? "Gemini AI" : "Document Parser";
        setTenderExtractMsg(`Auto-extracted tender parameters from "${file.name}" via ${sourceLabel}. Please review and edit before creating.`);
        setTenderExtractStatus("success");
      } else {
        setTenderExtractMsg(data.message || "Couldn't auto-extract, please fill manually.");
        setTenderExtractStatus("error");
      }
    } catch (err) {
      setTenderExtractMsg("Couldn't auto-extract, please fill manually.");
      setTenderExtractStatus("error");
    } finally {
      setExtractingTender(false);
      e.target.value = "";
    }
  }

  // Handle Register Bidder form submission
  async function handleRegisterBidderSubmit(e) {
    e.preventDefault();
    if (!bidderForm.bidder_id.trim() || !bidderForm.company_name.trim()) {
      alert("Bidder ID and Company Name are required.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await api("/api/bidders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bidderForm),
      });

      const newId = res.bidder.bidder_id;
      const updatedBidders = await api("/api/bidders");
      setBidders(updatedBidders);
      setSelectedBidderId(newId);
      setShowBidderModal(false);

      setBidderForm({
        bidder_id: "",
        company_name: "",
        udyam_number: "",
        gstin: "",
        pan: "",
        epfo_esic_number: "",
      });
      setBidderExtractMsg(null);
      setBidderExtractStatus(null);

      await runVerification(newId, selectedTenderId, tenders, simulateFailure);
      loadOverview(selectedTenderId);
    } catch (err) {
      setError(`Failed to register bidder: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Handle Register Tender form submission
  async function handleRegisterTenderSubmit(e) {
    e.preventDefault();
    if (!tenderForm.tender_id.trim()) {
      alert("Tender ID is required.");
      return;
    }
    if (tenderForm.mandatory_checks.length === 0) {
      alert("Please select at least one mandatory compliance check for this tender.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await api("/api/tenders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...tenderForm,
          title: tenderForm.title || `Tender ${tenderForm.tender_id}`,
        }),
      });

      const newTenderId = res.tender.tender_id;
      const resTenders = await api("/api/officer/tenders");
      const updatedTenders = resTenders.tenders || [];
      setTenders(updatedTenders);
      setSelectedTenderId(newTenderId);
      setShowTenderModal(false);

      setTenderForm({
        tender_id: "",
        title: "",
        category: "Goods",
        description: "",
        mandatory_checks: ["udyam", "gstn", "pan_it", "blacklist"],
      });
      setTenderExtractMsg(null);
      setTenderExtractStatus(null);

      await runVerification(selectedBidderId, newTenderId, updatedTenders, simulateFailure);
      loadOverview(newTenderId);
    } catch (err) {
      setError(`Failed to create tender: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // FEATURE 2: Make Approve / Reject / Request More Info functional & lockable
  async function submitDecision(officer_decision) {
    try {
      setSaving(true);
      setDecisionErrorMsg(null);
      setDecisionSuccessMsg(null);

      const saved = await api("/api/audit/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bidder_id: selectedBidderId,
          tender_id: selectedTenderId,
          decision: officer_decision,
          officer_id: "OFFICER-DEMO-001",
          timestamp: assessment?.audit_log_entry?.timestamp,
        }),
      });

      setDecision(saved);
      setDecisionSuccessMsg(`Decision '${officer_decision.replaceAll("_", " ")}' successfully recorded by OFFICER-DEMO-001 in MongoDB.`);

      // Update audit trail immediately
      const updatedTrail = await api(`/api/audit/${selectedBidderId}`);
      setTrail(updatedTrail);

      // Refresh overview data
      loadOverview(selectedTenderId);
    } catch (err) {
      setDecisionErrorMsg(`Failed to record decision: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Find recorded decision for current evaluation or latest run
  const recorded = useMemo(() => {
    if (decision && decision.bidder_id === selectedBidderId) {
      return decision;
    }
    const matchingCurrentRun = trail.find((entry) => entry.timestamp === assessment?.audit_log_entry?.timestamp);
    if (matchingCurrentRun?.officer_decision) {
      return matchingCurrentRun;
    }
    const latestForBidder = trail.find((entry) => entry.officer_decision);
    if (latestForBidder) {
      return latestForBidder;
    }
    return null;
  }, [decision, trail, selectedBidderId, assessment]);

  const isDecisionLocked = Boolean(recorded?.officer_decision);

  return (
    <main className="app-shell">
      <header>
        <div>
          <p className="eyebrow">Public Procurement Governance · GeM Operations</p>
          <h1>TenderFlow — Compliance Verification Cockpit</h1>
        </div>
      </header>

      {/* FEATURE 3: Top Navigation View Tabs */}
      <nav className="view-nav">
        <button
          className={`nav-tab ${currentView === "overview" ? "active" : ""}`}
          onClick={() => {
            setCurrentView("overview");
            loadOverview(selectedTenderId);
          }}
        >
          📊 Applicants Overview ({bidders.length})
        </button>
        <button
          className={`nav-tab ${currentView === "detail" ? "active" : ""}`}
          onClick={() => setCurrentView("detail")}
        >
          🔍 Detailed Evaluation {selectedBidderId ? `(${selectedBidderId})` : ""}
        </button>
      </nav>

      {error && <div className="alert-box alert-error" style={{ margin: "1rem 0" }}>{error}</div>}
      {tenderSuccessMsg && <div className="alert-box alert-success" style={{ margin: "1rem 0" }}>{tenderSuccessMsg}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
          Loading AI Evaluation Cockpit...
        </div>
      ) : tenders.length === 0 ? (
        <div className="empty-state-card" style={{ padding: "3.5rem 2rem", textAlign: "center", background: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0", margin: "2rem 0" }}>
          <div style={{ fontSize: "2.8rem", marginBottom: "1rem" }}>📋</div>
          <h2 style={{ fontSize: "1.4rem", color: "#1e293b", marginBottom: "0.5rem" }}>No Tenders Created Yet</h2>
          <p style={{ color: "#64748b", maxWidth: "520px", margin: "0 auto 1.5rem", lineHeight: "1.6" }}>
            You do not have any active procurement tenders in your cockpit. Create your first tender to establish mandatory statutory compliance requirements and begin evaluating bidder submissions.
          </p>
          <button onClick={() => setShowTenderModal(true)} className="btn-primary" style={{ fontSize: "1rem", padding: "0.65rem 1.4rem" }}>
            + Create New Tender
          </button>
        </div>
      ) : (
        <>
          {/* Active Tender Selector Bar */}
          {/* Active Tender Selector Bar & Complete Tender Information Panel */}
          <section className="tender-selector-card">
        <div className="tender-selector-top">
          <div className="tender-selector-group">
            <label htmlFor="tender-select">Active Tender:</label>
            <select
              id="tender-select"
              className="tender-select"
              value={selectedTenderId || ""}
              onChange={(e) => handleSelectTender(e.target.value)}
            >
              {tenders.map((t) => (
                <option key={t.tender_id} value={t.tender_id}>
                  {t.tender_id} — {t.title} ({t.category})
                </option>
              ))}
            </select>
            {activeTender && (
              <button
                className="btn-delete-tender"
                title="Delete this tender from active list (preserves audit records)"
                onClick={(e) => handleDeleteTender(activeTender.tender_id, e)}
              >
                🗑 Delete Tender
              </button>
            )}
            <span className="tender-badge-pill">
              {activeTender?.mandatory_checks?.length || 0} of {ALL_SOURCES.length} Checks Mandatory
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label className="toggle-simulate" title="Simulate an LLM API failure to verify the deterministic template fallback">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => {
                  const newVal = e.target.checked;
                  setSimulateFailure(newVal);
                  runVerification(selectedBidderId, selectedTenderId, tenders, newVal);
                }}
              />
              <span>Simulate LLM API Failure</span>
            </label>
            <button
              className="btn-secondary"
              onClick={() => {
                runVerification(selectedBidderId, selectedTenderId, tenders, simulateFailure);
                loadOverview(selectedTenderId);
              }}
              disabled={loading}
            >
              {loading ? "Evaluating…" : "Re-evaluate"}
            </button>
          </div>
        </div>

        {/* ISSUE 3: Full Tender Information Panel */}
        {activeTender && (
          <div className="tender-info-panel">
            <div className="tender-info-header">
              <div className="tender-meta-left">
                <span className="tender-info-id">{activeTender.tender_id}</span>
                <h3 className="tender-info-title">{activeTender.title}</h3>
              </div>
              <div className="tender-meta-right">
                <span className="tender-info-category">📂 Procurement Category: <strong>{activeTender.category}</strong></span>
                <span className="tender-info-counts">
                  🎯 <strong>{activeTender.mandatory_checks?.length || 0}</strong> Mandatory · <strong>{ALL_SOURCES.length - (activeTender.mandatory_checks?.length || 0)}</strong> Informational
                </span>
              </div>
            </div>

            <p className="tender-info-description">
              <strong>Tender Scope & Description:</strong> {activeTender.description || "Standard procurement compliance rules applied."}
            </p>

            <div className="tender-sources-grid">
              <span className="tender-sources-heading">Compliance Sources Applicability (Mandatory vs Informational):</span>
              <div className="sources-badges-container">
                {ALL_SOURCES.map((sourceKey) => {
                  const isMandatory = activeTender.mandatory_checks?.includes(sourceKey);
                  return (
                    <div
                      key={sourceKey}
                      className={`tender-source-pill ${isMandatory ? "is-mandatory" : "is-informational"}`}
                    >
                      <span className="source-pill-name">{SOURCE_LABELS[sourceKey] || sourceKey}</span>
                      <span className={`badge ${isMandatory ? "tag-mandatory" : "tag-optional"}`}>
                        {isMandatory ? "Mandatory (Scored)" : "Informational (Excluded)"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      {/* =========================================================================
          VIEW 1: OVERVIEW DASHBOARD (FEATURE 3)
         ========================================================================= */}
      {currentView === "overview" && (
        <section className="overview-card">
          <div className="overview-header">
            <div>
              <p className="eyebrow">Executive Procurement Cockpit</p>
              <h2>Applicants Overview · {activeTender?.title || selectedTenderId}</h2>
              <small style={{ color: "#64748b" }}>
                Tender ID: {activeTender?.tender_id} · Category: {activeTender?.category} · Mandatory Checks:{" "}
                {activeTender?.mandatory_checks?.length} of 6
              </small>
            </div>
            <button
              className="btn-secondary"
              onClick={() => loadOverview(selectedTenderId)}
              disabled={loadingOverview}
            >
              {loadingOverview ? "Refreshing…" : "Refresh Overview"}
            </button>
          </div>

          {/* Aggregate Metric Cards */}
          <div className="metrics-grid">
            <div className="metric-box">
              <span className="metric-label">Total Applicants</span>
              <span className="metric-val">{overviewData?.aggregates?.total_bidders ?? bidders.length}</span>
              <span className="metric-sub">Submitted for this tender</span>
            </div>
            <div className="metric-box metric-low">
              <span className="metric-label">Low Risk</span>
              <span className="metric-val">{overviewData?.aggregates?.low_risk ?? 0}</span>
              <span className="metric-sub">Eligible for fast-track</span>
            </div>
            <div className="metric-box metric-medium">
              <span className="metric-label">Medium Risk</span>
              <span className="metric-val">{overviewData?.aggregates?.medium_risk ?? 0}</span>
              <span className="metric-sub">Manual review required</span>
            </div>
            <div className="metric-box metric-high">
              <span className="metric-label">High Risk / Knock-out</span>
              <span className="metric-val">{overviewData?.aggregates?.high_risk ?? 0}</span>
              <span className="metric-sub">Defects / Blacklisted</span>
            </div>
            <div className="metric-box metric-pending">
              <span className="metric-label">Awaiting Decision</span>
              <span className="metric-val">{overviewData?.aggregates?.pending_decision ?? 0}</span>
              <span className="metric-sub">Pending officer sign-off</span>
            </div>
          </div>

          {/* Bidders Summary Table */}
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Bidder ID & Company Legal Name</th>
                  <th>Mandatory Checks</th>
                  <th>Compliance Score</th>
                  <th>Risk Level</th>
                  <th>Officer Decision</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overviewData?.bidders && overviewData.bidders.length > 0 ? (
                  overviewData.bidders.map((b) => (
                    <tr key={b.bidder_id}>
                      <td>
                        <strong>{b.bidder_id}</strong>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{b.display_name}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.82rem", color: "#334155" }}>
                          {b.checks_summary?.compliant_mandatory || 0} / {b.checks_summary?.mandatory || 0} passed
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: "1.1rem" }}>{b.compliance_score}</strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}> / 100</span>
                      </td>
                      <td>
                        <Risk value={b.risk_level} />
                      </td>
                      <td>
                        {b.officer_decision ? (
                          <span
                            className={`badge ${
                              b.officer_decision === "approve"
                                ? "status-pill-approved"
                                : b.officer_decision === "reject"
                                ? "status-pill-rejected"
                                : "status-pill-request_more_info"
                            }`}
                          >
                            {b.officer_decision.replaceAll("_", " ")}
                          </span>
                        ) : (
                          <span className="badge status-pill-pending">Pending Review</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            className="table-btn-view"
                            onClick={() => {
                              setSelectedBidderId(b.bidder_id);
                              setCurrentView("detail");
                              runVerification(b.bidder_id, selectedTenderId, tenders, simulateFailure);
                            }}
                          >
                            View Details →
                          </button>
                          <button
                            className="btn-delete-item"
                            title="Remove bidder from active list"
                            onClick={(e) => handleDeleteBidder(b.bidder_id, e)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                      No applications received yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =========================================================================
          VIEW 2: DETAILED BID EVALUATION (EXISTING VIEW)
         ========================================================================= */}
      {currentView === "detail" && (
        <div className="layout">
          {/* Bidder Selection Sidebar with Delete Button (FEATURE 1) */}
          <aside>
            <h2>
              <span>Applicants ({bidders.length})</span>
            </h2>
            {bidders.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: "#64748b" }}>No applications received yet.</p>
            )}
            {bidders.map((item) => (
              <div key={item.bidder_id} className="bidder-row">
                <button
                  className={`bidder ${selectedBidderId === item.bidder_id ? "selected" : ""}`}
                  onClick={() => handleSelectBidder(item.bidder_id)}
                >
                  <span>
                    <strong>{item.bidder_id}</strong>
                  </span>
                  <span className="bidder-company-sub">{item.display_name}</span>
                </button>
                <button
                  className="btn-delete-item"
                  title={`Delete ${item.bidder_id} from active list (preserves past audit trail)`}
                  onClick={(e) => handleDeleteBidder(item.bidder_id, e)}
                >
                  ✕
                </button>
              </div>
            ))}
          </aside>

          {/* Verification Detail View */}
          {assessment ? (
            <section className="detail">
              {/* Top Compliance Summary (Section 2) */}
              <ComplianceSummary
                score={assessment.compliance_score}
                riskLevel={assessment.risk_level}
                checks={assessment.checks || []}
                companyName={activeBidder?.display_name || assessment.bidder_id}
                bidderId={assessment.bidder_id}
                tenderId={assessment.tender_id || selectedTenderId}
              />

              {/* AI Advisory — Decision Support (Section 15) */}
              {assessment.llm_briefing && (
                <div className="ai-advisory-section">
                  <div className="ai-advisory-header">
                    <div className="ai-advisory-title-group">
                      <span className="ai-advisory-subtitle">Executive Decision Support</span>
                      <h4>AI Advisory — Decision Support</h4>
                    </div>
                    <span className="ai-advisory-model-badge">
                      {assessment.llm_briefing.is_fallback
                        ? "Deterministic Fallback Engine"
                        : `AI: ${assessment.llm_briefing.model || "Gemini 1.5 Flash"}`}
                    </span>
                  </div>
                  <p className="ai-advisory-text">{assessment.llm_briefing.text}</p>
                  {assessment.llm_briefing.notice && (
                    <small className="briefing-notice" style={{ display: "block", marginBottom: "0.5rem" }}>
                      Notice: {assessment.llm_briefing.notice}
                    </small>
                  )}
                  <div className="ai-advisory-disclaimer">
                    <span className="disclaimer-icon">ℹ️</span>
                    <span>
                      <strong>Decision Authority:</strong> AI output is advisory only. Final procurement decisions remain with the authorized Procurement Officer via the governance actions below.
                    </span>
                  </div>
                </div>
              )}

              {/* Statutory Verification Breakdown (Sections 1, 3, 4, 5, 6, 7-14, 16, 17, 18, 19, 21, 22) */}
              <section className="card" style={{ padding: "1.5rem" }}>
                <div className="section-header" style={{ marginBottom: "1.25rem" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      Statutory Verification Breakdown ({assessment.checks.length})
                    </h3>
                    <p className="section-subtext" style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                      Detailed breakdown of deterministic statutory compliance verification across official registries.
                    </p>
                  </div>
                </div>

                <div className="statutory-verification-grid">
                  {assessment.checks.map((check) => (
                    <StatutoryCheckCard key={check.source || check.check_type} check={check} />
                  ))}
                </div>
              </section>

              {/* Pending Manual Review */}
              <section className="card manual">
                <h3>Pending Manual Review (Tender-Mandatory Checks)</h3>
                {assessment.pending_manual_review?.length ? (
                  <ul>
                    {assessment.pending_manual_review.map((source) => (
                      <li key={source}>
                        <strong>{SOURCE_LABELS[source] || source}</strong> requires physical verification of certificate
                        before award. Source registry returned <em>NOT_FOUND</em>.
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No mandatory checks require manual verification for this tender.</p>
                )}
              </section>

              {/* AI Recommendations */}
              <section className="card">
                <h3>Automated Compliance Directives</h3>
                <ul>
                  {assessment.recommendations?.map((text, idx) => (
                    <li key={idx}>{text}</li>
                  ))}
                </ul>
              </section>

              {/* FEATURE 2: Procurement Officer Decision Panel with Lockable State */}
              <section className="card">
                <p className="eyebrow">Human-in-the-Loop Sign-Off</p>
                <h3>Record Procurement Officer Decision</h3>

                {/* State Banner: Decision locked vs pending */}
                {isDecisionLocked ? (
                  <div className={`decision-locked-banner ${recorded.officer_decision}`}>
                    <div>
                      <span className="decision-badge">🔒 Decision Recorded: </span>
                      <strong style={{ fontSize: "1.05rem", textTransform: "capitalize" }}>
                        {recorded.officer_decision.replaceAll("_", " ")}
                      </strong>
                      <span style={{ marginLeft: "0.75rem", fontSize: "0.85rem", color: "#475569" }}>
                        Officer: <strong>{recorded.officer_id || "OFFICER-DEMO-001"}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Timestamp: {new Date(recorded.timestamp).toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.88rem", color: "#475569", margin: "0.4rem 0 1rem" }}>
                    Select an official action below to record your formal decision in the tamper-evident MongoDB audit trail.
                  </p>
                )}

                {decisionSuccessMsg && <p className="success" style={{ marginBottom: "1rem" }}>{decisionSuccessMsg}</p>}
                {decisionErrorMsg && <p className="error" style={{ marginBottom: "1rem" }}>{decisionErrorMsg}</p>}

                {/* Action Buttons: Disabled when decision is already recorded */}
                <div className="actions">
                  <button
                    disabled={saving || isDecisionLocked}
                    onClick={() => submitDecision("approve")}
                    style={isDecisionLocked && recorded?.officer_decision === "approve" ? { outline: "2px solid #08724b" } : {}}
                  >
                    {isDecisionLocked && recorded?.officer_decision === "approve" ? "✓ Approved" : "Approve Bid"}
                  </button>
                  <button
                    disabled={saving || isDecisionLocked}
                    className="reject"
                    onClick={() => submitDecision("reject")}
                    style={isDecisionLocked && recorded?.officer_decision === "reject" ? { outline: "2px solid #ac3030" } : {}}
                  >
                    {isDecisionLocked && recorded?.officer_decision === "reject" ? "✕ Rejected" : "Reject Bid"}
                  </button>
                  <button
                    disabled={saving || isDecisionLocked}
                    className="more"
                    onClick={() => submitDecision("request_more_info")}
                    style={isDecisionLocked && recorded?.officer_decision === "request_more_info" ? { outline: "2px solid #986900" } : {}}
                  >
                    {isDecisionLocked && recorded?.officer_decision === "request_more_info" ? "ℹ Clarification Requested" : "Request Rule 173(iv) Clarification"}
                  </button>
                </div>

                <div className="comparison">
                  <div>
                    <span>Deterministic Score (Unchanged)</span>
                    <strong>
                      {assessment.compliance_score}/100 · <Risk value={assessment.risk_level} />
                    </strong>
                    <span className="score-confidence-note" style={{ display: "block", fontSize: "0.72rem" }}>
                      Score reflects verification confidence; not all checks report 100% certainty.
                    </span>
                  </div>
                  <div>
                    <span>Officer Decision Status</span>
                    <strong>
                      {recorded?.officer_decision
                        ? `${recorded.officer_decision.replaceAll("_", " ")} (${recorded.officer_id || "Officer"})`
                        : "Pending Officer Action"}
                    </strong>
                  </div>
                </div>
              </section>

              {/* Immutable Audit Trail */}
              <section className="card">
                <h3>Immutable Audit Trail (MongoDB)</h3>
                <p>Chronological record of automated evaluations and officer decisions for {selectedBidderId}:</p>
                <ol>
                  {trail.map((entry) => (
                    <li key={entry._id || entry.timestamp}>
                      <time>{new Date(entry.timestamp).toLocaleString()}</time>
                      <span>
                        Tender: <strong>{entry.tender_id || "Standard"}</strong> · Score:{" "}
                        <strong>{entry.compliance_score}/100</strong> · <Risk value={entry.risk_level} />
                      </span>
                      {entry.llm_briefing && (
                        <span style={{ fontSize: "0.8rem", color: "#475569", fontStyle: "italic" }}>
                          Briefing: &ldquo;{entry.llm_briefing.slice(0, 110)}…&rdquo;
                        </span>
                      )}
                      <span>
                        Officer Decision:{" "}
                        <strong>
                          {entry.officer_decision
                            ? `${entry.officer_decision.replaceAll("_", " ")} (${entry.officer_id || "Officer"})`
                            : "Pending Officer Action"}
                        </strong>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </section>
          ) : (
            <section className="detail" style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <h3>No applications received yet</h3>
              <p>No enterprise bidders have submitted an application for this tender yet.</p>
            </section>
          )}
        </div>
      )}
      </>
    )}

      {/* MODAL: Register New Bidder with PDF Upload */}
      {showBidderModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>Register New Bidder</h2>
                <p className="eyebrow">Auto-extract from PDF or fill manually. Review before submitting.</p>
              </div>
              <button className="btn-close" onClick={() => setShowBidderModal(false)}>
                &times;
              </button>
            </div>

            <div className="file-upload-card" style={{ marginBottom: "1.25rem" }}>
              <label className="file-upload-label">
                <span style={{ fontSize: "1.6rem" }}>📄</span>
                <span>Auto-fill from Bidder Certificate / Document (PDF)</span>
                <small style={{ color: "#64748b" }}>
                  Uploads and parses Company Name, Udyam, GSTIN, PAN, EPFO with AI
                </small>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="file-upload-input"
                  onChange={handleBidderPdfUpload}
                  disabled={extractingBidder}
                />
              </label>
              {extractingBidder && (
                <div className="extract-alert extract-alert-loading">
                  Reading PDF text and auto-extracting candidate fields with AI…
                </div>
              )}
              {bidderExtractMsg && (
                <div
                  className={`extract-alert ${
                    bidderExtractStatus === "success" ? "extract-alert-success" : "extract-alert-error"
                  }`}
                >
                  {bidderExtractMsg}
                </div>
              )}
            </div>

            <form onSubmit={handleRegisterBidderSubmit} className="form-grid">
              <div className="form-field">
                <label>Bidder ID *</label>
                <input
                  type="text"
                  placeholder="e.g. BIDDER-ECHO"
                  value={bidderForm.bidder_id}
                  onChange={(e) => setBidderForm({ ...bidderForm, bidder_id: e.target.value.toUpperCase() })}
                  required
                />
                <small>Unique identifier used for GeM verification contract.</small>
              </div>

              <div className="form-field">
                <label>Company Legal Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Zen Power Systems Private Limited"
                  value={bidderForm.company_name}
                  onChange={(e) => setBidderForm({ ...bidderForm, company_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Udyam / MSME Registration Number</label>
                <input
                  type="text"
                  placeholder="e.g. UDYAM-MH-01-0098765"
                  value={bidderForm.udyam_number}
                  onChange={(e) => setBidderForm({ ...bidderForm, udyam_number: e.target.value })}
                />
                <small>Leave blank to simulate an unregistered / NOT_FOUND entity.</small>
              </div>

              <div className="form-field">
                <label>GSTIN (15-character GST Number)</label>
                <input
                  type="text"
                  placeholder="e.g. 27AABCP1234E1Z9"
                  value={bidderForm.gstin}
                  onChange={(e) => setBidderForm({ ...bidderForm, gstin: e.target.value.toUpperCase() })}
                />
                <small>Leave blank to test missing GST filing.</small>
              </div>

              <div className="form-field">
                <label>Permanent Account Number (PAN)</label>
                <input
                  type="text"
                  placeholder="e.g. AABCP1234E"
                  value={bidderForm.pan}
                  onChange={(e) => setBidderForm({ ...bidderForm, pan: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="form-field">
                <label>EPFO / ESIC Establishment Number</label>
                <input
                  type="text"
                  placeholder="e.g. MH/BAN/0098765/000"
                  value={bidderForm.epfo_esic_number}
                  onChange={(e) => setBidderForm({ ...bidderForm, epfo_esic_number: e.target.value })}
                />
                <small>Leave blank to test statutory labor exemption / unverified status.</small>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowBidderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-accent" disabled={saving || extractingBidder}>
                  {saving ? "Saving…" : "Register Bidder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Configure New Tender with PDF Upload */}
      {showTenderModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>Configure New Tender</h2>
                <p className="eyebrow">Auto-extract from Tender Notice PDF or configure manually.</p>
              </div>
              <button className="btn-close" onClick={() => setShowTenderModal(false)}>
                &times;
              </button>
            </div>

            <div className="file-upload-card" style={{ marginBottom: "1.25rem" }}>
              <label className="file-upload-label">
                <span style={{ fontSize: "1.6rem" }}>📄</span>
                <span>Auto-fill from Tender Notice (PDF)</span>
                <small style={{ color: "#64748b" }}>
                  Uploads and parses Tender ID, Category, and Mandatory Statutory Checks with AI
                </small>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="file-upload-input"
                  onChange={handleTenderPdfUpload}
                  disabled={extractingTender}
                />
              </label>
              {extractingTender && (
                <div className="extract-alert extract-alert-loading">
                  Reading tender notice and auto-extracting compliance parameters with AI…
                </div>
              )}
              {tenderExtractMsg && (
                <div
                  className={`extract-alert ${
                    tenderExtractStatus === "success" ? "extract-alert-success" : "extract-alert-error"
                  }`}
                >
                  {tenderExtractMsg}
                </div>
              )}
            </div>

            <form onSubmit={handleRegisterTenderSubmit} className="form-grid">
              <div className="form-field">
                <label>Tender ID *</label>
                <input
                  type="text"
                  placeholder="e.g. GEM/2026/B/90412"
                  value={tenderForm.tender_id}
                  onChange={(e) => setTenderForm({ ...tenderForm, tender_id: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Tender Title</label>
                <input
                  type="text"
                  placeholder="e.g. Supply of Solar Inverters & Batteries"
                  value={tenderForm.title}
                  onChange={(e) => setTenderForm({ ...tenderForm, title: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Procurement Category *</label>
                <select
                  value={tenderForm.category}
                  onChange={(e) => setTenderForm({ ...tenderForm, category: e.target.value })}
                >
                  <option value="Goods">Goods</option>
                  <option value="Services">Services</option>
                  <option value="Works">Works & Infrastructure</option>
                  <option value="IT & Telecom">IT & Telecom</option>
                </select>
              </div>

              <div className="form-field">
                <label>Mandatory Statutory Compliance Checks *</label>
                <small style={{ marginBottom: "0.5rem" }}>
                  Only checked sources will affect the score & risk calculation. Unchecked sources will still display
                  for informational completeness.
                </small>
                <div className="checkbox-group">
                  {ALL_SOURCES.map((source) => {
                    const isChecked = tenderForm.mandatory_checks.includes(source);
                    return (
                      <label key={source} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTenderForm({
                                ...tenderForm,
                                mandatory_checks: [...tenderForm.mandatory_checks, source],
                              });
                            } else {
                              setTenderForm({
                                ...tenderForm,
                                mandatory_checks: tenderForm.mandatory_checks.filter((c) => c !== source),
                              });
                            }
                          }}
                        />
                        <span>
                          <strong>{SOURCE_LABELS[source] || source}</strong>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowTenderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving || extractingTender}>
                  {saving ? "Creating…" : "Create Tender"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
