import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Plus, LogIn, Copy, Check, Sparkles, Users, Calendar, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning("Please enter a meeting title.");
      return;
    }

    setCreating(true);
    try {
      const response = await api.post("/api/meetings/create", { title: title.trim() });
      setCreatedMeeting(response.data.meeting);
      toast.success("Meeting created successfully!");
      setTitle("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create meeting.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinMeeting = async (e) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    const name = displayName.trim() || user?.name || "Guest";

    if (!code) {
      toast.warning("Please enter a room code.");
      return;
    }

    setJoining(true);
    try {
      const response = await api.post("/api/meetings/join", {
        room_code: code,
        display_name: name,
      });
      toast.success("Joining meeting...");
      navigate(`/meeting/${response.data.meeting.room_code}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to join meeting.");
    } finally {
      setJoining(false);
    }
  };

  const copyMeetingCode = () => {
    if (!createdMeeting?.room_code) return;
    navigator.clipboard.writeText(createdMeeting.room_code);
    setCopied(true);
    toast.info("Room code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />

        <div className="page-body">
          {/* Welcome Banner */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(99, 102, 241, 0.15))",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 28px",
              marginBottom: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)", fontSize: "13px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
                <Sparkles size={16} />
                <span>AI Meeting Intelligence</span>
              </div>
              <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#ffffff", marginTop: "4px" }}>
                Welcome back, {user?.name || "User"}!
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Start a live conference with real-time speech-to-text, live captions, and AI summaries.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const input = document.getElementById("create-meeting-input");
                  input?.focus();
                }}
              >
                <Plus size={16} />
                <span>Create Instant Room</span>
              </button>
            </div>
          </div>

          {/* Quick Action Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginBottom: "32px" }}>
            {/* Create Meeting Card */}
            <div className="stat-card" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-md)", background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff" }}>Create a New Meeting</h2>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Generate a room code and invite participants</p>
                </div>
              </div>

              <form onSubmit={handleCreateMeeting}>
                <div className="form-group">
                  <label className="form-label">Meeting Topic / Agenda</label>
                  <input
                    id="create-meeting-input"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Sprint Planning & AI Architecture"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={creating}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={creating || !title.trim()}>
                  {creating ? <LoadingSpinner size={16} text="Creating..." inline /> : "Create Room"}
                </button>
              </form>

              {createdMeeting && (
                <div style={{ marginTop: "18px", padding: "14px", background: "var(--bg-surface)", border: "1px solid var(--border-base)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontSize: "12px", color: "var(--accent-emerald)", fontWeight: "700", marginBottom: "6px" }}>
                    ✓ Room Ready
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff" }}>{createdMeeting.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                    <div style={{ flex: 1, padding: "8px 12px", background: "var(--bg-main)", borderRadius: "var(--radius-sm)", fontFamily: "monospace", fontSize: "16px", fontWeight: "700", color: "var(--primary)", letterSpacing: "2px" }}>
                      {createdMeeting.room_code}
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={copyMeetingCode} style={{ padding: "8px 12px" }}>
                      {copied ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    style={{ marginTop: "10px" }}
                    onClick={() => navigate(`/meeting/${createdMeeting.room_code}`)}
                  >
                    <span>Enter Meeting Room</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Join Meeting Card */}
            <div className="stat-card" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-md)", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-indigo)" }}>
                  <LogIn size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff" }}>Join via Room Code</h2>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Enter an 8-character meeting code</p>
                </div>
              </div>

              <form onSubmit={handleJoinMeeting}>
                <div className="form-group">
                  <label className="form-label">Room Code</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="e.g. ABCD1234"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={12}
                    disabled={joining}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Your Display Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={joining}
                  />
                </div>

                <button type="submit" className="btn btn-secondary btn-block" disabled={joining || !roomCode.trim()}>
                  {joining ? <LoadingSpinner size={16} text="Joining..." inline /> : "Join Meeting Room"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}