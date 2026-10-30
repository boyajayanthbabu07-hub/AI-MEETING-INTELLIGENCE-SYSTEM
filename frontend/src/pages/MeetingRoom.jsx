import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  MonitorOff,
  FileText,
  Sparkles,
  Users as UsersIcon,
  PhoneOff,
  Copy,
  Check,
  Download,
  Search,
  RefreshCw,
  AlertCircle,
  Share2,
  CheckCircle2,
  Clock,
  User,
  Radio,
  Lock,
} from "lucide-react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import InviteModal from "../components/InviteModal";

function MeetingRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const transcriptEndRef = useRef(null);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const peerConnectionsRef = useRef({});
  const remoteMediaStreamsRef = useRef({});
  const iceCandidateQueuesRef = useRef({});

  // Audio mixer & recorder refs for complete meeting transcription
  const audioContextRef = useRef(null);
  const processorNodeRef = useRef(null);
  const pcmBufferRef = useRef([]);
  const sendIntervalRef = useRef(null);

  // Local media controls
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // Remote participants and streams
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [peerMediaStates, setPeerMediaStates] = useState({});

  // Meeting details & errors
  const [error, setError] = useState("");
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Real-Time Transcription
  const [transcribing, setTranscribing] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [transcriptFilter, setTranscriptFilter] = useState("");

  // AI Meeting Intelligence
  const [activeSidePanel, setActiveSidePanel] = useState("transcript"); // 'transcript' | 'intelligence' | 'participants' | null
  const [intelligence, setIntelligence] = useState(null);
  const [generatingIntelligence, setGeneratingIntelligence] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const displayName = user?.name || "Guest";

  const rtcConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  const getSocketUrl = () => {
    if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    const host = window.location.hostname || "localhost";
    return `http://${host}:5000`;
  };

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------
  useEffect(() => {
    startMeeting();

    // Fetch meeting details
    api
      .get(`/api/meetings/check/${roomCode}`)
      .then((res) => {
        setMeetingDetails(res.data);
      })
      .catch((err) => {
        console.warn("Could not fetch meeting info:", err);
      });

    // Fetch existing transcripts for room
    api
      .get(`/api/meetings/${roomCode}/transcripts`)
      .then((res) => {
        if (res.data?.transcripts) {
          setTranscripts(res.data.transcripts);
        }
      })
      .catch((err) => {
        console.warn("Could not pre-fetch transcripts:", err);
      });

    return () => {
      disconnectMeeting();
    };
  }, [roomCode]);

  // Auto-scroll transcript feed
  useEffect(() => {
    if (activeSidePanel === "transcript" && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, activeSidePanel]);

  // --------------------------------------------------
  // Participant State Management
  // --------------------------------------------------
  const addParticipant = (socketId, participantName) => {
    if (!socketId) return;

    setParticipants((previous) => {
      const exists = previous.some((p) => p.socket_id === socketId);
      if (exists) return previous;
      return [...previous, { socket_id: socketId, display_name: participantName }];
    });
  };

  const removeParticipant = (socketId) => {
    setParticipants((previous) => previous.filter((p) => p.socket_id !== socketId));
    setPeerMediaStates((previous) => {
      const copy = { ...previous };
      delete copy[socketId];
      return copy;
    });
  };

  // --------------------------------------------------
  // WebRTC Peer Connection & Signaling
  // --------------------------------------------------
  const createPeerConnection = (targetSocketId) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    peerConnectionsRef.current[targetSocketId] = peerConnection;
    iceCandidateQueuesRef.current[targetSocketId] = [];

    // Add local tracks (or screen track if sharing)
    const activeStream = screenSharing && screenStreamRef.current ? screenStreamRef.current : localStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, activeStream);
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          target: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind, targetSocketId);

      let remoteStream = remoteMediaStreamsRef.current[targetSocketId];

      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteMediaStreamsRef.current[targetSocketId] = remoteStream;

        setRemoteStreams((previous) => {
          const alreadyExists = previous.some((item) => item.socketId === targetSocketId);
          if (alreadyExists) return previous;
          return [...previous, { socketId: targetSocketId, stream: remoteStream }];
        });
      }

      const alreadyHasTrack = remoteStream.getTracks().some((track) => track.id === event.track.id);
      if (!alreadyHasTrack) {
        remoteStream.addTrack(event.track);
      }

      // If transcription audio mixer is active, dynamically attach the remote audio track
      if (event.track.kind === "audio" && audioContextRef.current && processorNodeRef.current) {
        try {
          const remoteAudioStream = new MediaStream([event.track]);
          const remoteSource = audioContextRef.current.createMediaStreamSource(remoteAudioStream);
          remoteSource.connect(processorNodeRef.current);
        } catch (e) {
          console.warn("Could not attach remote audio track to transcription mixer:", e);
        }
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", targetSocketId, peerConnection.connectionState);
      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "closed" ||
        peerConnection.connectionState === "disconnected"
      ) {
        removePeer(targetSocketId);
      }
    };

    return peerConnection;
  };

  const addQueuedIceCandidates = async (socketId, peerConnection) => {
    const queue = iceCandidateQueuesRef.current[socketId] || [];
    for (const candidate of queue) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Queued ICE candidate error:", error);
      }
    }
    iceCandidateQueuesRef.current[socketId] = [];
  };

  const startOffer = async (socket, targetSocketId) => {
    const peerConnection = createPeerConnection(targetSocketId);
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit("offer", { target: targetSocketId, offer });
    } catch (error) {
      console.error("Offer error:", error);
    }
  };

  // --------------------------------------------------
  // Initialize Meeting, Media & Socket.IO
  // --------------------------------------------------
  const startMeeting = async () => {
    try {
      setError("");

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = mediaStream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      const socket = io(getSocketUrl(), {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);

        setParticipants([
          {
            socket_id: socket.id,
            display_name: displayName,
          },
        ]);

        socket.emit("join-room", {
          room_code: roomCode,
          display_name: displayName,
        });

        // Broadcast current media state
        socket.emit("peer-media-state", {
          room_code: roomCode,
          display_name: displayName,
          mic_on: micOn,
          camera_on: cameraOn,
          screen_sharing: screenSharing,
        });

        // Automatically start real-time voice transcription
        setTimeout(() => {
          startTranscription();
        }, 1000);
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setError("Unable to connect to meeting server. Reconnecting...");
      });

      socket.on("existing-participant", async (data) => {
        addParticipant(data.socket_id, data.display_name);
        await startOffer(socket, data.socket_id);

        // Send media state to newcomer
        socket.emit("peer-media-state", {
          room_code: roomCode,
          display_name: displayName,
          mic_on: micOn,
          camera_on: cameraOn,
          screen_sharing: screenSharing,
        });
      });

      socket.on("user-joined", (data) => {
        addParticipant(data.socket_id, data.display_name);
        toast.info(`${data.display_name} joined the meeting.`);
      });

      socket.on("offer", async (data) => {
        const peerConnection = createPeerConnection(data.sender);
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          await addQueuedIceCandidates(data.sender, peerConnection);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit("answer", { target: data.sender, answer });
        } catch (err) {
          console.error("Answer error:", err);
        }
      });

      socket.on("answer", async (data) => {
        const peerConnection = peerConnectionsRef.current[data.sender];
        if (!peerConnection) return;
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          await addQueuedIceCandidates(data.sender, peerConnection);
        } catch (err) {
          console.error("Remote description error:", err);
        }
      });

      socket.on("ice-candidate", async (data) => {
        const peerConnection = peerConnectionsRef.current[data.sender];
        if (!peerConnection) return;

        if (!peerConnection.remoteDescription) {
          if (!iceCandidateQueuesRef.current[data.sender]) {
            iceCandidateQueuesRef.current[data.sender] = [];
          }
          iceCandidateQueuesRef.current[data.sender].push(data.candidate);
          return;
        }

        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("ICE candidate error:", err);
        }
      });

      socket.on("peer-media-state", (data) => {
        if (!data.socket_id) return;
        setPeerMediaStates((prev) => ({
          ...prev,
          [data.socket_id]: {
            mic_on: data.mic_on,
            camera_on: data.camera_on,
            screen_sharing: data.screen_sharing,
            display_name: data.display_name,
          },
        }));
      });

      socket.on("transcription-status-changed", (data) => {
        if (data.enabled !== transcribing) {
          setTranscribing(data.enabled);
          toast.info(`Meeting transcription was ${data.enabled ? "started" : "paused"} by ${data.initiated_by || "host"}.`);
        }
      });

      socket.on("transcription-result", (data) => {
        console.log("Transcription result received:", data);
        if (data.text) {
          setTranscripts((prev) => {
            const exists = prev.some((item) => item.id && item.id === data.id);
            if (exists) return prev;
            return [...prev, data];
          });
        }
      });

      socket.on("user-left", (data) => {
        removePeer(data.socket_id);
        toast.info(`${data.display_name} left the room.`);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });
    } catch (err) {
      console.error("Media error:", err);
      if (err.name === "NotAllowedError") {
        setError("Camera or microphone permission was denied. Please allow access in your browser.");
      } else if (err.name === "NotReadableError") {
        setError("Camera or microphone is already being used by another application.");
      } else {
        setError("Unable to access camera or microphone.");
      }
    }
  };

  const removePeer = (socketId) => {
    const peerConnection = peerConnectionsRef.current[socketId];
    if (peerConnection) {
      peerConnection.close();
      delete peerConnectionsRef.current[socketId];
    }
    delete remoteMediaStreamsRef.current[socketId];
    delete iceCandidateQueuesRef.current[socketId];

    setRemoteStreams((previous) => previous.filter((item) => item.socketId !== socketId));
    removeParticipant(socketId);
  };

  // --------------------------------------------------
  // Camera & Mic Controls
  // --------------------------------------------------
  const toggleMicrophone = () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    const nextState = !micOn;

    tracks.forEach((track) => {
      track.enabled = nextState;
    });

    setMicOn(nextState);

    // Notify room of media state
    socketRef.current?.emit("peer-media-state", {
      room_code: roomCode,
      display_name: displayName,
      mic_on: nextState,
      camera_on: cameraOn,
      screen_sharing: screenSharing,
    });
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    const nextState = !cameraOn;

    tracks.forEach((track) => {
      track.enabled = nextState;
    });

    setCameraOn(nextState);

    socketRef.current?.emit("peer-media-state", {
      room_code: roomCode,
      display_name: displayName,
      mic_on: micOn,
      camera_on: nextState,
      screen_sharing: screenSharing,
    });
  };

  // --------------------------------------------------
  // Real WebRTC Screen Sharing (Replaces Video Track on Peers)
  // --------------------------------------------------
  const startScreenSharing = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = displayStream;
      setScreenSharing(true);

      const screenTrack = displayStream.getVideoTracks()[0];

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = displayStream;
      }

      // Replace video track on all active peer connections
      Object.values(peerConnectionsRef.current).forEach((peerConnection) => {
        const senders = peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => {
        stopScreenSharing();
      };

      socketRef.current?.emit("peer-media-state", {
        room_code: roomCode,
        display_name: displayName,
        mic_on: micOn,
        camera_on: cameraOn,
        screen_sharing: true,
      });

      toast.success("Screen sharing started.");
    } catch (err) {
      console.error("Screen sharing error:", err);
      if (err.name !== "NotAllowedError") {
        toast.error("Could not start screen sharing.");
      }
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    setScreenSharing(false);

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    // Revert video track on all peer connections back to camera
    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      if (cameraTrack) {
        Object.values(peerConnectionsRef.current).forEach((peerConnection) => {
          const senders = peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(cameraTrack);
          }
        });
      }
    }

    socketRef.current?.emit("peer-media-state", {
      room_code: roomCode,
      display_name: displayName,
      mic_on: micOn,
      camera_on: cameraOn,
      screen_sharing: false,
    });
  };


