import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Video, User, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters long.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const data = await register(name.trim(), email.trim(), password);
      toast.success(data.message || "Account created! Please check your email for the 6-digit OTP.");
      // Navigate to email verification screen
      navigate("/verify-email", {
        state: {
          email: email.trim(),
          name: name.trim(),
          mock_mode: data.mock_mode,
          dev_otp: data.dev_otp,
        }
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || "Registration failed. Please check your details.";
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
          <div className="brand-logo">
            <div className="brand-icon">
              <Video size={22} />
            </div>
            <span className="brand-title">AI Meeting Intel</span>
          </div>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Join real-time AI meetings and intelligent summaries</p>
        </div>

        {error && (
          <div style={{ background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--accent-rose)", fontSize: "13px", marginBottom: "18px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="input-wrapper">
              <User className="input-icon-left" size={18} />
              <input
                type="text"
                className="input-field has-left-icon"
                placeholder="e.g. Alex Mercer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon-left" size={18} />
              <input
                type="email"
                className="input-field has-left-icon"
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon-left" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field has-left-icon has-right-icon"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <PasswordStrengthMeter password={password} />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon-left" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field has-left-icon"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <div className="input-error-text">Passwords do not match</div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: "10px" }}
            disabled={loading}
          >
            {loading ? (
              <LoadingSpinner size={18} text="Creating account..." inline />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ fontWeight: "700" }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}