import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ size = 20, text = "", inline = false }) {
  const content = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <Loader2 size={size} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
      {text && <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{text}</span>}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (inline) return content;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      {content}
    </div>
  );
}
