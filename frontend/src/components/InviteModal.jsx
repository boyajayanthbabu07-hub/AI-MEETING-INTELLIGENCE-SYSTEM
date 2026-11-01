import { useState } from "react";
import { X, Mail, Link as LinkIcon, Key, Copy, Check, Send, Sparkles, ExternalLink } from "lucide-react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "./LoadingSpinner";

export default function InviteModal({ isOpen = true, onClose, meeting }) {
  const toast = useToast();

  const [emailsInput, setEmailsInput] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  if (!isOpen || !meeting) return null;

  const isGoogleMeet = meeting.meeting_type === "google_meet" || (meeting.external_link && meeting.external_link.includes("meet.google"));
  const meetingId = meeting.room_code || meeting.id || "";
  const passcode = meeting.passcode || "";

  // Compute join URL
  const origin = window.location.origin;
  const directUrl = isGoogleMeet && meeting.external_link
    ? meeting.external_link
    : `${origin}/meeting/${meeting.room_code}${passcode ? `?passcode=${encodeURIComponent(passcode)}` : ""}`;

  const copyToClipboard = (text, setCopiedState, label) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    toast.info(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const handleCopyFullInvite = () => {
    const lines = [
      `You're invited to join: ${meeting.title}`,
      `Platform: ${isGoogleMeet ? "Google Meet" : "AI Meeting Intelligence"}`,
      `Meeting Link: ${directUrl}`,
      `Meeting ID / Room Code: ${meetingId}`,
    ];

    if (passcode) {
      lines.push(`Meeting Password / Passcode: ${passcode}`);
    }

    if (customMessage.trim()) {
      lines.push(`\nNote from Host: "${customMessage.trim()}"`);
    }

    lines.push("\nClick the link above to join directly.");

    copyToClipboard(lines.join("\n"), setCopiedFull, "Full invitation text");
  };

  const handleSendEmails = async (e) => {
    e.preventDefault();
    if (!emailsInput.trim()) {
      toast.warning("Please enter at least one recipient email address.");
      return;
    }

    setSending(true);
    try {
      let response;
      if (meeting.id) {
        response = await api.post(`/api/meetings/${meeting.id}/invite`, {
          emails: emailsInput,
          custom_message: customMessage.trim(),
        });
      } else {
        response = await api.post("/api/meetings/send-custom-invite", {
          title: meeting.title,
          meeting_link: directUrl,
          meeting_id: meetingId,
          password: passcode,
          emails: emailsInput,
          custom_message: customMessage.trim(),
          meeting_type: isGoogleMeet ? "google_meet" : "internal",
        });
      }

      toast.success(response.data?.message || "Invitations successfully sent!");
      setEmailsInput("");
      setCustomMessage("");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to dispatch invitations.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 7, 18, 0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-base)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          padding: "24px 28px",
          color: "#f8fafc",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: isGoogleMeet ? "rgba(234, 67, 53, 0.15)" : "rgba(56, 189, 248, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isGoogleMeet ? "#ea4335" : "var(--primary)",
              }}
            >
              <Mail size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff", margin: 0 }}>
                Invite to Meeting
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {isGoogleMeet ? "Google Meet Host" : "AI Meeting Intelligence"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Meeting Title Banner */}
        <div
          style={{
            background: "var(--bg-main)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
            Meeting Topic
          </div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff", marginTop: "2px" }}>
            {meeting.title || "Untitled Meeting"}
          </div>

          {/* Quick Copy Specs */}
          <div style={{ display: "grid", gridTemplateColumns: passcode ? "1fr 1fr" : "1fr", gap: "10px", marginTop: "12px" }}>
            {/* Meeting ID */}
            <div
              style={{
                background: "var(--bg-surface)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "600" }}>Meeting ID</div>
                <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "700", color: "var(--primary)", letterSpacing: "1px" }}>
                  {meetingId}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 8px", minWidth: "auto" }}
                onClick={() => copyToClipboard(meetingId, setCopiedCode, "Meeting ID")}
              >
                {copiedCode ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Passcode (if any) */}
            {passcode && (
              <div
                style={{
                  background: "var(--bg-surface)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "10px", color: "#fbbf24", textTransform: "uppercase", fontWeight: "700" }}>Password</div>
                  <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "800", color: "#ffffff", letterSpacing: "1px" }}>
                    {passcode}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "6px 8px", minWidth: "auto" }}
                  onClick={() => copyToClipboard(passcode, setCopiedPasscode, "Password")}
                >
                  {copiedPasscode ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* Join Link Copy */}
          <div
            style={{
              marginTop: "10px",
              background: "var(--bg-surface)",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <LinkIcon size={14} color="var(--text-secondary)" />
            <div
              style={{
                flex: 1,
                fontSize: "12px",
                fontFamily: "monospace",
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {directUrl}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "4px 8px", fontSize: "12px" }}
              onClick={() => copyToClipboard(directUrl, setCopiedLink, "Meeting link")}
            >
              {copiedLink ? <Check size={12} color="var(--accent-emerald)" /> : "Copy Link"}
            </button>
          </div>
        </div>

        {/* Send Email Form */}
        <form onSubmit={handleSendEmails}>
          <div className="form-group">
            <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Recipient Email Addresses</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>
                Separate multiple with commas
              </span>
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. colleague1@gmail.com, colleague2@company.com"
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              disabled={sending}
              style={{ resize: "vertical", minHeight: "60px" }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Personal Note (Optional)</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Please join 5 mins early for setup"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={sending}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={handleCopyFullInvite}
            >
              {copiedFull ? (
                <>
                  <Check size={16} color="var(--accent-emerald)" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy Full Invite</span>
                </>
              )}
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1.3 }}
              disabled={sending || !emailsInput.trim()}
            >
              {sending ? (
                <LoadingSpinner size={16} text="Dispatching..." inline />
              ) : (
                <>
                  <Send size={16} />
                  <span>Send Real Email Invites</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
