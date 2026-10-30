import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Mic,
  Video,
  Subtitles,
  Check,
  Mail,
  Send,
  Shield,
  HelpCircle,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import api from "../api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Settings() {
  const toast = useToast();

  // Media preferences
  const [defaultMic, setDefaultMic] = useState(() => localStorage.getItem("setting_default_mic") !== "false");
  const [defaultCam, setDefaultCam] = useState(() => localStorage.getItem("setting_default_cam") !== "false");
  const [captions, setCaptions] = useState(() => localStorage.getItem("setting_captions") === "true");

  // SMTP Settings State
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [loadingSmtp, setLoadingSmtp] = useState(false);
  const [mailServer, setMailServer] = useState("smtp.gmail.com");
  const [mailPort, setMailPort] = useState(587);
  const [mailUseTls, setMailUseTls] = useState(true);
  const [mailUsername, setMailUsername] = useState("");
  const [mailPassword, setMailPassword] = useState("");
  const [mailSender, setMailSender] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);

  // Test Email State
  const [testEmail, setTestEmail] = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    fetchSmtpStatus();
  }, []);

  const fetchSmtpStatus = async () => {
    setLoadingSmtp(true);
    try {
      const res = await api.get("/api/auth/smtp-status");
      setSmtpStatus(res.data);
      if (res.data?.mail_server) setMailServer(res.data.mail_server);
      if (res.data?.mail_port) setMailPort(res.data.mail_port);
      if (res.data?.mail_use_tls !== undefined) setMailUseTls(res.data.mail_use_tls);
    } catch (err) {
      console.error("Failed to fetch SMTP status:", err);
    } finally {
      setLoadingSmtp(false);
    }
  };

  const handleSaveMedia = () => {
    localStorage.setItem("setting_default_mic", defaultMic);
    localStorage.setItem("setting_default_cam", defaultCam);
    localStorage.setItem("setting_captions", captions);
    toast.success("Media preferences saved successfully!");
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    if (!mailUsername.trim()) {
      toast.warning("Please enter your email address (username).");
      return;
    }
    if (!mailPassword.trim()) {
      toast.warning("Please enter your email password (or Google App Password).");
      return;
    }

    setSavingSmtp(true);
    try {
      const res = await api.post("/api/auth/update-smtp", {
        mail_username: mailUsername.trim(),
        mail_password: mailPassword.trim(),
        mail_server: mailServer.trim(),
        mail_port: Number(mailPort),
        mail_use_tls: mailUseTls,
        mail_default_sender: mailSender.trim() || undefined,
      });

      toast.success(res.data?.message || "Email settings saved and activated!");
      setSmtpStatus(res.data?.smtp_status);
      setMailPassword(""); // Clear password field after saving
      fetchSmtpStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update SMTP settings.");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    const target = testEmail.trim() || mailUsername.trim();
    if (!target) {
      toast.warning("Please provide a recipient email to send the test message to.");
      return;
    }

    setTestingSmtp(true);
    setTestResult(null);

    try {
      const res = await api.post("/api/auth/test-smtp", { test_email: target });
      setTestResult({ success: true, message: res.data?.message || "Test email sent successfully! Check your inbox." });
      toast.success("Test email sent! Please check your inbox.");
    } catch (err) {
      const msg = err.response?.data?.message || "Test connection failed.";
      setTestResult({ success: false, message: msg });
      toast.error("SMTP Test Failed: " + msg);
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />

        <div className="page-body" style={{ maxWidth: "860px" }}>
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#ffffff" }}>Settings</h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Configure media defaults and meeting preferences
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Audio / Video defaults */}
            <div className="stat-card" style={{ display: "block" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff", marginBottom: "16px" }}>
                Default Media States
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Mic size={18} color="var(--primary)" />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#ffffff" }}>Join with Microphone On</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Microphone is unmuted by default when joining</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={defaultMic}
                    onChange={(e) => setDefaultMic(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                </label>

                <div style={{ height: "1px", background: "var(--border-subtle)" }} />

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Video size={18} color="var(--accent-indigo)" />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#ffffff" }}>Join with Camera On</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Video camera is active by default when entering a room</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={defaultCam}
                    onChange={(e) => setDefaultCam(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                </label>

                <div style={{ height: "1px", background: "var(--border-subtle)" }} />

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Subtitles size={18} color="var(--accent-emerald)" />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#ffffff" }}>Live Captions by Default</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Automatically enable Whisper speech subtitles</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={captions}
                    onChange={(e) => setCaptions(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                </label>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveMedia}
                style={{ marginTop: "24px" }}
              >
                <Check size={16} />
                <span>Save Media Preferences</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
