import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  const [loading, setLoading] = useState(true);

  // Sync state changes with localStorage
  const setAuthData = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    if (newToken) {
      localStorage.setItem("access_token", newToken);
    } else {
      localStorage.removeItem("access_token");
    }
    if (newUser) {
      localStorage.setItem("user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("user");
    }
  }, []);

  // Validate token on mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem("access_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get("/api/auth/me");
        setUser(response.data);
        localStorage.setItem("user", JSON.stringify(response.data));
      } catch (err) {
        console.error("Session verification failed:", err);
        setAuthData(null, null);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [setAuthData]);

  const login = async (email, password) => {
    const response = await api.post("/api/auth/login", { email, password });
    const { access_token, user: userData } = response.data;
    setAuthData(access_token, userData);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post("/api/auth/register", { name, email, password });
    return response.data;
  };

  const verifyEmail = async (email, otp) => {
    const response = await api.post("/api/auth/verify-email", { email, otp });
    const { access_token, user: userData } = response.data;
    setAuthData(access_token, userData);
    return response.data;
  };

  const resendVerification = async (email) => {
    const response = await api.post("/api/auth/resend-verification", { email });
    return response.data;
  };

  const forgotPassword = async (email) => {
    const response = await api.post("/api/auth/forgot-password", { email });
    return response.data;
  };

  const verifyResetOtp = async (email, otp) => {
    const response = await api.post("/api/auth/verify-reset-otp", { email, otp });
    return response.data;
  };

  const resetPassword = async (email, otp, newPassword) => {
    const response = await api.post("/api/auth/reset-password", {
      email,
      otp,
      new_password: newPassword,
    });
    return response.data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const response = await api.post("/api/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  };

  const updateProfile = async (name, avatarUrl) => {
    const response = await api.put("/api/auth/profile", {
      name,
      avatar_url: avatarUrl,
    });
    const updatedUser = response.data.user;
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
    return response.data;
  };

  const logout = () => {
    try {
      api.post("/api/auth/logout");
    } catch {
      // Ignore logout api errors
    }
    setAuthData(null, null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    changePassword,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
