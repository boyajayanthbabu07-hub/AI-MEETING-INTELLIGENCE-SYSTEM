import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Plus,
  LogIn,
  Copy,
  Check,
  Sparkles,
  Calendar,
  Users,
  ArrowRight,
  Shield,
  Key,
  Mail,
  RefreshCw,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import InviteModal from "../components/InviteModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Create Meeting State
  const [title, setTitle] = useState("");
  const meetingType = "internal";
  const [externalLink, setExternalLink] = useState("");
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);

  // Join Meeting State
  const [roomCode, setRoomCode] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [joining, setJoining] = useState(false);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedMeetingForInvite, setSelectedMeetingForInvite] = useState(null);

  // Copy states
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);

  // Generate random 6-digit passcode
  const generateNewPasscode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPasscode(code);
    return code;
  };

  const handleTogglePasscode = (checked) => {
    setRequirePasscode(checked);
    if (checked && !passcode) {
      generateNewPasscode();
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning("Please enter a meeting title / agenda.");
      return;
    }

    if (meetingType === "google_meet" && !externalLink.trim()) {
      toast.warning("Please enter your Google Meet link.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title: title.trim(),
        meeting_type: meetingType,
        external_link: meetingType === "google_meet" ? externalLink.trim() : null,
        require_passcode: requirePasscode,
        passcode: requirePasscode ? passcode.trim() : null,
      };

      const response = await api.post("/api/meetings/create", payload);
      const meeting = response.data.meeting;
      setCreatedMeeting(meeting);
      toast.success("Meeting room created successfully!");

      // Reset form fields
      setTitle("");
      setExternalLink("");
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
      toast.warning("Please enter a room code / Meeting ID.");
      return;
    }

    setJoining(true);
    try {
      const response = await api.post("/api/meetings/join", {
        room_code: code,
        display_name: name,
        passcode: joinPasscode.trim() || null,
      });

      toast.success("Entering meeting room...");
      navigate(`/meeting/${response.data.meeting.room_code}`);
    } catch (error) {
      if (error.response?.data?.require_passcode) {
        setNeedsPasscode(true);
        toast.warning(error.response.data.message || "This meeting requires a password.");
      } else {
        toast.error(error.response?.data?.message || "Failed to join meeting.");
      }
    } finally {
      setJoining(false);
    }
  };

  const openInviteModal = (meeting) => {
    setSelectedMeetingForInvite(meeting);
    setInviteModalOpen(true);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navbar />

        <div className="page-body" style={{ flex: 1 }}>
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                <Sparkles size={16} />
                <span>AI Meeting Intelligence</span>
              </div>
              <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#ffffff", marginTop: "4px" }}>
                Welcome back, {user?.name || "User"}!
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Host secure video meetings, invite attendees with direct links and passwords, or launch Google Meet.
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            {/* Create Meeting Card */}
            <div className="stat-card" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(56, 189, 248, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                  }}
                >
                  <Plus size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff" }}>Create a New Meeting</h2>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Generate Meeting ID, password, and dispatch email invites
                  </p>
                </div>
              </div>

              {/* Platform Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--bg-main)",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Video size={16} color="var(--primary)" />
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff" }}>
                    AI Video Room
                  </span>
                </div>
              </div>

              <form onSubmit={handleCreateMeeting}>
                <div className="form-group">
                  <label className="form-label">Meeting Topic / Agenda</label>
                  <input
                    id="create-meeting-input"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Architecture Review & AI Strategy"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={creating}
                  />
                </div>

                {meetingType === "google_meet" && (
                  <div className="form-group">
                    <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Google Meet Link</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        e.g. meet.google.com/abc-defg-hij
                      </span>
                    </label>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://meet.google.com/xxx-yyyy-zzz"
                      value={externalLink}
                      onChange={(e) => setExternalLink(e.target.value)}
                      disabled={creating}
                      required
                    />
                  </div>
                )}

                {/* Password / Passcode Option */}
                <div
                  style={{
                    background: "var(--bg-main)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px 14px",
                    marginBottom: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Key size={16} color="#fbbf24" />
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>
                        Protect with Meeting Password
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={requirePasscode}
                      onChange={(e) => handleTogglePasscode(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--primary)", cursor: "pointer" }}
                    />
                  </label>

                  {requirePasscode && (
                    <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="text"
                        className="input-field font-mono"
                        placeholder="e.g. 583921"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        maxLength={12}
                        style={{ fontSize: "14px", letterSpacing: "2px", fontWeight: "700" }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={generateNewPasscode}
                        title="Generate random password"
                        style={{ padding: "8px 12px" }}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={creating || !title.trim()}
                >
                  {creating ? (
                    <LoadingSpinner size={16} text="Creating..." inline />
                  ) : (
                    "Create AI Video Room"
                  )}
                </button>
              </form>

              {/* Created Meeting Card */}
              {createdMeeting && (
                <div
                  style={{
                    marginTop: "18px",
                    padding: "16px",
                    background: "var(--bg-main)",
                    border: "1px solid var(--accent-emerald)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--accent-emerald)",
                      fontWeight: "700",
                      marginBottom: "6px",
                    }}
                  >
                    ✓ Meeting Ready to Share
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#ffffff" }}>{createdMeeting.title}</div>

                  {/* ID & Password Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: createdMeeting.passcode ? "1fr 1fr" : "1fr", gap: "8px", marginTop: "10px" }}>
                    <div
                      style={{
                        padding: "8px 10px",
                        background: "var(--bg-surface)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Meeting ID
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "15px",
                          fontWeight: "800",
                          color: "var(--primary)",
                          letterSpacing: "1px",
                        }}
                      >
                        {createdMeeting.room_code}
                      </div>
                    </div>

                    {createdMeeting.passcode && (
                      <div
                        style={{
                          padding: "8px 10px",
                          background: "var(--bg-surface)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div style={{ fontSize: "10px", color: "#fbbf24", textTransform: "uppercase" }}>
                          Password
                        </div>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: "15px",
                            fontWeight: "800",
                            color: "#ffffff",
                            letterSpacing: "1px",
                          }}
                        >
                          {createdMeeting.passcode}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => openInviteModal(createdMeeting)}
                    >
                      <Mail size={15} />
                      <span>Send Invites</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1.2 }}
                      onClick={() => {
                        if (createdMeeting.meeting_type === "google_meet" && createdMeeting.external_link) {
                          window.open(createdMeeting.external_link, "_blank");
                        } else {
                          navigate(`/meeting/${createdMeeting.room_code}`);
                        }
                      }}
                    >
                      <span>Join Room</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Join Meeting Card */}
            <div className="stat-card" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(99, 102, 241, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent-indigo)",
                  }}
                >
                  <LogIn size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff" }}>Join via Meeting ID</h2>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Enter an 8-character code and optional password
                  </p>
                </div>
              </div>

              <form onSubmit={handleJoinMeeting}>
                <div className="form-group">
                  <label className="form-label">Meeting ID / Room Code</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="e.g. ABCD1234"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase());
                      setNeedsPasscode(false);
                    }}
                    maxLength={14}
                    disabled={joining}
                  />
                </div>

                {needsPasscode && (
                  <div className="form-group">
                    <label className="form-label" style={{ color: "#fbbf24", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Lock size={14} />
                      <span>Meeting Password / Passcode Required</span>
                    </label>
                    <input
                      type="password"
                      className="input-field font-mono"
                      placeholder="Enter 6-digit password"
                      value={joinPasscode}
                      onChange={(e) => setJoinPasscode(e.target.value)}
                      disabled={joining}
                      autoFocus
                    />
                  </div>
                )}

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
                  {joining ? <LoadingSpinner size={16} text="Connecting..." inline /> : "Join Meeting Room"}
                </button>
              </form>
            </div>
          </div>



          {/* Quick link to Meetings page */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "18px 24px",
              marginTop: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "rgba(56, 189, 248, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
                <Calendar size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                  Looking for your previous meetings & recordings?
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  Review Whisper transcripts, AI summaries, decisions, and past participant history in Meetings.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/hosted-meetings")}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Calendar size={14} />
                <span>Hosted Meetings</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/joined-meetings")}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Users size={14} />
                <span>Joined Meetings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Copyright Footer */}
        <footer
          style={{
            padding: "20px 24px",
            textAlign: "center",
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
            fontSize: "13px",
            background: "var(--bg-main)",
            marginTop: "auto",
          }}
        >
          <span>© {new Date().getFullYear()} AI Meeting Intelligence. All rights reserved.</span>
        </footer>
      </div>

      {/* Invite Attendees Modal */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        meeting={selectedMeetingForInvite}
      />
    </div>
  );
}