import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function SocketTest() {
  const socketRef = useRef(null);

  const [socketId, setSocketId] = useState("");
  const [messages, setMessages] = useState([]);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("TEST1234");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    console.log("Creating Socket.IO connection...");

    const socket = io("http://127.0.0.1:5000");

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);

      setSocketId(socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");

      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error(
        "Socket connection error:",
        error
      );
    });

    socket.on("user-joined", (data) => {
      console.log(
        "USER-JOINED EVENT RECEIVED:",
        data
      );

      setMessages((previous) => [
        ...previous,
        `${data.display_name} joined the room`
      ]);
    });

    return () => {
      console.log("Cleaning up socket");

      socket.disconnect();
    };
  }, []);

  const joinRoom = () => {
    if (!name.trim()) {
      alert("Enter your name");
      return;
    }

    if (!socketRef.current) {
      console.error("Socket is not available");
      return;
    }

    console.log(
      "Joining room:",
      roomCode,
      "as:",
      name
    );

    socketRef.current.emit(
      "join-room",
      {
        room_code: roomCode,
        display_name: name
      }
    );

    setMessages((previous) => [
      ...previous,
      `You joined room ${roomCode}`
    ]);
  };

  return (
    <div>
      <h1>Socket.IO Test</h1>

      <p>
        Connection:{" "}
        {connected
          ? "Connected"
          : "Disconnected"}
      </p>

      <p>
        Socket ID:{" "}
        {socketId || "Not connected"}
      </p>

      <hr />

      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(event) =>
          setName(event.target.value)
        }
      />

      <br />
      <br />

      <input
        type="text"
        placeholder="Room code"
        value={roomCode}
        onChange={(event) =>
          setRoomCode(
            event.target.value.toUpperCase()
          )
        }
      />

      <br />
      <br />

      <button onClick={joinRoom}>
        Join Test Room
      </button>

      <hr />

      <h3>Messages</h3>

      {messages.length === 0 ? (
        <p>
          No messages yet.
        </p>
      ) : (
        <ul>
          {messages.map(
            (message, index) => (
              <li key={index}>
                {message}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

export default SocketTest;