import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function Dashboard() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("access_token");

  const [title, setTitle] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState(
    user?.name || ""
  );

  const [meeting, setMeeting] = useState(null);
  const [joinedMeeting, setJoinedMeeting] = useState(null);
  const [message, setMessage] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  const handleCreateMeeting = async () => {
    if (!title.trim()) {
      setMessage("Please enter a meeting title");
      return;
    }

    try {
      const response = await api.post(
        "/api/meetings/create",
        {
          title: title
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMeeting(response.data.meeting);
      setMessage("Meeting created successfully");
      setTitle("");
    } catch (error) {
      if (error.response) {
        setMessage(
          error.response.data.message ||
          "Failed to create meeting"
        );
      } else {
        setMessage(
          "Unable to connect to the backend"
        );
      }
    }
  };

  const handleJoinMeeting = async () => {
    if (!roomCode.trim()) {
      setMessage("Please enter a room code");
      return;
    }

    if (!displayName.trim()) {
      setMessage("Please enter your display name");
      return;
    }

    try {
      const response = await api.post(
        "/api/meetings/join",
        {
          room_code: roomCode,
          display_name: displayName
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setJoinedMeeting(response.data);
      setMessage("Meeting joined successfully");

      navigate(
        `/meeting/${response.data.meeting.room_code}`
      );
    } catch (error) {
      if (error.response) {
        setMessage(
          error.response.data.message ||
          "Failed to join meeting"
        );
      } else {
        setMessage(
          "Unable to connect to the backend"
        );
      }
    }
  };

  return (
    <div>
      <h1>AI Meeting Intelligence System</h1>

      <h2>Dashboard</h2>

      <p>
        Welcome, {user?.name}
      </p>

      <p>
        Email: {user?.email}
      </p>

      <hr />

      <h3>Create Meeting</h3>

      <input
        type="text"
        placeholder="Enter meeting title"
        value={title}
        onChange={(event) =>
          setTitle(event.target.value)
        }
      />

      <br />
      <br />

      <button onClick={handleCreateMeeting}>
        Create Meeting
      </button>

      {meeting && (
        <div>
          <h3>Meeting Created</h3>

          <p>
            Title: {meeting.title}
          </p>

          <p>
            Room Code:{" "}
            <strong>{meeting.room_code}</strong>
          </p>

          <p>
            Status: {meeting.status}
          </p>
        </div>
      )}

      <hr />

      <h3>Join Meeting</h3>

      <input
        type="text"
        placeholder="Enter room code"
        value={roomCode}
        onChange={(event) =>
          setRoomCode(
            event.target.value.toUpperCase()
          )
        }
      />

      <br />
      <br />

      <input
        type="text"
        placeholder="Enter display name"
        value={displayName}
        onChange={(event) =>
          setDisplayName(event.target.value)
        }
      />

      <br />
      <br />

      <button onClick={handleJoinMeeting}>
        Join Meeting
      </button>

      {joinedMeeting && (
        <div>
          <h3>Meeting Joined</h3>

          <p>
            Title:{" "}
            {joinedMeeting.meeting.title}
          </p>

          <p>
            Room Code:{" "}
            {joinedMeeting.meeting.room_code}
          </p>

          <p>
            Status:{" "}
            {joinedMeeting.meeting.status}
          </p>

          <p>
            Participant:{" "}
            {joinedMeeting.participant.display_name}
          </p>
        </div>
      )}

      {message && (
        <p>{message}</p>
      )}

      <hr />

      <h3>Meeting History</h3>

      <button>
        View Meetings
      </button>

      <h3>AI Features</h3>

      <button>
        Search Meetings
      </button>

      <br />
      <br />

      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default Dashboard;