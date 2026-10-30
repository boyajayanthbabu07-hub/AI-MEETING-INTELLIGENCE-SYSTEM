import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Plus,
  LogIn,
  Copy,
  Check,
  Sparkles,
  Users,
  Calendar,
  ArrowRight,
  Shield,
  Key,
  Mail,
  RefreshCw,
  ExternalLink,
  Lock,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import InviteModal from "../components/InviteModal";
import MeetingIntelligenceModal from "../components/MeetingIntelligenceModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Create Meeting State
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState("internal"); // "internal" | "google_meet"
  const [externalLink, setExternalLink] = useState("");
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);

  // Search across meetings & transcripts
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Meeting Intelligence Modal State
  const [intelModalOpen, setIntelModalOpen] = useState(false);
  const [selectedMeetingForIntel, setSelectedMeetingForIntel] = useState(null);

  // Join Meeting State
  const [roomCode, setRoomCode] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [joining, setJoining] = useState(false);

  // My Meetings List
  const [myMeetings, setMyMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

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

  useEffect(() => {
    fetchMyMeetings();
  }, []);

  const fetchMyMeetings = async () => {
    setLoadingMeetings(true);
    try {
      const res = await api.get("/api/meetings/my-meetings");
      setMyMeetings(res.data?.meetings || []);
    } catch (err) {
      console.error("Failed to load user meetings:", err);
    } finally {
      setLoadingMeetings(false);
    }
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

      // Refresh recent list
      fetchMyMeetings();

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

  const openIntelModal = (meeting) => {
    setSelectedMeetingForIntel(meeting);
    setIntelModalOpen(true);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const res = await api.get(`/api/meetings/search?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data?.results || []);
    } catch (err) {
      console.warn("Search error:", err);
      toast.error("Failed to execute search across meetings.");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
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

          {/* Search Across Previous Meetings & Transcripts */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 20px",
              marginBottom: "28px",
            }}
          >
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: "40px" }}
                  placeholder="Search previous meetings, topics, decisions, action items, or transcripts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-secondary" disabled={searching || !searchQuery.trim()}>
                {searching ? <LoadingSpinner size={14} text="" inline /> : <Search size={15} />}
                <span>{searching ? "Searching..." : "Search"}</span>
              </button>
              {searchResults !== null && (
                <button type="button" onClick={clearSearch} className="btn btn-secondary">
                  Clear
                </button>
              )}
            </form>

            {/* Search Results Display */}
            {searchResults !== null && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff", marginBottom: "10px" }}>
                  Search Results ({searchResults.length})
                </div>

                {searchResults.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
                    No meetings, decisions, or transcripts matched "{searchQuery}".
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--bg-card)",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-subtle)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "800",
                                textTransform: "uppercase",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background:
                                  item.type === "transcript"
                                    ? "rgba(56, 189, 248, 0.15)"
                                    : item.type === "decision"
                                    ? "rgba(16, 185, 129, 0.15)"
                                    : item.type === "action_item"
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(99, 102, 241, 0.15)",
                                color:
                                  item.type === "transcript"
                                    ? "var(--primary)"
                                    : item.type === "decision"
                                    ? "var(--accent-emerald)"
                                    : item.type === "action_item"
                                    ? "#fbbf24"
                                    : "var(--accent-indigo)",
                              }}
                            >
                              {item.type.replace("_", " ")}
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff" }}>
                              {item.title}
                            </span>
                            {item.timestamp_str && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                [{item.timestamp_str}]
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                            {item.snippet}
                          </p>
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => openIntelModal({ room_code: item.room_code, title: item.title })}
                          >
                            <Sparkles size={12} />
                            <span>Intel</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: "4px 10px", fontSize: "11px" }}
                            onClick={() => navigate(`/meeting/${item.room_code}`)}
                          >
                            <span>Enter</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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

              {/* Host Mode Selector Tabs */}
              <div
                style={{
                  display: "flex",
                  background: "var(--bg-main)",
                  padding: "4px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "16px",
                }}
              >
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: "600",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: meetingType === "internal" ? "var(--primary)" : "transparent",
                    color: meetingType === "internal" ? "#ffffff" : "var(--text-secondary)",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => setMeetingType("internal")}
                >
                  AI Video Room
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: "600",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: meetingType === "google_meet" ? "#ea4335" : "transparent",
                    color: meetingType === "google_meet" ? "#ffffff" : "var(--text-secondary)",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => setMeetingType("google_meet")}
                >
                  Google Meet Host
                </button>
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
                  disabled={creating || !title.trim() || (meetingType === "google_meet" && !externalLink.trim())}
                >
                  {creating ? (
                    <LoadingSpinner size={16} text="Creating..." inline />
                  ) : meetingType === "google_meet" ? (
                    "Create Google Meet Session"
                  ) : (
                    "Create Meeting Room"
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

          {/* My Hosted Meetings */}
          <div className="stat-card" style={{ display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Calendar size={18} color="var(--primary)" />
                <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                  My Hosted Meetings
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                onClick={fetchMyMeetings}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingMeetings ? (
              <div style={{ padding: "30px", textAlign: "center" }}>
                <LoadingSpinner size={24} text="Loading meetings..." />
              </div>
            ) : myMeetings.length === 0 ? (
              <div
                style={{
                  padding: "36px",
                  textAlign: "center",
                  background: "var(--bg-main)",
                  borderRadius: "var(--radius-md)",
                  border: "1px dashed var(--border-subtle)",
                }}
              >
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
                  You haven't hosted any meetings yet. Create your first meeting above to invite colleagues!
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-base)", color: "var(--text-muted)" }}>
                      <th style={{ padding: "10px 12px" }}>Meeting Topic</th>
                      <th style={{ padding: "10px 12px" }}>Platform</th>
                      <th style={{ padding: "10px 12px" }}>Meeting ID</th>
                      <th style={{ padding: "10px 12px" }}>Password</th>
                      <th style={{ padding: "10px 12px" }}>Status</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myMeetings.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "12px", fontWeight: "600", color: "#ffffff" }}>
                          {m.title}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {m.meeting_type === "google_meet" ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "rgba(234, 67, 53, 0.15)",
                                color: "#ea4335",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "700",
                              }}
                            >
                              Google Meet
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "rgba(56, 189, 248, 0.15)",
                                color: "var(--primary)",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "700",
                              }}
                            >
                              AI Intel Room
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px", fontFamily: "monospace", color: "var(--primary)", fontWeight: "700" }}>
                          {m.room_code}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {m.passcode ? (
                            <span
                              style={{
                                fontFamily: "monospace",
                                color: "#fbbf24",
                                fontWeight: "700",
                                background: "rgba(245, 158, 11, 0.1)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {m.passcode}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: "600",
                              background:
                                m.status === "active"
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : "rgba(100, 116, 139, 0.15)",
                              color:
                                m.status === "active"
                                  ? "var(--accent-emerald)"
                                  : "var(--text-secondary)",
                            }}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "6px 10px", fontSize: "12px", color: "var(--primary)" }}
                              onClick={() => openIntelModal(m)}
                              title="View AI Meeting Intelligence, Notes & Transcripts"
                            >
                              <Sparkles size={14} />
                              <span>Intel</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "6px 10px", fontSize: "12px" }}
                              onClick={() => openInviteModal(m)}
                              title="Send Email Invites"
                            >
                              <Mail size={14} />
                              <span>Invite</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => {
                                if (m.meeting_type === "google_meet" && m.external_link) {
                                  window.open(m.external_link, "_blank");
                                } else {
                                  navigate(`/meeting/${m.room_code}`);
                                }
                              }}
                            >
                              <span>Enter</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Attendees Modal */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        meeting={selectedMeetingForInvite}
      />

      {/* Meeting Intelligence Modal */}
      <MeetingIntelligenceModal
        isOpen={intelModalOpen}
        onClose={() => setIntelModalOpen(false)}
        meeting={selectedMeetingForIntel}
      />
    </div>
  );
}