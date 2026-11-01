import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  FileText,
  RefreshCw,
  Trash2,
  LogIn,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import MeetingIntelligenceModal from "../components/MeetingIntelligenceModal";

export default function JoinedMeetings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Joined Meetings List
  const [joinedMeetings, setJoinedMeetings] = useState([]);
  const [loadingJoinedMeetings, setLoadingJoinedMeetings] = useState(false);

  // Modals
  const [intelModalOpen, setIntelModalOpen] = useState(false);
  const [selectedMeetingForIntel, setSelectedMeetingForIntel] = useState(null);

  useEffect(() => {
    fetchJoinedMeetings();
  }, []);

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
      setJoinedMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      toast.error(err.response?.data?.message || "Failed to remove meeting from account.");
    }
  };

  const filteredMeetings = joinedMeetings.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title?.toLowerCase().includes(q) ||
      m.host_name?.toLowerCase().includes(q) ||
      m.room_code?.toLowerCase().includes(q)
    );
  });

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
                <Users size={16} />
                <span>Attendee Archive</span>
              </div>
              <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#ffffff", marginTop: "4px" }}>
                Joined Meetings
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
                All the sessions you joined as a participant. Review discussion transcripts, AI summaries, and decisions anytime.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/dashboard")}
              >
                <LogIn size={16} />
                <span>Join with Code</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 20px",
              marginBottom: "28px",
            }}
          >
            <div style={{ position: "relative", width: "100%" }}>
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
                placeholder="Search joined meetings by topic, host name, or room code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Joined Meetings Table Card */}
          <div className="stat-card" style={{ display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Users size={18} color="var(--primary)" />
                <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                  Joined Meetings List
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
            ) : filteredMeetings.length === 0 ? (
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
                  {searchQuery
                    ? `No joined meetings matched "${searchQuery}".`
                    : "You haven't joined any meetings hosted by others yet. Once you join a meeting using a room code, it will appear here permanently with its summary and transcript!"}
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
                    {filteredMeetings.map((m) => (
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
