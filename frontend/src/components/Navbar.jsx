import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Video, User, LogOut, Settings, ChevronDown, Plus, Radio } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    toast.info("You have been signed out.");
    navigate("/login");
  };

  return (
    <header className="top-navbar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Link to="/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div className="brand-icon" style={{ width: "32px", height: "32px" }}>
            <Video size={18} />
          </div>
          <span style={{ fontSize: "16px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px" }}>
            AI Meeting Intel
          </span>
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          className="btn btn-primary"
          style={{ padding: "8px 16px", fontSize: "13px" }}
          onClick={() => navigate("/dashboard")}
        >
          <Plus size={16} />
          <span>New Meeting</span>
        </button>

        {/* User Profile Menu */}
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              padding: "6px 12px",
              borderRadius: "var(--radius-full)",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary), var(--accent-indigo))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "700",
                color: "#ffffff",
              }}
            >
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <span style={{ fontSize: "13px", fontWeight: "600", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name || "Account"}
            </span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "220px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
                padding: "8px",
                boxShadow: "var(--shadow-lg)",
                zIndex: 100,
                animation: "slideIn 0.2s ease-out",
              }}
            >
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "4px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff" }}>{user?.name}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.email}
                </div>
              </div>

              <Link
                to="/profile"
                onClick={() => setDropdownOpen(false)}
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px", fontSize: "13px" }}
              >
                <User size={15} />
                <span>Profile</span>
              </Link>

              <Link
                to="/settings"
                onClick={() => setDropdownOpen(false)}
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px", fontSize: "13px" }}
              >
                <Settings size={15} />
                <span>Settings</span>
              </Link>

              <div style={{ height: "1px", background: "var(--border-subtle)", margin: "4px 0" }} />

              <button
                onClick={handleLogout}
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px", fontSize: "13px", color: "var(--accent-rose)" }}
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
