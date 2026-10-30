import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Mail, CheckCircle2, RotateCw, ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import OtpInput from "../components/OtpInput";
import LoadingSpinner from "../components/LoadingSpinner";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState("");

  // Countdown timer for resend
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      handleVerify();
    }
  }, [otp]);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!email.trim()) {
      setError("Email address is missing.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await verifyEmail(email.trim(), otp);
      toast.success(data.message || "Email verified! Welcome to AI Meeting Intelligence.");
      navigate("/dashboard");
    } catch (err) {
      const errMsg = err.response?.data?.message || "Invalid or expired verification code. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending || !email.trim()) return;

    setResending(true);
    setError("");

    try {
      const data = await resendVerification(email.trim());
      toast.success(data.message || "A fresh verification code has been sent!");
      setCountdown(60);
      setCanResend(false);
      setOtp("");
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to resend code. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setResending(false);
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
              background: "rgba(56, 189, 248, 0.15)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
              margin: "0 auto 16px",
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 className="auth-title">Verify your email</h1>
          <p className="auth-subtitle">
            We sent a 6-digit verification code to
            <br />
            <strong style={{ color: "#ffffff" }}>{email || "your email address"}</strong>
          </p>
        </div>

        {location.state?.mock_mode && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              marginBottom: "18px",
              fontSize: "12px",
              color: "#fde68a",
              lineHeight: "1.5",
            }}
          >
            <strong>Note:</strong> Real SMTP is not configured in .env yet.
            {location.state?.dev_otp ? (
              <span> Your development verification code is: <strong style={{ letterSpacing: "2px", color: "#ffffff", background: "#0f172a", padding: "2px 6px", borderRadius: "4px" }}>{location.state.dev_otp}</strong>.</span>
            ) : (
              <span> Check your server terminal console for the verification code.</span>
            )}
            {" "}To receive real emails in your inbox, configure your Gmail App Password in Settings.
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--accent-rose)", fontSize: "13px", marginBottom: "18px" }}>
            {error}
          </div>
        )}

        {!location.state?.email && (
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon-left" size={18} />
              <input
                type="email"
                className="input-field has-left-icon"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                disabled={loading}
              />
            </div>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
              Enter 6-digit verification code:
            </span>
          </div>

          <OtpInput
            length={6}
            value={otp}
            onChange={setOtp}
            disabled={loading}
          />

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || otp.length !== 6}
            style={{ marginTop: "12px" }}
          >
            {loading ? (
              <LoadingSpinner size={18} text="Verifying code..." inline />
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Verify & Activate Account</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: "18px" }}>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
            Didn't receive the code? Check spam folder or resend:
          </p>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={handleResend}
            disabled={!canResend || resending}
            style={{ fontSize: "13px", padding: "10px 16px" }}
          >
            <RotateCw size={14} className={resending ? "spin" : ""} />
            <span>
              {resending
                ? "Sending new code..."
                : canResend
                ? "Resend Verification Code"
                : `Resend code in ${countdown}s`}
            </span>
          </button>

          <div style={{ marginTop: "18px" }}>
            <Link to="/register" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
              <ArrowLeft size={14} />
              <span>Back to Register</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
