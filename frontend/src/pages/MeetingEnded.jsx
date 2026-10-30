import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText,
  Download,
  Mail,
  CheckCircle2,
  Clock,
  Users,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  User,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import api from "../api";
import { useToast } from "../context/ToastContext";

// ---------- helpers ----------
function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return "N/A";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ---------- component ----------
export default function MeetingEnded() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [extraEmails, setExtraEmails] = useState("");
  const [activeTab, setActiveTab] = useState("summary"); // summary | transcript

  const fetchResults = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/meetings/${roomCode}/results`);
      setData(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load meeting results. The meeting may still be processing."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const downloadPdf = () => {
    const url = `${import.meta.env.VITE_API_URL || ""}/api/meetings/${roomCode}/export/pdf`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Meeting_${roomCode}_Notes.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("PDF download started!");
  };

  const downloadMarkdown = async () => {
    try {
      const res = await api.get(`/api/meetings/${roomCode}/export`);
      const markdown = res.data?.markdown || "";
      const filename = res.data?.filename || `Meeting_${roomCode}_Notes.md`;
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Markdown notes downloaded!");
    } catch {
      toast.error("Markdown export failed.");
    }
  };

  const sendEmail = async () => {
    setEmailSending(true);
    setEmailResult(null);
    try {
      const extras = extraEmails
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));
      const res = await api.post(`/api/meetings/${roomCode}/email-summary`, {
        emails: extras,
        include_pdf: true,
        regenerate: false,
      });
      setEmailResult({ success: true, data: res.data });
      toast.success(res.data.message || "Summary emailed!");
    } catch (err) {
      const msg =
        err.response?.data?.message || "Failed to send email. Check SMTP config.";
      setEmailResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setEmailSending(false);
    }
  };

  // ---- render states ----
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <RefreshCw size={32} color="var(--primary)" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: "var(--text-muted)", marginTop: "12px" }}>
            Loading meeting results…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <AlertCircle size={32} color="var(--accent-rose)" />
          <p style={{ color: "var(--accent-rose)", marginTop: "12px" }}>{error}</p>
          <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={fetchResults}>
            Retry
          </button>
          <button
            className="btn btn-ghost"
            style={{ marginTop: "8px" }}
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { meeting, summary, key_points, decisions, action_items, transcripts, participants, smtp_configured } =
    data || {};

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <button
            className="btn btn-ghost"
            style={{ marginBottom: "8px", padding: "4px 8px", fontSize: "12px" }}
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={13} /> Dashboard
          </button>
          <h1 style={styles.title}>{meeting?.title || `Meeting ${roomCode}`}</h1>
          <div style={styles.meta}>
            <span>
              <Clock size={13} /> {fmtDate(meeting?.ended_at)}
            </span>
            <span>
              <Users size={13} /> {participants?.length || 0} participant(s)
            </span>
            <span>
              <Clock size={13} /> Duration: {fmtDuration(meeting?.duration_seconds)}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                background: "rgba(16, 185, 129, 0.15)",
                color: "var(--accent-emerald)",
                fontSize: "11px",
                fontWeight: "700",
              }}
            >
              Meeting Ended
            </span>
          </div>
        </div>

        {/* Export & Email actions */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={downloadPdf}>
            <Download size={14} /> Download PDF
          </button>
          <button className="btn btn-secondary" onClick={downloadMarkdown}>
            <FileText size={14} /> Export Markdown
          </button>
        </div>
      </div>

      {/* Body: two-column */}
      <div style={styles.body}>
        {/* LEFT: Summary cards */}
        <div style={styles.leftCol}>
          {/* Summary */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>
              <Sparkles size={14} color="var(--primary)" /> Executive Summary
            </div>
            <p style={styles.bodyText}>{summary || "No summary generated. You may generate intelligence from the meeting room."}</p>
          </div>

          {/* Key Points */}
          {key_points?.length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>
                <MessageSquare size={14} color="var(--accent-indigo)" /> Key Discussion Points
              </div>
              <ul style={styles.list}>
                {key_points.map((pt, i) => (
                  <li key={i} style={styles.listItem}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisions */}
          <div style={styles.card}>
            <div style={{ ...styles.cardTitle, color: "var(--accent-emerald)" }}>
              <CheckCircle2 size={14} /> Decisions Reached ({decisions?.length || 0})
            </div>
            {decisions?.length > 0 ? (
              <ul style={styles.list}>
                {decisions.map((d, i) => (
                  <li key={i} style={{ ...styles.listItem, color: "#6ee7b7" }}>
                    ✓ {d}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={styles.muted}>No explicit decisions recorded.</p>
            )}
          </div>

          {/* Action Items */}
          <div style={styles.card}>
            <div style={{ ...styles.cardTitle, color: "#fbbf24" }}>
              <Clock size={14} /> Action Items ({action_items?.length || 0})
            </div>
            {action_items?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {action_items.map((item, i) => (
                  <div key={i} style={styles.actionCard}>
                    <div style={{ fontWeight: "600", color: "#fff", fontSize: "13px" }}>
                      {item.task}
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
                      {item.assignee && (
                        <span style={{ color: "var(--primary)", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                          <User size={11} /> {item.assignee}
                        </span>
                      )}
                      {item.deadline && (
                        <span style={{ color: "#fbbf24", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Clock size={11} /> {item.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.muted}>No action items identified.</p>
            )}
          </div>

          {/* Participants */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>
              <Users size={14} color="var(--text-secondary)" /> Participants
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {participants?.map((p, i) => (
                <span key={i} style={styles.participantBadge}>
                  {p.display_name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Transcript + Email */}
        <div style={styles.rightCol}>
          {/* Email delivery */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>
              <Mail size={14} color="var(--accent-indigo)" /> Email Summary & PDF
            </div>
            {!smtp_configured && (
              <div style={styles.warningBanner}>
                <AlertCircle size={13} />
                SMTP not configured — email will be logged to backend terminal only.
                Add <code>MAIL_USERNAME</code> / <code>MAIL_PASSWORD</code> to <code>.env</code> for real delivery.
              </div>
            )}
            <p style={{ ...styles.muted, marginBottom: "8px" }}>
              The meeting summary PDF will be emailed to the host. Add extra recipients below (comma-separated).
            </p>
            <input
              type="text"
              className="input"
              placeholder="extra@email.com, another@email.com"
              value={extraEmails}
              onChange={(e) => setExtraEmails(e.target.value)}
              style={{ marginBottom: "10px", width: "100%", fontSize: "13px" }}
            />
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={sendEmail}
              disabled={emailSending}
            >
              {emailSending ? (
                <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Sending…</>
              ) : (
                <><Mail size={14} /> Send Summary Email</>
              )}
            </button>

            {emailResult && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  background: emailResult.success
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(244, 63, 94, 0.12)",
                  border: `1px solid ${emailResult.success ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
                  fontSize: "12px",
                  color: emailResult.success ? "#6ee7b7" : "#fda4af",
                }}
              >
                {emailResult.success ? (
                  <>
                    <strong>✓ {emailResult.data?.message}</strong>
                    {emailResult.data?.mock_mode && (
                      <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                        (Mock mode — no real email sent. Configure SMTP to send real emails.)
                      </p>
                    )}
                    {emailResult.data?.pdf_attached && (
                      <p style={{ margin: "4px 0 0", opacity: 0.8 }}>📎 PDF attached</p>
                    )}
                  </>
                ) : (
                  <strong>✗ {emailResult.message}</strong>
                )}
              </div>
            )}
          </div>

          {/* Transcript panel */}
          <div style={{ ...styles.card, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={styles.cardTitle}>
              <FileText size={14} color="var(--text-secondary)" /> Conversation Transcript ({transcripts?.length || 0} segments)
            </div>

            {!transcripts?.length ? (
              <p style={styles.muted}>No transcript recorded for this meeting.</p>
            ) : (
              <div style={styles.transcriptScroll}>
                {(() => {
                  let lastSpeaker = null;
                  return transcripts.map((seg, i) => {
                    const showSpeaker = seg.speaker_name !== lastSpeaker;
                    lastSpeaker = seg.speaker_name;
                    return (
                      <div key={i} style={{ marginBottom: showSpeaker ? "12px" : "4px" }}>
                        {showSpeaker && (
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "var(--primary)",
                              marginBottom: "4px",
                              marginTop: i > 0 ? "10px" : 0,
                            }}
                          >
                            {seg.speaker_name}
                          </div>
                        )}
                        <div style={styles.transcriptLine}>
                          <span style={styles.timestamp}>[{seg.timestamp_str}]</span>
                          <span style={styles.transcriptText}>{seg.text}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- styles ----------
const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    background: "var(--bg-main)",
    color: "var(--text-primary)",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: "60vh",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "24px 32px 16px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--border-subtle)",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#ffffff",
    margin: 0,
  },
  meta: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginTop: "6px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    flexWrap: "wrap",
  },
  body: {
    display: "flex",
    gap: "20px",
    padding: "24px 32px",
    flex: 1,
    overflow: "hidden",
    flexWrap: "wrap",
  },
  leftCol: {
    flex: "1 1 380px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: "300px",
  },
  rightCol: {
    flex: "1 1 340px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: "280px",
    maxHeight: "calc(100vh - 180px)",
    overflow: "auto",
  },
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding: "16px",
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    color: "var(--primary)",
    marginBottom: "10px",
    letterSpacing: "0.05em",
  },
  bodyText: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: "1.6",
    margin: 0,
  },
  list: {
    paddingLeft: "16px",
    margin: 0,
    fontSize: "13px",
    color: "var(--text-primary)",
  },
  listItem: {
    marginBottom: "6px",
    lineHeight: "1.5",
  },
  muted: {
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: 0,
  },
  actionCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding: "8px 10px",
  },
  participantBadge: {
    background: "rgba(56,189,248,0.1)",
    border: "1px solid rgba(56,189,248,0.2)",
    color: "var(--primary)",
    borderRadius: "var(--radius-full)",
    padding: "3px 10px",
    fontSize: "12px",
    fontWeight: "600",
  },
  warningBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    padding: "8px 10px",
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.25)",
    borderRadius: "var(--radius-md)",
    fontSize: "11px",
    color: "#fbbf24",
    marginBottom: "10px",
    lineHeight: "1.5",
  },
  transcriptScroll: {
    flex: 1,
    overflowY: "auto",
    maxHeight: "500px",
    paddingRight: "4px",
  },
  transcriptLine: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
  },
  timestamp: {
    fontSize: "10px",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    fontFamily: "monospace",
    paddingTop: "2px",
    minWidth: "42px",
  },
  transcriptText: {
    fontSize: "12px",
    color: "var(--text-primary)",
    lineHeight: "1.5",
  },
};
