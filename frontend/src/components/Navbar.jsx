import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isAuthenticated, isOfficer, isBidder, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    logout();
    navigate("/login");
  };

  const closeMenu = () => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Track active section on landing page
  useEffect(() => {
    if (isAuthenticated) return;

    const handleScroll = () => {
      const sections = ["home", "about", "how-it-works", "features", "for-officers", "for-bidders", "contact"];
      const scrollY = window.scrollY + 120;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollY) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isAuthenticated]);

  const handleNavClick = (sectionId) => {
    closeMenu();
    setActiveSection(sectionId);
    if (location.pathname === "/login" || location.pathname === "/") {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    navigate(`/login#${sectionId}`);
  };

  const displayName = isOfficer
    ? user?.full_name || "Government Officer"
    : user?.company_name || "Enterprise Bidder";

  const initial = displayName.charAt(0).toUpperCase() || "U";
  const roleLabel = isOfficer ? "Government Officer" : "Enterprise Bidder";

  return (
    <header className="main-navbar-wrapper">
      {/* Tricolor Government Top Strip */}
      <div className="gov-tricolor-strip">
        <div className="strip-saffron"></div>
        <div className="strip-white"></div>
        <div className="strip-green"></div>
      </div>

      <nav className="gem-main-nav">
        {/* Brand Section */}
        <div className="nav-brand-section">
          <Link to="/" className="brand-link" onClick={() => handleNavClick("home")}>
            <div className="gem-logo-badge">TF</div>
            <div className="brand-text-block">
              <span className="brand-title">TenderFlow</span>
              <span className="brand-subtitle">GOVTECH PROCUREMENT & STATUTORY COMPLIANCE</span>
            </div>
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span className="hamburger-icon">{mobileMenuOpen ? "✕" : "☰"}</span>
        </button>

        {/* Navigation Links */}
        <div className={`nav-links-section ${mobileMenuOpen ? "mobile-open" : ""}`}>
          {isAuthenticated ? (
            <>
              {isOfficer && (
                <>
                  <NavLink
                    to="/officer/dashboard"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/officer/tenders"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    My Tenders
                  </NavLink>
                  <NavLink
                    to="/compliance-cockpit"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    AI Evaluation
                  </NavLink>
                </>
              )}

              {isBidder && (
                <>
                  <NavLink
                    to="/bidder/dashboard"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/bidder/tenders"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Browse Tenders
                  </NavLink>
                  <NavLink
                    to="/bidder/applications"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    My Applications
                  </NavLink>
                  <NavLink
                    to="/bidder/documents"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Document Vault
                  </NavLink>
                  <NavLink
                    to="/bidder/profile"
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Enterprise Profile
                  </NavLink>
                </>
              )}

              {/* Mobile-only profile & logout: strictly hidden on desktop via CSS */}
              <div className="mobile-only-user-block">
                <div className="user-badge-preview">
                  <div className="user-avatar-initials">{initial}</div>
                  <div className="user-meta">
                    <span className="user-name">{displayName}</span>
                    <span className="user-role-pill">{roleLabel}</span>
                  </div>
                </div>
                {isBidder && (
                  <NavLink to="/bidder/profile" onClick={closeMenu} className="mobile-profile-link">
                    Enterprise Profile &rarr;
                  </NavLink>
                )}
                <button onClick={handleLogout} className="btn-logout-mobile">
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            /* Unauthenticated Public Landing Navigation */
            <>
              <button
                type="button"
                onClick={() => handleNavClick("home")}
                className={`landing-nav-link ${activeSection === "home" ? "active" : ""}`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => handleNavClick("about")}
                className={`landing-nav-link ${activeSection === "about" ? "active" : ""}`}
              >
                About
              </button>
              <button
                type="button"
                onClick={() => handleNavClick("how-it-works")}
                className={`landing-nav-link ${activeSection === "how-it-works" ? "active" : ""}`}
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => handleNavClick("features")}
                className={`landing-nav-link ${activeSection === "features" ? "active" : ""}`}
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => handleNavClick("for-officers")}
                className={`landing-nav-link ${activeSection === "for-officers" ? "active" : ""}`}
              >
                For Officers
              </button>
              <button
                type="button"
                onClick={() => handleNavClick("for-bidders")}
                className={`landing-nav-link ${activeSection === "for-bidders" ? "active" : ""}`}
              >
                For Bidders
              </button>
              <button
                type="button"
                onClick={() => handleNavClick("contact")}
                className={`landing-nav-link ${activeSection === "contact" ? "active" : ""}`}
              >
                Contact
              </button>

              {/* Mobile quick actions */}
              <div className="mobile-auth-quick-actions">
                <button
                  type="button"
                  onClick={() => handleNavClick("login-card")}
                  className="btn-signin-nav-mobile"
                >
                  Sign In &rarr;
                </button>
                <div className="mobile-reg-pill-group">
                  <Link to="/register/officer" onClick={closeMenu} className="mobile-reg-link">
                    Register Officer
                  </Link>
                  <span className="mobile-reg-sep">•</span>
                  <Link to="/register/bidder" onClick={closeMenu} className="mobile-reg-link">
                    Register Bidder
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Desktop Unauthenticated Sign In Action Button */}
        {!isAuthenticated && (
          <div className="nav-public-actions desktop-only-actions">
            <button
              type="button"
              onClick={() => handleNavClick("login-card")}
              className="btn-signin-nav"
            >
              Sign In &rarr;
            </button>
          </div>
        )}

        {/* Desktop User Profile Widget (EXACTLY ONE Sign Out in Header) */}
        {isAuthenticated && (
          <div className="nav-profile-section desktop-only-profile" ref={dropdownRef}>
            <div
              className="user-profile-widget"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title="Account Menu"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setDropdownOpen(!dropdownOpen);
              }}
            >
              <div className="user-avatar-initials">{initial}</div>
              <div className="user-info-text">
                <span className="user-name">{displayName}</span>
                <span className={`user-role-badge role-${user?.role}`}>
                  {roleLabel}
                </span>
              </div>
              <span className="dropdown-caret">{dropdownOpen ? "▲" : "▼"}</span>
            </div>

            {dropdownOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-user-header">
                  <strong>{displayName}</strong>
                  <span className="dropdown-user-sub">
                    {isOfficer
                      ? user?.department ? `${user?.designation || "Officer"} • ${user.department}` : "Government Officer"
                      : `Bidder ID: ${user?.bidder_id || "Verified"}`}
                  </span>
                </div>
                <div className="dropdown-divider"></div>
                {isBidder && (
                  <Link to="/bidder/profile" onClick={closeMenu} className="dropdown-item">
                    Enterprise Profile
                  </Link>
                )}
                {isBidder && (
                  <Link to="/bidder/documents" onClick={closeMenu} className="dropdown-item">
                    Document Vault
                  </Link>
                )}
                {isOfficer && (
                  <Link to="/officer/dashboard" onClick={closeMenu} className="dropdown-item">
                    Procurement Dashboard
                  </Link>
                )}
                {isOfficer && (
                  <Link to="/officer/tenders" onClick={closeMenu} className="dropdown-item">
                    Manage Tenders
                  </Link>
                )}
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-logout-btn">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
