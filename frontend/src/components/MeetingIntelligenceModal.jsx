import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  FileText,
  CheckCircle2,
  User,
  Clock,
  Download,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "./LoadingSpinner";

export default function MeetingIntelligenceModal({ isOpen, onClose, meeting }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("intelligence"); // 'intelligence' | 'transcript'
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && meeting?.room_code) {
      fetchMeetingData();
    }
  }, [isOpen, meeting]);

  const fetchMeetingData = async () => {
    setLoading(true);
    try {
      const [intelRes, transRes] = await Promise.allSettled([
        api.get(`/api/meetings/${meeting.room_code}/intelligence`),
        api.get(`/api/meetings/${meeting.room_code}/transcripts`),
      ]);

      if (intelRes.status === "fulfilled" && intelRes.value.data?.intelligence) {
        setIntelligence(intelRes.value.data.intelligence);
      }
      if (transRes.status === "fulfilled" && transRes.value.data?.transcripts) {
        setTranscripts(transRes.value.data.transcripts);
      }
    } catch (err) {
      console.warn("Could not load intelligence modal data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/api/meetings/${meeting.room_code}/intelligence/generate`);
      setIntelligence(res.data?.intelligence);
      toast.success("AI intelligence updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate intelligence.");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get(`/api/meetings/${meeting.room_code}/export`);
      const markdown = res.data?.markdown || "";
      const filename = res.data?.filename || `Meeting_${meeting.room_code}_Notes.md`;

      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Meeting notes exported!");
    } catch (err) {
      toast.error("Failed to export meeting notes.");
    }
  };

  const handleCopySummary = () => {
    if (!intelligence?.summary) return;
    navigator.clipboard.writeText(intelligence.summary);
    setCopied(true);
    toast.success("Summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !meeting) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-base)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                {meeting.title}
              </h2>
              <div style={{ display: "flex", gap: "10px", marginTop: "2px", fontSize: "12px", color: "var(--text-muted)" }}>
                <span>Room Code: <strong style={{ color: "var(--primary)", fontFamily: "monospace" }}>{meeting.room_code}</strong></span>
                {meeting.passcode && (
                  <span>Passcode: <strong style={{ color: "#fbbf24", fontFamily: "monospace" }}>{meeting.passcode}</strong></span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={handleExport}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
              title="Download Markdown Notes"
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "6px",
                display: "flex",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "0 22px",
            background: "var(--bg-surface)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("intelligence")}
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "intelligence" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "intelligence" ? "var(--primary)" : "var(--text-secondary)",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={14} />
            <span>AI Meeting Intelligence</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "transcript" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "transcript" ? "var(--primary)" : "var(--text-secondary)",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FileText size={14} />
            <span>Full Transcript ({transcripts.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          {loading ? (
            <div style={{ padding: "50px", textAlign: "center" }}>
              <LoadingSpinner size={28} text="Loading meeting intelligence..." />
            </div>
          ) : activeTab === "intelligence" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Toolbar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Synthesized from {transcripts.length} transcript segment(s)
                </span>

                <button
                  onClick={handleRegenerate}
                  disabled={generating}
                  className="btn btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  <RefreshCw size={13} className={generating ? "spin-anim" : ""} />
                  <span>{generating ? "Updating..." : "Refresh Intelligence"}</span>
                </button>
              </div>

              {/* Summary Card */}
              <div style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary)" }}>
                    Executive Summary
                  </div>
                  <button
                    onClick={handleCopySummary}
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                  >
                    {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.6" }}>
                  {intelligence?.summary || "No summary generated for this meeting yet."}
                </p>
              </div>

              {/* Decisions Reached */}
              <div style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--accent-emerald)", marginBottom: "8px" }}>
                  Important Decisions ({intelligence?.decisions?.length || 0})
                </div>
                {(!intelligence?.decisions || intelligence.decisions.length === 0) ? (
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>No explicit decisions recorded.</p>
                ) : (
                  <ul style={{ paddingLeft: "20px", margin: 0, fontSize: "13px", color: "var(--text-primary)" }}>
                    {intelligence.decisions.map((d, i) => (
                      <li key={i} style={{ marginBottom: "6px" }}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Action Items & Owners */}
              <div style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "#fbbf24", marginBottom: "8px" }}>
                  Action Items & Task Owners ({intelligence?.action_items?.length || 0})
                </div>
                {(!intelligence?.action_items || intelligence.action_items.length === 0) ? (
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>No action items recorded.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {intelligence.action_items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--bg-main)",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "13px",
                        }}
                      >
                        <div style={{ fontWeight: "600", color: "#ffffff", marginBottom: "6px" }}>
                          {item.task}
                        </div>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "11px" }}>
                          {item.assignee && (
                            <span style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <User size={12} /> Assignee: <strong>{item.assignee}</strong>
                            </span>
                          )}
                          {item.deadline && (
                            <span style={{ color: "#fbbf24", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={12} /> Deadline: <strong>{item.deadline}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Discussion Points */}
              <div style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary)", marginBottom: "8px" }}>
                  Key Discussion Points
                </div>
                {(!intelligence?.key_discussion_points || intelligence.key_discussion_points.length === 0) ? (
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>No discussion points extracted.</p>
                ) : (
                  <ul style={{ paddingLeft: "20px", margin: 0, fontSize: "13px", color: "var(--text-primary)" }}>
                    {intelligence.key_discussion_points.map((pt, i) => (
                      <li key={i} style={{ marginBottom: "6px" }}>{pt}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Blockers & Questions */}
              {((intelligence?.blockers && intelligence.blockers.length > 0) ||
                (intelligence?.unresolved_questions && intelligence.unresolved_questions.length > 0)) && (
                <div style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--accent-rose)", marginBottom: "8px" }}>
                    Unresolved Questions & Blockers
                  </div>
                  <ul style={{ paddingLeft: "20px", margin: 0, fontSize: "13px" }}>
                    {intelligence.blockers?.map((b, i) => (
                      <li key={`b-${i}`} style={{ color: "#fda4af", marginBottom: "4px" }}>
                        <strong>[Blocker]</strong> {b}
                      </li>
                    ))}
                    {intelligence.unresolved_questions?.map((q, i) => (
                      <li key={`q-${i}`} style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: TRANSCRIPT */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {transcripts.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  No transcript segments recorded for this meeting.
                </div>
              ) : (
                transcripts.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    style={{
                      background: "var(--bg-card)",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)" }}>
                        {t.speaker_name || "Speaker"}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {t.timestamp_str || "00:00"}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.5" }}>
                      {t.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
