import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, Users, User, Settings } from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Hosted Meetings", path: "/hosted-meetings", icon: Calendar },
    { label: "Joined Meetings", path: "/joined-meetings", icon: Users },
    { label: "Profile", path: "/profile", icon: User },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px" }}>
        <img
          src="/logo.png"
          alt="AI Meeting Intelligence Logo"
          style={{ width: "46px", height: "46px", objectFit: "contain", borderRadius: "10px" }}
        />
        <div>
          <div style={{ fontSize: "15px", fontWeight: "800", color: "#ffffff" }}>Meeting Intel</div>
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
    </aside>
  );
}
