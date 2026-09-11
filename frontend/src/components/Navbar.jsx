import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isAuthenticated, isOfficer, isBidder, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="main-navbar-wrapper">
      {/* Tricolor Government Top Strip */}
      <div className="gov-tricolor-strip">
        <div className="strip-saffron"></div>
        <div className="strip-white"></div>
        <div className="strip-green"></div>
      </div>

      <nav className="gem-main-nav">
        <div className="nav-brand-section">
          <Link to="/" className="brand-link">
            <div className="gem-logo-badge">BidSetu</div>
            <div className="brand-text-block">
              <span className="brand-title">BidSetu</span>
              <span className="brand-subtitle">AI-Powered Bid Compliance Verification Platform</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="nav-links-section">
          {isAuthenticated ? (
            <>
              {isOfficer && (
                <>
                  <NavLink
                    to="/officer/dashboard"
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/officer/tenders"
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    My Tenders
                  </NavLink>
                  <NavLink
                    to="/compliance-cockpit"
                    className={({ isActive }) => (isActive ? "nav-link active cockpit-link" : "nav-link cockpit-link")}
                  >
                    AI Evaluation Cockpit
                  </NavLink>
                </>
              )}

              {isBidder && (
                <>
                  <NavLink
                    to="/bidder/dashboard"
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/bidder/tenders"
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Browse Tenders
                  </NavLink>
                  <NavLink
                    to="/bidder/applications"
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    My Applications
                  </NavLink>
                  <NavLink
                    to="/bidder/documents"
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Document Vault
                  </NavLink>
                  <NavLink
                    to="/bidder/profile"
                    className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  >
                    Enterprise Profile
                  </NavLink>
                </>
              )}
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Login
              </NavLink>
              <NavLink
                to="/register/officer"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Officer Registration
              </NavLink>
              <NavLink
                to="/register/bidder"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Bidder Registration
              </NavLink>
            </>
          )}
        </div>

        {/* User Status / Action Profile */}
        <div className="nav-profile-section">
          {isAuthenticated ? (
            <div className="user-profile-widget">
              <div className="user-info-text">
                <span className="user-name">
                  {isOfficer ? user.full_name : user.company_name}
                </span>
                <span className={`user-role-badge role-${user.role}`}>
                  {isOfficer ? "Government Officer" : `Bidder: ${user.bidder_id || "Verified"}`}
                </span>
              </div>
              <button onClick={handleLogout} className="btn-logout" title="Sign Out">
                Sign Out
              </button>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
