import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Video, History, UploadCloud, User, Settings, Sparkles } from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Profile", path: "/profile", icon: User },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon" style={{ width: "32px", height: "32px" }}>
          <Sparkles size={18} />
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#ffffff" }}>Meeting Intel</div>
          <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: "600" }}>AI Platform</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "16px", borderTop: "1px solid var(--border-subtle)", margin: "auto 0 0 0" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-emerald)", fontSize: "12px", fontWeight: "700" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-emerald)" }} />
            <span>AI Online</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Whisper & NLP Active
          </div>
        </div>
      </div>
    </aside>
  );
}
