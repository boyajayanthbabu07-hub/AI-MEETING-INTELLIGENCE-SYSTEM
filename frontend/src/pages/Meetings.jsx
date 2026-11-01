import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Users,
  Search,
  FileText,
  Mail,
  RefreshCw,
  Trash2,
  Sparkles,
  ArrowRight,
  Shield,
  Video,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import InviteModal from "../components/InviteModal";
import MeetingIntelligenceModal from "../components/MeetingIntelligenceModal";

export default function Meetings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Search across meetings & transcripts
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // My Hosted Meetings List
  const [myMeetings, setMyMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // Joined Meetings List
  const [joinedMeetings, setJoinedMeetings] = useState([]);
  const [loadingJoinedMeetings, setLoadingJoinedMeetings] = useState(false);

  // Modals
  const [intelModalOpen, setIntelModalOpen] = useState(false);
  const [selectedMeetingForIntel, setSelectedMeetingForIntel] = useState(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedMeetingForInvite, setSelectedMeetingForInvite] = useState(null);

  useEffect(() => {
    fetchMyMeetings();
    fetchJoinedMeetings();
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

  const fetchJoinedMeetings = async () => {
    setLoadingJoinedMeetings(true);
    try {
      const res = await api.get("/api/meetings/joined-meetings");
      setJoinedMeetings(res.data?.meetings || []);
    } catch (err) {
      console.error("Failed to load joined meetings:", err);
    } finally {
      setLoadingJoinedMeetings(false);
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

  const handleDeleteMeeting = async (meetingId, meetingTitle) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${meetingTitle || "this meeting"}" from your account?\n\nThis will remove it only from your personal dashboard and will NOT affect other attendees or delete meeting records.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/meetings/${meetingId}`);
      toast.success("Meeting removed from your account.");
      setMyMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      setJoinedMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      if (searchResults) {
        setSearchResults((prev) => prev.filter((item) => item.meeting_id !== meetingId));
      }
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      toast.error(err.response?.data?.message || "Failed to remove meeting from account.");
    }
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

      <div className="main-content" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navbar />

        <div className="page-body" style={{ flex: 1 }}>
          {/* Header Banner */}
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
                <Calendar size={16} />
                <span>Meeting Intelligence Archive</span>
              </div>
              <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#ffffff", marginTop: "4px" }}>
                My Hosted & Joined Meetings
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Review past sessions, inspect Whisper speech transcripts, AI summaries, decisions, and action items.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/dashboard")}
              >
                <Video size={16} />
                <span>Create or Join Room</span>
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
                                fontWeight: "700",
                                textTransform: "uppercase",
                                background:
                                  item.type === "meeting"
                                    ? "rgba(56, 189, 248, 0.15)"
                                    : item.type === "decision"
                                    ? "rgba(168, 85, 247, 0.15)"
                                    : item.type === "action_item"
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(16, 185, 129, 0.15)",
                                color:
                                  item.type === "meeting"
                                    ? "var(--primary)"
                                    : item.type === "decision"
                                    ? "var(--accent-purple)"
                                    : item.type === "action_item"
                                    ? "var(--accent-amber)"
                                    : "var(--accent-emerald)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {item.type.replace("_", " ")}
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                              ({item.room_code})
                            </span>
                          </div>
                          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                            {item.snippet}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "6px 10px", fontSize: "11px", gap: "4px" }}
                          onClick={() => {
                            const found =
                              myMeetings.find((m) => m.id === item.meeting_id) ||
                              joinedMeetings.find((m) => m.id === item.meeting_id);
                            if (found) {
                              openIntelModal(found);
                            } else {
                              openIntelModal({ id: item.meeting_id, title: item.title, room_code: item.room_code });
                            }
                          }}
                        >
                          <FileText size={12} />
                          <span>Summary</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                onClick={() => {
                  fetchMyMeetings();
                  fetchJoinedMeetings();
                }}
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
                  You haven't hosted any meetings yet. Create your first meeting from the Dashboard!
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-base)", color: "var(--text-muted)" }}>
                      <th style={{ padding: "10px 12px" }}>Meeting Topic</th>
                      <th style={{ padding: "10px 12px" }}>Date & Time</th>
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
                        <td style={{ padding: "12px", color: "var(--text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          {m.created_at ? (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ color: "#ffffff", fontWeight: "600" }}>
                                {new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
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
                              title="View AI Meeting Summary, Notes & Transcripts"
                            >
                              <FileText size={14} />
                              <span>Summary</span>
                            </button>
                            {m.status !== "ended" && (
                              <>
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
                              </>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "6px 10px", fontSize: "12px", color: "#f87171" }}
                              onClick={() => handleDeleteMeeting(m.id, m.title)}
                              title="Delete this meeting from my account"
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
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

          {/* Joined Meetings Table (Meetings attended as participant, visible even after ended) */}
          <div className="stat-card" style={{ display: "block", marginTop: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Users size={18} color="var(--primary)" />
                <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                  Joined Meetings
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                onClick={fetchJoinedMeetings}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingJoinedMeetings ? (
              <div style={{ padding: "30px", textAlign: "center" }}>
                <LoadingSpinner size={24} text="Loading joined meetings..." />
              </div>
            ) : joinedMeetings.length === 0 ? (
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
                  You haven't joined any meetings hosted by others yet. Once you join a meeting with a room code, it will appear here permanently with its summary and transcript!
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-base)", color: "var(--text-muted)" }}>
                      <th style={{ padding: "10px 12px" }}>Meeting Topic</th>
                      <th style={{ padding: "10px 12px" }}>Date & Time</th>
                      <th style={{ padding: "10px 12px" }}>Host</th>
                      <th style={{ padding: "10px 12px" }}>Meeting ID</th>
                      <th style={{ padding: "10px 12px" }}>Status</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joinedMeetings.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "12px", fontWeight: "600", color: "#ffffff" }}>
                          {m.title}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          {m.created_at ? (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ color: "#ffffff", fontWeight: "600" }}>
                                {new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)" }}>
                          {m.host_name || "Host"}
                        </td>
                        <td style={{ padding: "12px", fontFamily: "monospace", color: "var(--accent-cyan)" }}>
                          {m.room_code}
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
                              title="View AI Meeting Summary, Notes & Transcripts"
                            >
                              <FileText size={14} />
                              <span>Summary</span>
                            </button>
                            {m.status !== "ended" && (
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
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "6px 10px", fontSize: "12px", color: "#f87171" }}
                              onClick={() => handleDeleteMeeting(m.id, m.title)}
                              title="Delete this meeting from my account"
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
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

      {/* Invite Modal */}
      {inviteModalOpen && selectedMeetingForInvite && (
        <InviteModal
          isOpen={inviteModalOpen}
          meeting={selectedMeetingForInvite}
          onClose={() => {
            setInviteModalOpen(false);
            setSelectedMeetingForInvite(null);
          }}
        />
      )}

      {/* Meeting Intelligence / Summary Modal */}
      {intelModalOpen && selectedMeetingForIntel && (
        <MeetingIntelligenceModal
          isOpen={intelModalOpen}
          meeting={selectedMeetingForIntel}
          onClose={() => {
            setIntelModalOpen(false);
            setSelectedMeetingForIntel(null);
          }}
        />
      )}
    </div>
  );
}
