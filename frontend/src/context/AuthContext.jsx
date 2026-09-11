import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("gem_token") || null);
  const [loading, setLoading] = useState(true);

  // Initialize and hydrate user on load
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          localStorage.removeItem("gem_token");
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Login failed.");
    }
    localStorage.setItem("gem_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const registerOfficer = async (officerData) => {
    const response = await fetch("/api/auth/register/officer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(officerData),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Officer registration failed.");
    }
    localStorage.setItem("gem_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const registerBidder = async (bidderData) => {
    const response = await fetch("/api/auth/register/bidder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bidderData),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Bidder registration failed.");
    }
    localStorage.setItem("gem_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("gem_token");
    setToken(null);
    setUser(null);
  };

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        registerOfficer,
        registerBidder,
        logout,
        authFetch,
        isAuthenticated: Boolean(user),
        isOfficer: user?.role === "officer",
        isBidder: user?.role === "bidder",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
