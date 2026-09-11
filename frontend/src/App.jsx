import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// Auth Pages
import Login from "./pages/auth/Login";
import RegisterOfficer from "./pages/auth/RegisterOfficer";
import RegisterBidder from "./pages/auth/RegisterBidder";

// Officer Pages
import OfficerDashboard from "./pages/officer/OfficerDashboard";
import OfficerTenders from "./pages/officer/OfficerTenders";
import TenderApplicants from "./pages/officer/TenderApplicants";
import ApplicationDetail from "./pages/officer/ApplicationDetail";

// Bidder Pages
import BidderDashboard from "./pages/bidder/BidderDashboard";
import AvailableTenders from "./pages/bidder/AvailableTenders";
import MyApplications from "./pages/bidder/MyApplications";
import DocumentVault from "./pages/bidder/DocumentVault";
import BidderProfile from "./pages/bidder/BidderProfile";

// Preserved Compliance Cockpit
import ComplianceCockpit from "./pages/ComplianceCockpit";

function RootRedirect() {
  const { isAuthenticated, isOfficer, isBidder, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div style={{ textAlign: "center", color: "#5d6e86", fontWeight: 600 }}>
          Initializing GeM Platform...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isOfficer) {
    return <Navigate to="/officer/dashboard" replace />;
  }

  if (isBidder) {
    return <Navigate to="/bidder/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="gem-app-root">
          <Navbar />
          <main className="gem-main-content">
            <Routes>
              {/* Root Navigation */}
              <Route path="/" element={<RootRedirect />} />

              {/* Public Authentication Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register/officer" element={<RegisterOfficer />} />
              <Route path="/register/bidder" element={<RegisterBidder />} />

              {/* Protected Government Officer Routes */}
              <Route
                path="/officer/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["officer"]}>
                    <OfficerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/tenders"
                element={
                  <ProtectedRoute allowedRoles={["officer"]}>
                    <OfficerTenders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/tenders/create"
                element={
                  <ProtectedRoute allowedRoles={["officer"]}>
                    <OfficerTenders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/tenders/:id"
                element={
                  <ProtectedRoute allowedRoles={["officer"]}>
                    <TenderApplicants />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/applications/:id"
                element={
                  <ProtectedRoute allowedRoles={["officer"]}>
                    <ApplicationDetail />
                  </ProtectedRoute>
                }
              />

              {/* Preserved Full Compliance Cockpit (Officer & Audit Review) */}
              <Route
                path="/compliance-cockpit"
                element={
                  <ProtectedRoute allowedRoles={["officer"]}>
                    <ComplianceCockpit />
                  </ProtectedRoute>
                }
              />

              {/* Protected Enterprise Bidder Routes */}
              <Route
                path="/bidder/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["bidder"]}>
                    <BidderDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bidder/tenders"
                element={
                  <ProtectedRoute allowedRoles={["bidder"]}>
                    <AvailableTenders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bidder/tenders/:id"
                element={
                  <ProtectedRoute allowedRoles={["bidder"]}>
                    <AvailableTenders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bidder/applications"
                element={
                  <ProtectedRoute allowedRoles={["bidder"]}>
                    <MyApplications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bidder/documents"
                element={
                  <ProtectedRoute allowedRoles={["bidder"]}>
                    <DocumentVault />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bidder/profile"
                element={
                  <ProtectedRoute allowedRoles={["bidder"]}>
                    <BidderProfile />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
