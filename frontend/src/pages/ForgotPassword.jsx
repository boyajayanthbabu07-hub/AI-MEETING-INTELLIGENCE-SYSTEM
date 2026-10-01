import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await forgotPassword(email.trim());
      toast.success(data.message || "Password reset code sent!");
      navigate("/reset-password", { state: { email: email.trim() } });
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to send reset code. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="brand-header">
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-rose)",
              margin: "0 auto 16px",
            }}
          >
            <KeyRound size={28} />
          </div>
          <h1 className="auth-title">Forgot password?</h1>
          <p className="auth-subtitle">
            Enter your email and we'll send you a 6-digit code to reset your password.
          </p>
        </div>

        {error && (
          <div style={{ background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--accent-rose)", fontSize: "13px", marginBottom: "18px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon-left" size={18} />
              <input
                type="email"
                className="input-field has-left-icon"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
            style={{ marginTop: "12px" }}
          >
            {loading ? (
              <LoadingSpinner size={18} text="Sending reset code..." inline />
            ) : (
              <>
                <span>Send Reset Code</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <Link to="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
            <ArrowLeft size={14} />
            <span>Back to Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
