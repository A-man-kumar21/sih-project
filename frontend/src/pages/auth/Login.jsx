import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  // Handle smooth scroll when landing with hash
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, [location.hash]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      // Role-based redirection
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === "officer") {
        navigate("/officer/dashboard", { replace: true });
      } else {
        navigate("/bidder/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page-root" id="home">
      {/* =========================================================================
          1. HERO SECTION & INTEGRATED LOGIN PORTAL
          ========================================================================= */}
      <section className="landing-hero-section">
        {/* Subtle Government Administrative Architectural Silhouette Vector Background */}
        <div className="gov-architectural-bg" aria-hidden="true">
          <svg viewBox="0 0 1200 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="arch-svg">
            <path d="M50 560H1150V570H50V560Z" fill="#1e3a8a" fillOpacity="0.04" />
            <path d="M100 530H1100V545H100V530Z" fill="#1e3a8a" fillOpacity="0.05" />
            <path d="M150 500H1050V515H150V500Z" fill="#1e3a8a" fillOpacity="0.06" />
            {/* Columns */}
            {[200, 260, 320, 380, 440, 500, 560, 620, 680, 740, 800, 860, 920, 980].map((x, i) => (
              <g key={i} opacity="0.05">
                <rect x={x} y="220" width="22" height="280" rx="3" fill="#1e3a8a" />
                <rect x={x - 4} y="210" width="30" height="10" rx="2" fill="#1e3a8a" />
                <rect x={x - 4} y="490" width="30" height="10" rx="2" fill="#1e3a8a" />
              </g>
            ))}
            {/* Entablature & Pediment */}
            <path d="M180 200H1020V212H180V200Z" fill="#1e3a8a" fillOpacity="0.06" />
            <path d="M160 185H1040V197H160V185Z" fill="#1e3a8a" fillOpacity="0.07" />
            <polygon points="600,70 150,185 1050,185" fill="#1e3a8a" fillOpacity="0.05" />
            {/* Central Dome Silhouette */}
            <path d="M510 180 C510 90, 690 90, 690 180 Z" fill="#1e3a8a" fillOpacity="0.06" />
            <rect x="585" y="40" width="30" height="35" rx="3" fill="#1e3a8a" fillOpacity="0.07" />
            <line x1="600" y1="20" x2="600" y2="40" stroke="#1e3a8a" strokeWidth="3" strokeOpacity="0.09" />
          </svg>
        </div>

        <div className="landing-container">
          <div className="landing-hero-grid">
            {/* LEFT / CENTER: Large Marketing Hero & Value Propositions */}
            <div className="hero-content-col">
              {/* Eyebrow */}
              <div className="hero-eyebrow-pill">
                <span className="eyebrow-flag">🇮🇳</span>
                <span className="eyebrow-text">NATIONAL PROCUREMENT & STATUTORY COMPLIANCE</span>
              </div>

              {/* Dominant Headline */}
              <h1 className="hero-main-title">
                Procurement,
                <br />
                <span className="hero-title-accent">verified.</span>
              </h1>

              {/* Supporting Text */}
              <p className="hero-supporting-lead">
                TenderFlow brings intelligence, compliance and transparency to government
                procurement — from tender creation to verified bidder evaluation, all in
                one platform.
              </p>

              {/* Floating Live Capability Badges (Real System Capabilities, No Fake Metrics) */}
              <div className="hero-floating-badges-row">
                <div className="floating-badge-item badge-verified">
                  <div className="floating-badge-icon">✓</div>
                  <div className="floating-badge-text">
                    <span className="badge-title">Deterministic Scoring</span>
                    <span className="badge-sub">100% Rule-Based Statutory Checks</span>
                  </div>
                </div>

                <div className="floating-badge-item badge-compliance">
                  <div className="floating-badge-icon">⚡</div>
                  <div className="floating-badge-text">
                    <span className="badge-title">Audit Ready</span>
                    <span className="badge-sub">GeM & GFR Rule 144(xi) Aligned</span>
                  </div>
                </div>

                <div className="floating-badge-item badge-sovereign">
                  <div className="floating-badge-icon">🔒</div>
                  <div className="floating-badge-text">
                    <span className="badge-title">Sovereign Data</span>
                    <span className="badge-sub">Local PyMuPDF • Zero LLM Leakage</span>
                  </div>
                </div>
              </div>

              {/* 3 Elegant Feature Blocks */}
              <div className="hero-features-triplet">
                <div className="feature-block-card">
                  <div className="feature-block-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div className="feature-block-content">
                    <h3 className="feature-block-title">Tender Intelligence</h3>
                    <p className="feature-block-desc">
                      Extract procurement requirements, statutory mandates, and qualification criteria
                      directly from tender documents.
                    </p>
                  </div>
                </div>

                <div className="feature-block-card">
                  <div className="feature-block-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  </div>
                  <div className="feature-block-content">
                    <h3 className="feature-block-title">Compliance Verification</h3>
                    <p className="feature-block-desc">
                      Verify statutory information deterministically against PAN, GSTIN, Udyam,
                      and debarment registries.
                    </p>
                  </div>
                </div>

                <div className="feature-block-card">
                  <div className="feature-block-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="feature-block-content">
                    <h3 className="feature-block-title">Trusted Decisions</h3>
                    <p className="feature-block-desc">
                      Give procurement officers a clear, transparent, and auditable compliance cockpit
                      with full legal defensibility.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Premium Government Login Card */}
            <div className="hero-login-col" id="login-card">
              <div className="premium-login-card">
                <div className="login-card-header">
                  <div className="login-brand-eyebrow">
                    <span className="login-tf-badge">TF</span>
                    <span>WELCOME TO</span>
                  </div>
                  <h2 className="login-brand-title">TenderFlow</h2>
                  <h3 className="login-action-heading">Sign in to your account</h3>
                  <p className="login-card-subtext">
                    Access your procurement dashboard and continue building a transparent
                    procurement ecosystem.
                  </p>
                </div>

                {error && (
                  <div className="alert-box alert-error" role="alert">
                    <span className="alert-icon">✕</span>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="email" className="login-form-label">
                      Work Email Address
                    </label>
                    <div className="input-with-icon">
                      <input
                        id="email"
                        type="email"
                        placeholder="officer@gem.gov.in or bidder@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        disabled={loading}
                        className="form-input login-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="password" className="login-form-label">
                      Password
                    </label>
                    <div className="input-with-icon">
                      <input
                        id="password"
                        type="password"
                        placeholder="Enter your secure password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="form-input login-input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary auth-submit-btn login-submit-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="btn-loading-content">
                        <span className="spinner-small"></span> Authenticating...
                      </span>
                    ) : (
                      "Sign In to TenderFlow →"
                    )}
                  </button>
                </form>

                {/* Registration Pathway Cards */}
                <div className="registration-pathway-section">
                  <div className="registration-divider">
                    <span>Or register as</span>
                  </div>

                  <div className="registration-cards-grid">
                    <div className="pathway-card pathway-officer">
                      <div className="pathway-info">
                        <strong className="pathway-title">Government Officer</strong>
                        <p className="pathway-desc">Create & manage tenders</p>
                      </div>
                      <Link to="/register/officer" className="btn-pathway-link">
                        Register as Officer →
                      </Link>
                    </div>

                    <div className="pathway-card pathway-bidder">
                      <div className="pathway-info">
                        <strong className="pathway-title">Enterprise Bidder</strong>
                        <p className="pathway-desc">Participate in tenders</p>
                      </div>
                      <Link to="/register/bidder" className="btn-pathway-link">
                        Register as Bidder →
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Login Card Footer Credibility */}
                <div className="login-card-footer-strip">
                  <span>🔒 Secure</span>
                  <span className="dot-sep">•</span>
                  <span>🏛️ Government Grade</span>
                  <span className="dot-sep">•</span>
                  <span>📋 GFR Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            BOTTOM TRUST STRIP
            ========================================================================= */}
        <div className="landing-trust-strip">
          <div className="trust-strip-inner">
            <div className="trust-strip-label">
              <span>PROCUREMENT STANDARDS & ASSURANCE:</span>
            </div>
            <div className="trust-badges-flow">
              <div className="trust-badge-pill">
                <span className="trust-icon">🏛️</span>
                <span>Government Procurement</span>
              </div>
              <div className="trust-badge-pill">
                <span className="trust-icon">📋</span>
                <span>Statutory Compliance</span>
              </div>
              <div className="trust-badge-pill">
                <span className="trust-icon">⚡</span>
                <span>Deterministic Verification</span>
              </div>
              <div className="trust-badge-pill">
                <span className="trust-icon">📜</span>
                <span>Immutable Audit Trail</span>
              </div>
              <div className="trust-badge-pill">
                <span className="trust-icon">🔒</span>
                <span>Secure Document Processing</span>
              </div>
              <div className="trust-badge-pill highlight-pill">
                <span className="trust-icon">🇮🇳</span>
                <span>General Financial Rules (GFR 2017) Aligned</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. HOW IT WORKS SECTION (#how-it-works)
          ========================================================================= */}
      <section className="landing-info-section section-how-it-works" id="how-it-works">
        <div className="landing-container">
          <div className="section-header-center">
            <span className="section-eyebrow">WORKFLOW AUTOMATION</span>
            <h2 className="section-heading">How TenderFlow Works</h2>
            <p className="section-subtext">
              An end-to-end statutory verification architecture connecting procurement officers
              with pre-verified enterprise bidders.
            </p>
          </div>

          <div className="workflow-steps-grid">
            <div className="workflow-step-card">
              <div className="step-num-badge">01</div>
              <h4 className="step-title">Upload or Define Tender</h4>
              <p className="step-desc">
                Officers upload tender specifications in PDF format or define criteria.
                TenderFlow auto-extracts statutory mandates, category, and eligibility rules.
              </p>
            </div>

            <div className="workflow-step-card">
              <div className="step-num-badge">02</div>
              <h4 className="step-title">Reusable Bidder Vault</h4>
              <p className="step-desc">
                Bidders upload PAN, GSTIN, Udyam, labor compliance, and ISO certifications once.
                The local engine extracts key fields with zero external data exposure.
              </p>
            </div>

            <div className="workflow-step-card">
              <div className="step-num-badge">03</div>
              <h4 className="step-title">Deterministic Verification</h4>
              <p className="step-desc">
                When applying, the system executes deterministic validation against statutory registries,
                tax filing periodicity, and Central Debarment databases.
              </p>
            </div>

            <div className="workflow-step-card">
              <div className="step-num-badge">04</div>
              <h4 className="step-title">Evaluation Cockpit</h4>
              <p className="step-desc">
                Procurement officers review transparent discrepancy breakdowns, confidence
                indicators, and record defensible award or clarification decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. PLATFORM FEATURES SECTION (#features)
          ========================================================================= */}
      <section className="landing-info-section section-features" id="features">
        <div className="landing-container">
          <div className="section-header-center">
            <span className="section-eyebrow">ENGINEERING EXCELLENCE</span>
            <h2 className="section-heading">Government-Grade Capabilities</h2>
            <p className="section-subtext">
              Designed for public procurement scrutiny with complete traceability,
              officer data isolation, and sovereign document handling.
            </p>
          </div>

          <div className="features-deep-grid">
            <div className="feature-deep-card">
              <div className="deep-card-icon">📄</div>
              <h3>Tender PDF Intelligence</h3>
              <p>
                Parse multi-page procurement notices, RFP documents, and NITs with deterministic
                field extraction for scope, category, deadline, and mandatory compliance mandates.
              </p>
              <div className="feature-tag-list">
                <span>Rule-based extraction</span>
                <span>PyMuPDF parsing</span>
                <span>Auto-categorization</span>
              </div>
            </div>

            <div className="feature-deep-card">
              <div className="deep-card-icon">🏛️</div>
              <h3>Central Debarment Screening</h3>
              <p>
                Real-time checks against official blacklists and GFR Rule 144(xi) land border
                declaration mandates, shielding departments from non-compliant awards.
              </p>
              <div className="feature-tag-list">
                <span>GFR 144(xi) checks</span>
                <span>Debarment cross-reference</span>
                <span>Instant flagging</span>
              </div>
            </div>

            <div className="feature-deep-card">
              <div className="deep-card-icon">📁</div>
              <h3>Multi-Document Technical Vault</h3>
              <p>
                Support for multiple technical certifications, ISO accreditations, and lab test reports
                without overwriting, preserving independent document provenance.
              </p>
              <div className="feature-tag-list">
                <span>Multi-file support</span>
                <span>Independent audit trails</span>
                <span>Local indexing</span>
              </div>
            </div>

            <div className="feature-deep-card">
              <div className="deep-card-icon">🛡️</div>
              <h3>Officer Data Isolation</h3>
              <p>
                Strict multi-tenant cryptographic partitioning ensures procurement officers only access
                their own tenders, candidate bids, and statutory verification dashboards.
              </p>
              <div className="feature-tag-list">
                <span>Department isolation</span>
                <span>Zero cross-access</span>
                <span>Role-based access</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. FOR OFFICERS & FOR BIDDERS SECTION (#for-officers & #for-bidders)
          ========================================================================= */}
      <section className="landing-info-section section-personas" id="for-officers">
        <div className="landing-container">
          <div className="personas-comparison-grid">
            {/* For Officers Card */}
            <div className="persona-card persona-officer-card">
              <div className="persona-header">
                <span className="persona-badge">FOR PROCUREMENT OFFICERS</span>
                <h3 className="persona-title">Command & Governance</h3>
                <p className="persona-sub">Built for Ministry, PSU, and State Department Procurement Teams</p>
              </div>
              <ul className="persona-bullets">
                <li>
                  <strong>Create Tenders via PDF:</strong> Upload official RFP/NIT docs for automated criteria mapping.
                </li>
                <li>
                  <strong>Statutory Verification Cockpit:</strong> Full tabular view of PAN, GST, MSME, and labor compliance.
                </li>
                <li>
                  <strong>Discrepancy Audit:</strong> Automated flagging of expired certificates or name mismatches.
                </li>
                <li>
                  <strong>Audit-Proof Decisions:</strong> Maintain defensible records of approvals, rejections, and clarifications.
                </li>
              </ul>
              <div className="persona-action">
                <Link to="/register/officer" className="btn-persona-primary">
                  Register Official Account →
                </Link>
              </div>
            </div>

            {/* For Bidders Card */}
            <div className="persona-card persona-bidder-card" id="for-bidders">
              <div className="persona-header">
                <span className="persona-badge">FOR ENTERPRISE BIDDERS</span>
                <h3 className="persona-title">Fast & Verified Bidding</h3>
                <p className="persona-sub">Built for MSMEs, Startups, and Enterprise Government Suppliers</p>
              </div>
              <ul className="persona-bullets">
                <li>
                  <strong>Single Document Vault:</strong> Upload statutory records once and reuse across unlimited tenders.
                </li>
                <li>
                  <strong>Real-time Readiness Score:</strong> Know whether your profile satisfies GFR compliance before submitting.
                </li>
                <li>
                  <strong>One-Click Tender Application:</strong> Instant submission with auto-attached verified credentials.
                </li>
                <li>
                  <strong>Clarification Tracking:</strong> Respond immediately if officers request supplementary documentation.
                </li>
              </ul>
              <div className="persona-action">
                <Link to="/register/bidder" className="btn-persona-secondary">
                  Create Bidder Profile →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. ABOUT & GOVERNANCE SECTION (#about)
          ========================================================================= */}
      <section className="landing-info-section section-about" id="about">
        <div className="landing-container">
          <div className="about-content-card">
            <div className="about-text-col">
              <span className="section-eyebrow">SOVEREIGN COMPLIANCE ARCHITECTURE</span>
              <h2 className="section-heading">Engineered for Indian Public Procurement</h2>
              <p className="about-para">
                TenderFlow was developed to eliminate manual paperwork bottlenecks, inadvertent
                statutory oversights, and tender evaluation delays across Indian public procurement.
              </p>
              <p className="about-para">
                By executing deterministic, rule-based statutory parsing locally without transmitting sensitive
                enterprise tax documents to third-party language models, TenderFlow maintains sovereign data
                privacy and guarantees 100% reproducible compliance scoring.
              </p>
              <div className="about-badges-group">
                <div className="about-badge-item">
                  <strong>GFR 2017</strong>
                  <span>Aligned with General Financial Rules</span>
                </div>
                <div className="about-badge-item">
                  <strong>GeM Ready</strong>
                  <span>Government e-Marketplace Compatible</span>
                </div>
                <div className="about-badge-item">
                  <strong>MSME / Udyam</strong>
                  <span>Classified Procurement Preferences</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. CONTACT & FOOTER SECTION (#contact)
          ========================================================================= */}
      <section className="landing-info-section section-contact" id="contact">
        <div className="landing-container">
          <div className="contact-card-box">
            <div className="contact-info-col">
              <span className="section-eyebrow">SUPPORT & ASSISTANCE</span>
              <h2 className="section-heading">Procurement Helpdesk</h2>
              <p className="contact-subtext">
                Need guidance on statutory document extraction, department registration, or compliance rules?
                Our procurement operations desk is available to assist officers and bidders.
              </p>
              <div className="contact-methods-list">
                <div className="contact-method-item">
                  <span className="contact-icon">✉️</span>
                  <div>
                    <strong>Official Inquiries:</strong>
                    <span>support@tenderflow.gov.in</span>
                  </div>
                </div>
                <div className="contact-method-item">
                  <span className="contact-icon">🏢</span>
                  <div>
                    <strong>Procurement Technical Support:</strong>
                    <span>New Delhi • National Capital Territory of Delhi, India</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="contact-action-col">
              <div className="quick-access-box">
                <h4>Ready to get started?</h4>
                <p>Select your user profile to begin managing or participating in procurement tenders.</p>
                <div className="quick-access-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("login-card");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="btn-primary"
                    style={{ width: "100%", padding: "0.75rem", marginBottom: "0.5rem" }}
                  >
                    Sign In to Portal &rarr;
                  </button>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Link to="/register/officer" className="btn-secondary" style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
                      Officer Setup
                    </Link>
                    <Link to="/register/bidder" className="btn-secondary" style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
                      Bidder Setup
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. GOVTECH LEGAL FOOTER
          ========================================================================= */}
      <footer className="landing-global-footer">
        <div className="landing-container">
          <div className="footer-top-row">
            <div className="footer-brand">
              <div className="gem-logo-badge">TF</div>
              <div>
                <strong>TenderFlow</strong>
                <span className="footer-sub">National Procurement & Statutory Compliance Platform</span>
              </div>
            </div>
            <div className="footer-links-group">
              <a href="#home">Home</a>
              <a href="#about">About</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#features">Features</a>
              <a href="#for-officers">For Officers</a>
              <a href="#for-bidders">For Bidders</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
          <div className="footer-bottom-row">
            <p>© {new Date().getFullYear()} TenderFlow. All rights reserved. Government Procurement Infrastructure.</p>
            <p className="footer-compliance-text">
              Deterministic Verification Architecture • General Financial Rules (GFR 2017) Compliant
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
