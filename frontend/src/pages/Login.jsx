import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Video, Mail, Lock, Eye, EyeOff, ArrowRight, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const from = location.state?.from?.pathname || "/dashboard";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const data = await login(email.trim(), password);
      toast.success(data.message || "Welcome back!");
      navigate(from, { replace: true });
    } catch (err) {
      const respData = err.response?.data;

      // Handle unverified user redirect
      if (err.response?.status === 403 && respData?.require_verification) {
        toast.warning(respData.message || "Please verify your email.");
        navigate("/verify-email", { state: { email: email.trim() } });
        return;
      }

      const errMsg = respData?.message || "Invalid email or password. Please try again.";
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
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your account to continue</p>
        </div>

        {error && (
          <div style={{ background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--accent-rose)", fontSize: "13px", marginBottom: "18px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon-left" size={18} />
              <input
                type="email"
                className="input-field has-left-icon"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">
              <span>Password</span>
              <Link to="/forgot-password" style={{ fontSize: "12px", fontWeight: "600" }}>
                Forgot password?
              </Link>
            </div>
            <div className="input-wrapper">
              <Lock className="input-icon-left" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field has-left-icon has-right-icon"
                placeholder="Enter your password"
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
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: "12px" }}
            disabled={loading}
          >
            {loading ? (
              <LoadingSpinner size={18} text="Signing in..." inline />
            ) : (
              <>
                <LogIn size={16} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--text-secondary)" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ fontWeight: "700" }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}