import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

function MeetingRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const peerConnectionsRef = useRef({});
  const remoteMediaStreamsRef = useRef({});
  const iceCandidateQueuesRef = useRef({});

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const [remoteStreams, setRemoteStreams] = useState([]);
  const [participants, setParticipants] = useState([]);

  const [error, setError] = useState("");

  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const displayName = user?.name || "Guest";

  const rtcConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  };

  useEffect(() => {
    startMeeting();

    return () => {
      disconnectMeeting();
    };
  }, []);

  const addParticipant = (
    socketId,
    participantName
  ) => {
    if (!socketId) {
      return;
    }

    setParticipants((previous) => {
      const exists = previous.some(
        (participant) =>
          participant.socket_id === socketId
      );

      if (exists) {
        return previous;
      }

      return [
        ...previous,
        {
          socket_id: socketId,
          display_name: participantName
        }
      ];
    });
  };

  const removeParticipant = (socketId) => {
    setParticipants((previous) =>
      previous.filter(
        (participant) =>
          participant.socket_id !== socketId
      )
    );
  };

  const createPeerConnection = (
    targetSocketId
  ) => {
    if (
      peerConnectionsRef.current[
        targetSocketId
      ]
    ) {
      return peerConnectionsRef.current[
        targetSocketId
      ];
    }

    const peerConnection =
      new RTCPeerConnection(
        rtcConfiguration
      );

    peerConnectionsRef.current[
      targetSocketId
    ] = peerConnection;

    iceCandidateQueuesRef.current[
      targetSocketId
    ] = [];

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          peerConnection.addTrack(
            track,
            localStreamRef.current
          );
        });
    }

    peerConnection.onicecandidate = (
      event
    ) => {
      if (
        event.candidate &&
        socketRef.current
      ) {
        socketRef.current.emit(
          "ice-candidate",
          {
            target: targetSocketId,
            candidate: event.candidate
          }
        );
      }
    };

    peerConnection.ontrack = (event) => {
      console.log(
        "Remote track received:",
        event.track.kind,
        targetSocketId
      );

      let remoteStream =
        remoteMediaStreamsRef.current[
          targetSocketId
        ];

      if (!remoteStream) {
        remoteStream = new MediaStream();

        remoteMediaStreamsRef.current[
          targetSocketId
        ] = remoteStream;

        setRemoteStreams((previous) => {
          const alreadyExists =
            previous.some(
              (item) =>
                item.socketId ===
                targetSocketId
            );

          if (alreadyExists) {
            return previous;
          }

          return [
            ...previous,
            {
              socketId: targetSocketId,
              stream: remoteStream
            }
          ];
        });
      }

      const alreadyHasTrack =
        remoteStream
          .getTracks()
          .some(
            (track) =>
              track.id === event.track.id
          );

      if (!alreadyHasTrack) {
        remoteStream.addTrack(
          event.track
        );
      }
    };

    peerConnection.onconnectionstatechange =
      () => {
        console.log(
          "WebRTC connection state:",
          targetSocketId,
          peerConnection.connectionState
        );

        if (
          peerConnection.connectionState ===
            "failed" ||
          peerConnection.connectionState ===
            "closed" ||
          peerConnection.connectionState ===
            "disconnected"
        ) {
          removePeer(targetSocketId);
        }
      };

    peerConnection.oniceconnectionstatechange =
      () => {
        console.log(
          "ICE connection state:",
          targetSocketId,
          peerConnection.iceConnectionState
        );
      };

    return peerConnection;
  };

  const addQueuedIceCandidates = async (
    socketId,
    peerConnection
  ) => {
    const queue =
      iceCandidateQueuesRef.current[
        socketId
      ] || [];

    for (const candidate of queue) {
      try {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (error) {
        console.error(
          "Queued ICE candidate error:",
          error
        );
      }
    }

    iceCandidateQueuesRef.current[
      socketId
    ] = [];
  };

  const startOffer = async (
    socket,
    targetSocketId
  ) => {
    const peerConnection =
      createPeerConnection(
        targetSocketId
      );

    try {
      const offer =
        await peerConnection.createOffer();

      await peerConnection.setLocalDescription(
        offer
      );

      socket.emit("offer", {
        target: targetSocketId,
        offer
      });

      console.log(
        "Offer sent:",
        targetSocketId
      );
    } catch (error) {
      console.error(
        "Offer error:",
        error
      );
    }
  };

  const startMeeting = async () => {
    try {
      setError("");

      const mediaStream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: true,
            audio: true
          }
        );

      localStreamRef.current =
        mediaStream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject =
          mediaStream;
      }

      const socket = io(
        "http://192.168.0.108:5000",
        {
          transports: [
            "websocket",
            "polling"
          ]
        }
      );

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log(
          "Socket connected:",
          socket.id
        );

        // Add yourself to the participant list
        setParticipants([
          {
            socket_id: socket.id,
            display_name: displayName
          }
        ]);

        socket.emit("join-room", {
          room_code: roomCode,
          display_name: displayName
        });
      });

      socket.on(
        "connect_error",
        (error) => {
          console.error(
            "Socket connection error:",
            error
          );

          setError(
            "Unable to connect to meeting server."
          );
        }
      );

      // ------------------------------------------------
      // Existing participant
      // ------------------------------------------------

      socket.on(
        "existing-participant",
        async (data) => {
          console.log(
            "Existing participant:",
            data.display_name,
            data.socket_id
          );

          addParticipant(
            data.socket_id,
            data.display_name
          );

          // New participant creates offer
          await startOffer(
            socket,
            data.socket_id
          );
        }
      );

      // ------------------------------------------------
      // New participant
      // ------------------------------------------------

      socket.on(
        "user-joined",
        (data) => {
          console.log(
            "User joined:",
            data.display_name,
            data.socket_id
          );

          addParticipant(
            data.socket_id,
            data.display_name
          );
        }
      );

      // ------------------------------------------------
      // Offer
      // ------------------------------------------------

      socket.on(
        "offer",
        async (data) => {
          console.log(
            "Offer received:",
            data.sender
          );

          const peerConnection =
            createPeerConnection(
              data.sender
            );

          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(
                data.offer
              )
            );

            await addQueuedIceCandidates(
              data.sender,
              peerConnection
            );

            const answer =
              await peerConnection.createAnswer();

            await peerConnection.setLocalDescription(
              answer
            );

            socket.emit("answer", {
              target: data.sender,
              answer
            });

            console.log(
              "Answer sent:",
              data.sender
            );
          } catch (error) {
            console.error(
              "Answer error:",
              error
            );
          }
        }
      );

      // ------------------------------------------------
      // Answer
      // ------------------------------------------------

      socket.on(
        "answer",
        async (data) => {
          console.log(
            "Answer received:",
            data.sender
          );

          const peerConnection =
            peerConnectionsRef.current[
              data.sender
            ];

          if (!peerConnection) {
            return;
          }

          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(
                data.answer
              )
            );

            await addQueuedIceCandidates(
              data.sender,
              peerConnection
            );

            console.log(
              "Remote description set"
            );
          } catch (error) {
            console.error(
              "Remote description error:",
              error
            );
          }
        }
      );

      // ------------------------------------------------
      // ICE candidate
      // ------------------------------------------------

      socket.on(
        "ice-candidate",
        async (data) => {
          console.log(
            "ICE candidate received:",
            data.sender
          );

          const peerConnection =
            peerConnectionsRef.current[
              data.sender
            ];

          if (!peerConnection) {
            return;
          }

          if (
            !peerConnection.remoteDescription
          ) {
            if (
              !iceCandidateQueuesRef
                .current[data.sender]
            ) {
              iceCandidateQueuesRef.current[
                data.sender
              ] = [];
            }

            iceCandidateQueuesRef.current[
              data.sender
            ].push(data.candidate);

            return;
          }

          try {
            await peerConnection.addIceCandidate(
              new RTCIceCandidate(
                data.candidate
              )
            );
          } catch (error) {
            console.error(
              "ICE candidate error:",
              error
            );
          }
        }
      );

      // ------------------------------------------------
      // Participant left
      // ------------------------------------------------

      socket.on(
        "user-left",
        (data) => {
          console.log(
            "User left:",
            data.display_name,
            data.socket_id
          );

          removePeer(
            data.socket_id
          );
        }
      );

      socket.on(
        "disconnect",
        () => {
          console.log(
            "Socket disconnected"
          );
        }
      );
    } catch (error) {
      console.error(
        "Media error:",
        error
      );

      if (
        error.name ===
        "NotAllowedError"
      ) {
        setError(
          "Camera or microphone permission was denied."
        );
      } else if (
        error.name ===
        "NotReadableError"
      ) {
        setError(
          "Camera or microphone is already being used."
        );
      } else {
        setError(
          "Unable to access camera or microphone."
        );
      }
    }
  };

  const removePeer = (socketId) => {
    const peerConnection =
      peerConnectionsRef.current[
        socketId
      ];

    if (peerConnection) {
      peerConnection.close();

      delete peerConnectionsRef.current[
        socketId
      ];
    }

    delete remoteMediaStreamsRef.current[
      socketId
    ];

    delete iceCandidateQueuesRef.current[
      socketId
    ];

    setRemoteStreams((previous) =>
      previous.filter(
        (item) =>
          item.socketId !== socketId
      )
    );

    removeParticipant(socketId);
  };

  const toggleMicrophone = () => {
    if (!localStreamRef.current) {
      return;
    }

    const tracks =
      localStreamRef.current.getAudioTracks();

    tracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    setMicOn((previous) => !previous);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) {
      return;
    }

    const tracks =
      localStreamRef.current.getVideoTracks();

    tracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    setCameraOn((previous) => !previous);
  };

  const startScreenSharing = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getDisplayMedia(
          {
            video: true,
            audio: true
          }
        );

      screenStreamRef.current =
        stream;

      setScreenSharing(true);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject =
          stream;
      }

      const track =
        stream.getVideoTracks()[0];

      track.onended = () => {
        stopScreenSharing();
      };
    } catch (error) {
      console.error(
        "Screen sharing error:",
        error
      );
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });
    }

    screenStreamRef.current = null;

    setScreenSharing(false);

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject =
        null;
    }
  };

  const disconnectMeeting = () => {
    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      screenStreamRef.current = null;
    }

    Object.values(
      peerConnectionsRef.current
    ).forEach((connection) => {
      connection.close();
    });

    peerConnectionsRef.current = {};
    remoteMediaStreamsRef.current = {};
    iceCandidateQueuesRef.current = {};

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const leaveMeeting = () => {
    disconnectMeeting();
    navigate("/dashboard");
  };

  return (
    <div>
      <h1>
        AI Meeting Intelligence System
      </h1>

      <h2>Meeting Room</h2>

      <p>
        Room Code:{" "}
        <strong>{roomCode}</strong>
      </p>

      {error && (
        <p>
          {error}
        </p>
      )}

      <hr />

      <h3>Your Camera</h3>

      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        width="640"
        height="360"
      />

      <hr />

      <h3>
        Remote Participants
      </h3>

      {remoteStreams.length === 0 ? (
        <p>
          Waiting for another participant...
        </p>
      ) : (
        remoteStreams.map(
          (remote) => (
            <div
              key={remote.socketId}
            >
              <p>
                Remote Participant
              </p>

              <video
                autoPlay
                playsInline
                controls={false}
                width="640"
                height="360"
                ref={(element) => {
                  if (
                    element &&
                    element.srcObject !==
                      remote.stream
                  ) {
                    element.srcObject =
                      remote.stream;
                  }
                }}
              />
            </div>
          )
        )
      )}

      <hr />

      {screenSharing && (
        <div>
          <h3>
            Screen Sharing
          </h3>

          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            width="640"
            height="360"
          />
        </div>
      )}

      <hr />

      <h3>Controls</h3>

      <button
        onClick={toggleMicrophone}
      >
        {micOn
          ? "Mute Microphone"
          : "Unmute Microphone"}
      </button>

      {" "}

      <button
        onClick={toggleCamera}
      >
        {cameraOn
          ? "Turn Camera Off"
          : "Turn Camera On"}
      </button>

      {" "}

      {!screenSharing ? (
        <button
          onClick={startScreenSharing}
        >
          Share Screen
        </button>
      ) : (
        <button
          onClick={stopScreenSharing}
        >
          Stop Sharing
        </button>
      )}

      {" "}

      <button
        onClick={leaveMeeting}
      >
        Leave Meeting
      </button>

      <hr />

      <h3>Participants ({participants.length})</h3>

      {participants.length === 0 ? (
        <p>
          No participants connected.
        </p>
      ) : (
        <ul>
          {participants.map(
            (participant) => (
              <li
                key={
                  participant.socket_id
                }
              >
                {participant.socket_id ===
                socketRef.current?.id
                  ? `${participant.display_name} (You)`
                  : participant.display_name}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

export default MeetingRoom;