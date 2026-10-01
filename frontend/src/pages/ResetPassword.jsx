import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle2, ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import OtpInput from "../components/OtpInput";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (otp.length !== 6) {
      setError("Please enter the 6-digit reset code.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await resetPassword(email.trim(), otp, newPassword);
      toast.success(data.message || "Password reset successfully! Please sign in.");
      navigate("/login");
    } catch (err) {
      const errMsg = err.response?.data?.message || "Password reset failed. Invalid or expired code.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: "460px" }}>
        <div className="brand-header">
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-indigo)",
              margin: "0 auto 16px",
            }}
          >
            <ShieldAlert size={28} />
          </div>
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">
            Enter the 6-digit reset code sent to
            <br />
            <strong style={{ color: "#ffffff" }}>{email || "your email"}</strong>
          </p>
        </div>

        {error && (
          <div style={{ background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--accent-rose)", fontSize: "13px", marginBottom: "18px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleReset}>
          <div style={{ textAlign: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
              6-Digit Reset Code:
            </span>
          </div>

          <OtpInput length={6} value={otp} onChange={setOtp} disabled={loading} />

          <div className="form-group" style={{ marginTop: "16px" }}>
            <label className="form-label">New Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon-left" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field has-left-icon has-right-icon"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon-left" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field has-left-icon"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <div className="input-error-text">Passwords do not match</div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || otp.length !== 6}
            style={{ marginTop: "12px" }}
          >
            {loading ? (
              <LoadingSpinner size={18} text="Resetting password..." inline />
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Reset Password & Sign In</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <Link to="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
            <ArrowLeft size={14} />
            <span>Cancel and return to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
