import { useState } from "react";
import { User, Mail, Shield, KeyRound, CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }

    setUpdatingProfile(true);
    try {
      const res = await updateProfile(name.trim(), avatarUrl.trim());
      toast.success(res.message || "Profile updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Please fill out all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      toast.success(res.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />

        <div className="page-body" style={{ maxWidth: "900px" }}>
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#ffffff" }}>Account Profile</h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Manage your personal credentials, identity, and security preferences
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
            {/* Identity Card */}
            <div className="stat-card" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--primary), var(--accent-indigo))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    fontWeight: "800",
                    color: "#ffffff",
                    boxShadow: "0 4px 14px rgba(56, 189, 248, 0.35)",
                  }}
                >
                  {user?.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#ffffff" }}>{user?.name}</h2>
                    {user?.is_verified ? (
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    ) : (
                      <span className="badge badge-warning">Unverified</span>
                    )}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    {user?.email}
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <div className="input-wrapper">
                      <User className="input-icon-left" size={16} />
                      <input
                        type="text"
                        className="input-field has-left-icon"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={updatingProfile}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address (Read-only)</label>
                    <div className="input-wrapper">
                      <Mail className="input-icon-left" size={16} />
                      <input
                        type="email"
                        className="input-field has-left-icon"
                        value={user?.email || ""}
                        disabled
                        style={{ opacity: 0.6 }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingProfile}
                  style={{ marginTop: "8px" }}
                >
                  {updatingProfile ? <LoadingSpinner size={16} text="Saving..." inline /> : "Save Profile Changes"}
                </button>
              </form>
            </div>

            {/* Security / Change Password */}
            <div className="stat-card" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "var(--radius-md)", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-indigo)" }}>
                  <KeyRound size={18} />
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff" }}>Change Password</h2>
              </div>

              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon-left" size={16} />
                    <input
                      type="password"
                      className="input-field has-left-icon"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      disabled={changingPassword}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon-left" size={16} />
                      <input
                        type="password"
                        className="input-field has-left-icon"
                        placeholder="Min. 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        disabled={changingPassword}
                      />
                    </div>
                    <PasswordStrengthMeter password={newPassword} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon-left" size={16} />
                      <input
                        type="password"
                        className="input-field has-left-icon"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={changingPassword}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={changingPassword}
                  style={{ marginTop: "8px" }}
                >
                  {changingPassword ? <LoadingSpinner size={16} text="Updating..." inline /> : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
