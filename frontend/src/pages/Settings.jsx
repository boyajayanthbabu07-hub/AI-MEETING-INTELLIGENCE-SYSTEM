import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Mic, Video, Subtitles, Moon, Check } from "lucide-react";
import { useToast } from "../context/ToastContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function Settings() {
  const toast = useToast();

  const [defaultMic, setDefaultMic] = useState(() => localStorage.getItem("setting_default_mic") !== "false");
  const [defaultCam, setDefaultCam] = useState(() => localStorage.getItem("setting_default_cam") !== "false");
  const [captions, setCaptions] = useState(() => localStorage.getItem("setting_captions") === "true");
  const [devices, setDevices] = useState({ audio: [], video: [] });

  useEffect(() => {
    // Enumerate user media devices if permissions are available
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((deviceList) => {
        const audio = deviceList.filter((d) => d.kind === "audioinput");
        const video = deviceList.filter((d) => d.kind === "videoinput");
        setDevices({ audio, video });
      }).catch((err) => {
        console.error("Device enumeration error:", err);
      });
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("setting_default_mic", defaultMic);
    localStorage.setItem("setting_default_cam", defaultCam);
    localStorage.setItem("setting_captions", captions);
    toast.success("Preferences saved successfully!");
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />

        <div className="page-body" style={{ maxWidth: "800px" }}>
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#ffffff" }}>Meeting Settings</h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Configure your default media and speech-to-text preferences
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
                onClick={handleSave}
                style={{ marginTop: "24px" }}
              >
                <Check size={16} />
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