// Helper: encode 16-bit 16kHz mono PCM Float32Array chunks into valid RIFF WAV
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate (16-bit mono = 2 bytes/sample)
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

  // --------------------------------------------------
  // Complete Meeting Audio Capture & Live Transcription (WAV/PCM Pipeline)
  // --------------------------------------------------
  const startTranscription = async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      // Initialize AudioContext at 16kHz for direct Whisper model compatibility
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;
      pcmBufferRef.current = [];

      // Create ScriptProcessor for capturing raw audio samples directly
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Copy samples into accumulation buffer
        pcmBufferRef.current.push(new Float32Array(inputData));
      };

      // 1. Connect local microphone
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        const localSource = audioCtx.createMediaStreamSource(localStreamRef.current);
        localSource.connect(processor);
      }

      // 2. Connect all remote participant audio streams
      remoteStreams.forEach(({ stream }) => {
        if (stream && stream.getAudioTracks().length > 0) {
          try {
            const remoteSource = audioCtx.createMediaStreamSource(stream);
            remoteSource.connect(processor);
          } catch (err) {
            console.warn("Could not connect remote stream to audio processor:", err);
          }
        }
      });

      // Must connect processor to destination so it continues processing
      processor.connect(audioCtx.destination);

      // 3. Dispatch accumulated audio chunks every 3.5 seconds as clean WAV files
      sendIntervalRef.current = setInterval(() => {
        if (!socketRef.current?.connected) return;

        const chunks = pcmBufferRef.current;
        pcmBufferRef.current = [];

        if (chunks.length === 0) return;

        let totalLength = 0;
        for (const c of chunks) totalLength += c.length;

        // Ensure we have at least 1.5 seconds of audio (~24,000 samples at 16kHz)
        if (totalLength < 16000 * 1.5) {
          // Put back if not enough audio accumulated yet
          pcmBufferRef.current = chunks.concat(pcmBufferRef.current);
          return;
        }

        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }

        // Check if there is actual sound (skip absolute silence to save bandwidth/compute)
        let maxAmp = 0;
        for (let i = 0; i < merged.length; i++) {
          const abs = Math.abs(merged[i]);
          if (abs > maxAmp) maxAmp = abs;
        }

        if (maxAmp < 0.015) {
          return; // Pure background silence
        }

        // Encode to pristine RIFF WAV bytes (sample rate 16000, 16-bit mono)
        const wavBytes = encodeWAV(merged, 16000);

        socketRef.current.emit("audio-chunk", {
          room_code: roomCode,
          audio: Array.from(wavBytes),
          speaker_name: displayName,
          is_mixed: true,
        });
      }, 3500);

      setTranscribing(true);

      socketRef.current?.emit("toggle-transcription", {
        room_code: roomCode,
        enabled: true,
        display_name: displayName,
      });

      toast.success("Live AI voice listening & transcription active.");
    } catch (err) {
      console.error("Transcription start error:", err);
      toast.error("Failed to start audio capture for transcription.");
    }
  };

  const stopTranscription = () => {
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }

    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch (e) {
        console.warn("Error disconnecting processor:", e);
      }
      processorNodeRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn("Error closing AudioContext:", e);
      }
      audioContextRef.current = null;
    }

    pcmBufferRef.current = [];
    setTranscribing(false);

    socketRef.current?.emit("toggle-transcription", {
      room_code: roomCode,
      enabled: false,
      display_name: displayName,
    });

    toast.info("Meeting transcription paused.");
  };

  const toggleTranscription = () => {
    if (transcribing) {
      stopTranscription();
    } else {
      startTranscription();
    }
  };

  // --------------------------------------------------
  // AI Meeting Intelligence Generation & Export
  // --------------------------------------------------
  const handleGenerateIntelligence = async () => {
    setGeneratingIntelligence(true);
    try {
      const res = await api.post(`/api/meetings/${roomCode}/intelligence/generate`);
      setIntelligence(res.data?.intelligence);
      toast.success("AI Meeting Intelligence generated!");
      setActiveSidePanel("intelligence");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate AI intelligence.");
    } finally {
      setGeneratingIntelligence(false);
    }
  };

  const handleFetchIntelligence = async () => {
    try {
      const res = await api.get(`/api/meetings/${roomCode}/intelligence`);
      setIntelligence(res.data?.intelligence);
    } catch (err) {
      console.warn("Could not fetch intelligence:", err);
    }
  };

  const handleExportNotes = async () => {
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

      toast.success("Meeting notes exported successfully!");
    } catch (err) {
      toast.error("Failed to export meeting notes.");
    }
  };

  // --------------------------------------------------
  // Disconnect & Cleanup
  // --------------------------------------------------
  const disconnectMeeting = () => {
    stopTranscription();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    Object.values(peerConnectionsRef.current).forEach((connection) => {
      connection.close();
    });

    peerConnectionsRef.current = {};
    remoteMediaStreamsRef.current = {};
    iceCandidateQueuesRef.current = {};

    if (socketRef.current) {
      socketRef.current.emit("leave-room", { room_code: roomCode });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const leaveMeeting = () => {
    disconnectMeeting();
    api.post(`/api/meetings/${roomCode}/end`).catch(() => {});
    navigate("/dashboard");
  };

  const endMeetingAndViewResults = () => {
    disconnectMeeting();
    api
      .post(`/api/meetings/${roomCode}/end`)
      .finally(() => {
        navigate(`/meeting-ended/${roomCode}`);
      });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    toast.success("Meeting ID copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Filtered transcripts
  const filteredTranscripts = transcripts.filter((t) => {
    if (!transcriptFilter.trim()) return true;
    const term = transcriptFilter.toLowerCase();
    return (
      (t.text && t.text.toLowerCase().includes(term)) ||
      (t.speaker_name && t.speaker_name.toLowerCase().includes(term))
    );
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg-main)",
        color: "var(--text-primary)",
        overflow: "hidden",
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                {meetingDetails?.title || `Meeting ${roomCode}`}
              </h1>
              {meetingDetails?.requires_passcode && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#fbbf24",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "700",
                  }}
                >
                  <Lock size={11} />
                  Protected
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Meeting ID:</span>
              <button
                onClick={copyRoomCode}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "transparent",
                  border: "none",
                  color: "var(--primary)",
                  fontFamily: "monospace",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
                title="Click to copy room code"
              >
                <span>{roomCode}</span>
                {copiedCode ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Status Indicators & Action Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Transcription Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "var(--radius-full)",
              background: transcribing ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
              border: transcribing ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border-subtle)",
              fontSize: "12px",
              fontWeight: "600",
              color: transcribing ? "var(--accent-emerald)" : "var(--text-secondary)",
            }}
          >
            <Radio size={12} className={transcribing ? "pulse-anim" : ""} />
            <span>{transcribing ? "AI Transcribing" : "Transcription Idle"}</span>
          </div>

          <button
            onClick={() => setInviteModalOpen(true)}
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            <Share2 size={13} />
            <span>Invite</span>
          </button>
        </div>
      </header>

      {/* Main Video Stage & Side Panel */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Video Conference Stage */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "16px",
            background: "var(--bg-main)",
            overflowY: "auto",
            position: "relative",
          }}
        >
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                background: "rgba(244, 63, 94, 0.15)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "var(--radius-md)",
                color: "var(--accent-rose)",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Consent Banner when Transcription is Active */}
          {transcribing && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                background: "rgba(56, 189, 248, 0.1)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
                color: "#7dd3fc",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={14} color="var(--primary)" />
                <span>
                  Meeting audio is being captured with participant consent and transcribed using AI Whisper.
                </span>
              </div>
              <button
                onClick={() => setActiveSidePanel("transcript")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--primary)",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "12px",
                }}
              >
                View Live Transcripts &rarr;
              </button>
            </div>
          )}

          {/* Screen Share Stage (if active) */}
          {screenSharing && (
            <div
              style={{
                marginBottom: "16px",
                background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                border: "2px solid var(--primary)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  left: "12px",
                  zIndex: 2,
                  background: "rgba(11, 15, 25, 0.8)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Monitor size={14} />
                <span>Your Screen Presentation</span>
              </div>
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  maxHeight: "440px",
                  objectFit: "contain",
                  background: "#000",
                  display: "block",
                }}
              />
            </div>
          )}

          {/* Participant Video Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: remoteStreams.length === 0 ? "1fr" : "repeat(auto-fit, minmax(360px, 1fr))",
              gap: "16px",
              flex: 1,
              alignContent: "center",
            }}
          >
            {/* Local User Tile */}
            <div
              style={{
                position: "relative",
                background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                border: "1px solid var(--border-base)",
                aspectRatio: "16 / 9",
                maxHeight: remoteStreams.length === 0 ? "480px" : "360px",
                margin: "0 auto",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)", // Mirror local selfie view
                  display: cameraOn ? "block" : "none",
                }}
              />

              {!cameraOn && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div
                    style={{
                      width: "68px",
                      height: "68px",
                      borderRadius: "50%",
                      background: "rgba(56, 189, 248, 0.2)",
                      border: "2px solid var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      fontWeight: "800",
                      color: "var(--primary)",
                      margin: "0 auto 10px",
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#ffffff" }}>
                    {displayName} (Camera Off)
                  </div>
                </div>
              )}

              {/* Participant Name & Mic Badge */}
              <div
                style={{
                  position: "absolute",
                  bottom: "10px",
                  left: "10px",
                  background: "rgba(11, 15, 25, 0.75)",
                  backdropFilter: "blur(4px)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#ffffff",
                }}
              >
                <span>{displayName} (You)</span>
                {micOn ? (
                  <Mic size={13} color="var(--accent-emerald)" />
                ) : (
                  <MicOff size={13} color="var(--accent-rose)" />
                )}
              </div>
            </div>

            {/* Remote Participants' Tiles */}
            {remoteStreams.map((remote) => {
              const participantInfo = participants.find((p) => p.socket_id === remote.socketId);
              const pName = participantInfo?.display_name || "Remote Participant";
              const mediaState = peerMediaStates[remote.socketId] || { mic_on: true, camera_on: true };

              return (
                <div
                  key={remote.socketId}
                  style={{
                    position: "relative",
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    border: "1px solid var(--border-base)",
                    aspectRatio: "16 / 9",
                    maxHeight: "360px",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <video
                    autoPlay
                    playsInline
                    controls={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: mediaState.camera_on !== false ? "block" : "none",
                    }}
                    ref={(element) => {
                      if (element && element.srcObject !== remote.stream) {
                        element.srcObject = remote.stream;
                      }
                    }}
                  />

                  {mediaState.camera_on === false && (
                    <div style={{ textAlign: "center", padding: "20px" }}>
                      <div
                        style={{
                          width: "68px",
                          height: "68px",
                          borderRadius: "50%",
                          background: "rgba(99, 102, 241, 0.2)",
                          border: "2px solid var(--accent-indigo)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "24px",
                          fontWeight: "800",
                          color: "var(--accent-indigo)",
                          margin: "0 auto 10px",
                        }}
                      >
                        {pName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#ffffff" }}>
                        {pName}
                      </div>
                    </div>
                  )}

                  {/* Remote Badge */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "10px",
                      left: "10px",
                      background: "rgba(11, 15, 25, 0.75)",
                      backdropFilter: "blur(4px)",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#ffffff",
                    }}
                  >
                    <span>{pName}</span>
                    {mediaState.mic_on !== false ? (
                      <Mic size={13} color="var(--accent-emerald)" />
                    ) : (
                      <MicOff size={13} color="var(--accent-rose)" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Waiting banner when alone in room */}
          {remoteStreams.length === 0 && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                background: "var(--bg-surface)",
                border: "1px dashed var(--border-base)",
                borderRadius: "var(--radius-md)",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                Waiting for others to join. Share room code <strong>{roomCode}</strong> or click Invite above.
              </p>
            </div>
          )}
        </div>

        {/* Collapsible Side Panel: Live Transcripts / AI Intelligence / Participants */}
        {activeSidePanel && (
          <aside
            style={{
              width: "380px",
              background: "var(--bg-surface)",
              borderLeft: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              zIndex: 5,
            }}
          >
            {/* Panel Tabs Header */}
            <div
              style={{
                display: "flex",
                background: "var(--bg-card)",
                borderBottom: "1px solid var(--border-subtle)",
                padding: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveSidePanel("transcript")}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: "700",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: activeSidePanel === "transcript" ? "var(--primary)" : "transparent",
                  color: activeSidePanel === "transcript" ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                <FileText size={14} />
                <span>Transcript ({transcripts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSidePanel("intelligence");
                  if (!intelligence) handleFetchIntelligence();
                }}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: "700",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: activeSidePanel === "intelligence" ? "var(--primary)" : "transparent",
                  color: activeSidePanel === "intelligence" ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                <Sparkles size={14} />
                <span>AI Intel</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSidePanel("participants")}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: "700",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: activeSidePanel === "participants" ? "var(--primary)" : "transparent",
                  color: activeSidePanel === "participants" ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                <UsersIcon size={14} />
                <span>Roster ({participants.length})</span>
              </button>
            </div>

            {/* TAB 1: LIVE TRANSCRIPTS */}
            {activeSidePanel === "transcript" && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                {/* Search Bar */}
                <div style={{ padding: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={14}
                      style={{
                        position: "absolute",
                        left: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                      }}
                    />
                    <input
                      type="text"
                      className="input-field"
                      style={{ paddingLeft: "32px", fontSize: "12px" }}
                      placeholder="Search live transcript..."
                      value={transcriptFilter}
                      onChange={(e) => setTranscriptFilter(e.target.value)}
                    />
                  </div>
                </div>

                {/* Transcripts Feed */}
                <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredTranscripts.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "13px" }}>
                      {transcribing ? (
                        <>
                          <Radio size={20} color="var(--primary)" style={{ margin: "0 auto 8px" }} />
                          <p>Listening for speech... Speak clearly into your microphone.</p>
                        </>
                      ) : (
                        <>
                          <FileText size={20} color="var(--text-muted)" style={{ margin: "0 auto 8px" }} />
                          <p>No transcripts recorded yet. Click "Transcribe" in the bottom toolbar to begin.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    filteredTranscripts.map((t, idx) => (
                      <div
                        key={t.id || idx}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)",
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)" }}>
                            {t.speaker_name || "Speaker"}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                            {t.timestamp_str || "00:00"}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.4" }}>
                          {t.text}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            )}

            {/* TAB 2: AI MEETING INTELLIGENCE */}
            {activeSidePanel === "intelligence" && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto", padding: "14px" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  <button
                    onClick={handleGenerateIntelligence}
                    disabled={generatingIntelligence}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: "8px 12px", fontSize: "12px" }}
                  >
                    <RefreshCw size={13} className={generatingIntelligence ? "spin-anim" : ""} />
                    <span>{generatingIntelligence ? "Analyzing..." : "Update Intelligence"}</span>
                  </button>
                  <button
                    onClick={handleExportNotes}
                    className="btn btn-secondary"
                    style={{ padding: "8px 12px", fontSize: "12px" }}
                    title="Export Markdown notes"
                  >
                    <Download size={13} />
                  </button>
                </div>

                {!intelligence ? (
                  <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "13px" }}>
                    <Sparkles size={24} color="var(--primary)" style={{ margin: "0 auto 10px" }} />
                    <p>Click "Update Intelligence" to synthesize summary, decisions, action items, and key points from actual meeting speech.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Executive Summary */}
                    <div style={{ background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary)", marginBottom: "6px" }}>
                        Executive Summary
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--text-primary)", lineHeight: "1.5" }}>
                        {intelligence.summary}
                      </p>
                    </div>

                    {/* Decisions Reached */}
                    <div style={{ background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--accent-emerald)", marginBottom: "6px" }}>
                        Decisions Reached ({intelligence.decisions?.length || 0})
                      </div>
                      {(!intelligence.decisions || intelligence.decisions.length === 0) ? (
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>No explicit decisions recorded yet.</p>
                      ) : (
                        <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "12px", color: "var(--text-primary)" }}>
                          {intelligence.decisions.map((d, i) => (
                            <li key={i} style={{ marginBottom: "4px" }}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Action Items & Task Owners */}
                    <div style={{ background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#fbbf24", marginBottom: "6px" }}>
                        Action Items & Owners ({intelligence.action_items?.length || 0})
                      </div>
                      {(!intelligence.action_items || intelligence.action_items.length === 0) ? (
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>No action items identified yet.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {intelligence.action_items.map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "var(--bg-main)",
                                padding: "8px 10px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border-subtle)",
                                fontSize: "12px",
                              }}
                            >
                              <div style={{ fontWeight: "600", color: "#ffffff", marginBottom: "4px" }}>
                                {item.task}
                              </div>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px" }}>
                                {item.assignee && (
                                  <span style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "3px" }}>
                                    <User size={11} /> {item.assignee}
                                  </span>
                                )}
                                {item.deadline && (
                                  <span style={{ color: "#fbbf24", display: "flex", alignItems: "center", gap: "3px" }}>
                                    <Clock size={11} /> {item.deadline}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unresolved Questions & Blockers */}
                    {((intelligence.unresolved_questions && intelligence.unresolved_questions.length > 0) ||
                      (intelligence.blockers && intelligence.blockers.length > 0)) && (
                      <div style={{ background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--accent-rose)", marginBottom: "6px" }}>
                          Questions & Blockers
                        </div>
                        <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "12px", color: "var(--text-primary)" }}>
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
                )}
              </div>
            )}

            {/* TAB 3: PARTICIPANTS ROSTER */}
            {activeSidePanel === "participants" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {participants.map((p) => {
                  const isYou = p.socket_id === socketRef.current?.id;
                  const mState = isYou
                    ? { mic_on: micOn, camera_on: cameraOn }
                    : peerMediaStates[p.socket_id] || { mic_on: true, camera_on: true };

                  return (
                    <div
                      key={p.socket_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        background: "var(--bg-card)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: isYou ? "rgba(56, 189, 248, 0.2)" : "rgba(99, 102, 241, 0.2)",
                            color: isYou ? "var(--primary)" : "var(--accent-indigo)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: "700",
                          }}
                        >
                          {p.display_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>
                          {p.display_name} {isYou && "(You)"}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {mState.mic_on ? (
                          <Mic size={14} color="var(--accent-emerald)" />
                        ) : (
                          <MicOff size={14} color="var(--accent-rose)" />
                        )}
                        {mState.camera_on ? (
                          <VideoIcon size={14} color="var(--primary)" />
                        ) : (
                          <VideoOff size={14} color="var(--text-muted)" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Control Toolbar */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border-subtle)",
          zIndex: 10,
        }}
      >
        {/* Left: Meeting Metadata */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "240px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Participants: <strong>{participants.length}</strong>
          </span>
        </div>

        {/* Center: Core Meeting Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Microphone */}
          <button
            onClick={toggleMicrophone}
            className={`btn ${micOn ? "btn-secondary" : "btn-danger"}`}
            style={{ borderRadius: "var(--radius-full)", width: "44px", height: "44px", padding: 0 }}
            title={micOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            className={`btn ${cameraOn ? "btn-secondary" : "btn-danger"}`}
            style={{ borderRadius: "var(--radius-full)", width: "44px", height: "44px", padding: 0 }}
            title={cameraOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {cameraOn ? <VideoIcon size={18} /> : <VideoOff size={18} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={screenSharing ? stopScreenSharing : startScreenSharing}
            className={`btn ${screenSharing ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "var(--radius-full)", width: "44px", height: "44px", padding: 0 }}
            title={screenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            {screenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
          </button>

          {/* Transcription Toggle */}
          <button
            onClick={toggleTranscription}
            className={`btn ${transcribing ? "btn-primary" : "btn-secondary"}`}
            style={{
              borderRadius: "var(--radius-full)",
              padding: "0 16px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
            }}
            title={transcribing ? "Pause Transcription" : "Start Live Transcription"}
          >
            <Radio size={16} />
            <span>{transcribing ? "Transcribing" : "Transcribe"}</span>
          </button>

          {/* End Meeting & View Results */}
          <button
            onClick={endMeetingAndViewResults}
            className="btn btn-secondary"
            style={{
              borderRadius: "var(--radius-full)",
              padding: "0 14px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              marginLeft: "6px",
            }}
            title="End meeting and view full summary & transcript"
          >
            <Sparkles size={15} />
            <span>End & Results</span>
          </button>

          {/* Leave Call */}
          <button
            onClick={leaveMeeting}
            className="btn btn-danger"
            style={{
              borderRadius: "var(--radius-full)",
              padding: "0 18px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: "700",
              marginLeft: "6px",
            }}
          >
            <PhoneOff size={16} />
            <span>Leave</span>
          </button>
        </div>

        {/* Right: Drawer Toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "240px", justifyContent: "flex-end" }}>
          <button
            onClick={() => setActiveSidePanel(activeSidePanel === "transcript" ? null : "transcript")}
            className={`btn ${activeSidePanel === "transcript" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "8px 12px", fontSize: "12px" }}
            title="Live Transcripts"
          >
            <FileText size={15} />
            <span>Transcript</span>
          </button>

          <button
            onClick={() => {
              const next = activeSidePanel === "intelligence" ? null : "intelligence";
              setActiveSidePanel(next);
              if (next && !intelligence) handleFetchIntelligence();
            }}
            className={`btn ${activeSidePanel === "intelligence" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "8px 12px", fontSize: "12px" }}
            title="AI Meeting Intelligence"
          >
            <Sparkles size={15} />
            <span>AI Intel</span>
          </button>
        </div>
      </footer>

      {/* Invite Modal */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        meeting={{
          title: meetingDetails?.title || `Meeting ${roomCode}`,
          room_code: roomCode,
          passcode: meetingDetails?.passcode,
          meeting_type: meetingDetails?.meeting_type,
          external_link: meetingDetails?.external_link,
        }}
      />
    </div>
  );
}

export default MeetingRoom;