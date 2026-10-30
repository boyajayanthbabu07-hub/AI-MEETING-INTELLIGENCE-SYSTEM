import os
import sys
import threading

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )
    )
)

from dotenv import load_dotenv
from flask import Flask, request
from datetime import datetime
import base64
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO, join_room, emit

from backend.app.database import SessionLocal
from backend.models.models import Meeting, Participant, Transcript
from backend.ai.intelligence_service import format_timestamp
from backend.routes.auth_routes import auth_bp
from backend.routes.meeting_routes import meeting_bp
from backend.ai.transcription_service import transcribe_audio

load_dotenv()

app = Flask(__name__)

CORS(app)

app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "dev-flask-secret-key-ai-meeting-intel-2026"
)
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY",
    "dev-jwt-secret-key-ai-meeting-intel-2026"
)

JWTManager(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

app.register_blueprint(auth_bp)
app.register_blueprint(meeting_bp)


# --------------------------------------------------
# In-memory participant tracking
# --------------------------------------------------

room_participants = {}


@app.route("/")
def home():
    return {
        "message": "AI Meeting Intelligence System Backend is running",
        "status": "success"
    }


@app.route("/api/health")
def health():
    return {
        "status": "healthy"
    }


# --------------------------------------------------
# Socket connection
# --------------------------------------------------

@socketio.on("connect")
def handle_connect():
    print(f"Socket connected: {request.sid}")


# --------------------------------------------------
# Join meeting room
# --------------------------------------------------

@socketio.on("join-room")
def handle_join_room(data):

    print(f"Join request received: {data}")

    room_code = data.get("room_code")
    display_name = data.get("display_name")

    if not room_code or not display_name:
        print("Invalid join request")
        return

    room_code = room_code.upper()

    existing_participants = room_participants.get(
        room_code,
        {}
    ).copy()

    join_room(room_code)

    if room_code not in room_participants:
        room_participants[room_code] = {}

    room_participants[room_code][request.sid] = {
        "socket_id": request.sid,
        "display_name": display_name
    }

    print(
        f"{display_name} joined room {room_code}"
    )

    print(
        f"Participants in {room_code}:",
        room_participants[room_code]
    )

    for socket_id, participant in existing_participants.items():

        emit(
            "existing-participant",
            {
                "socket_id": socket_id,
                "display_name": participant["display_name"]
            },
            to=request.sid
        )

    emit(
        "user-joined",
        {
            "socket_id": request.sid,
            "display_name": display_name
        },
        to=room_code,
        include_self=False
    )

    print(
        f"user-joined event sent to room {room_code}"
    )


# --------------------------------------------------
# WebRTC offer
# --------------------------------------------------

@socketio.on("offer")
def handle_offer(data):

    target_socket_id = data.get("target")

    print(
        f"Offer received from {request.sid} "
        f"for {target_socket_id}"
    )

    if not target_socket_id:
        return

    emit(
        "offer",
        {
            "offer": data.get("offer"),
            "sender": request.sid
        },
        to=target_socket_id
    )


# --------------------------------------------------
# WebRTC answer
# --------------------------------------------------

@socketio.on("answer")
def handle_answer(data):

    target_socket_id = data.get("target")

    print(
        f"Answer received from {request.sid} "
        f"for {target_socket_id}"
    )

    if not target_socket_id:
        return

    emit(
        "answer",
        {
            "answer": data.get("answer"),
            "sender": request.sid
        },
        to=target_socket_id
    )


# --------------------------------------------------
# ICE candidate
# --------------------------------------------------

@socketio.on("ice-candidate")
def handle_ice_candidate(data):

    target_socket_id = data.get("target")

    print(
        f"ICE candidate received from {request.sid} "
        f"for {target_socket_id}"
    )

    if not target_socket_id:
        return

    emit(
        "ice-candidate",
        {
            "candidate": data.get("candidate"),
            "sender": request.sid
        },
        to=target_socket_id
    )


# --------------------------------------------------
# Real-time audio transcription & persistence
# --------------------------------------------------

@socketio.on("audio-chunk")
def handle_audio_chunk(data):
    """
    Receive audio chunk, transcribe in background thread, broadcast result.
    Threading ensures the Socket.IO event loop is never blocked.
    """
    try:
        room_code = data.get("room_code")
        audio_data = data.get("audio")

        if not room_code or not audio_data:
            return

        room_code = room_code.upper()

        if isinstance(audio_data, str):
            try:
                audio_bytes = base64.b64decode(audio_data)
            except Exception:
                audio_bytes = audio_data.encode("utf-8")
        elif isinstance(audio_data, list):
            audio_bytes = bytes(audio_data)
        elif isinstance(audio_data, bytes):
            audio_bytes = audio_data
        else:
            return

        if len(audio_bytes) < 1000:
            return

        print(
            f"Audio chunk received from {request.sid} ({room_code}): "
            f"{len(audio_bytes)} bytes"
        )

        sid = request.sid
        speaker_name = (data.get("speaker_name") or "").strip()
        if not speaker_name:
            participant = room_participants.get(room_code, {}).get(sid)
            speaker_name = participant["display_name"] if participant else "Participant"

        def _transcribe_and_emit():
            text = transcribe_audio(audio_bytes)
            if not text or len(text.strip()) < 2:
                return

            print(f"[{room_code}] Transcription from {speaker_name}: {text}")

            transcript_id = None
            start_time = 0.0
            end_time = 4.0
            created_at_iso = datetime.utcnow().isoformat()

            db = SessionLocal()
            try:
                meeting = db.query(Meeting).filter(Meeting.room_code == room_code).first()
                if meeting:
                    now = datetime.utcnow()
                    if meeting.started_at:
                        start_time = max(0.0, (now - meeting.started_at).total_seconds())
                    end_time = start_time + 4.0

                    record = Transcript(
                        meeting_id=meeting.id,
                        speaker_name=speaker_name,
                        text=text,
                        start_time=start_time,
                        end_time=end_time
                    )
                    db.add(record)
                    db.commit()
                    db.refresh(record)
                    transcript_id = record.id
                    created_at_iso = record.created_at.isoformat()
            except Exception as db_err:
                print("Failed to persist transcript segment:", db_err)
                db.rollback()
            finally:
                db.close()

            socketio.emit(
                "transcription-result",
                {
                    "id": transcript_id,
                    "room_code": room_code,
                    "speaker_name": speaker_name,
                    "text": text,
                    "start_time": start_time,
                    "end_time": end_time,
                    "timestamp_str": format_timestamp(start_time),
                    "created_at": created_at_iso
                },
                to=room_code
            )

        t = threading.Thread(target=_transcribe_and_emit, daemon=True)
        t.start()

    except Exception as error:
        print("Audio chunk handler error:", error)


# --------------------------------------------------
# Participant Media State Signaling (Mic, Cam, Screen)
# --------------------------------------------------

@socketio.on("peer-media-state")
def handle_peer_media_state(data):
    room_code = (data.get("room_code") or "").upper()
    if not room_code:
        return

    emit(
        "peer-media-state",
        {
            "socket_id": request.sid,
            "display_name": data.get("display_name"),
            "mic_on": data.get("mic_on"),
            "camera_on": data.get("camera_on"),
            "screen_sharing": data.get("screen_sharing")
        },
        to=room_code,
        include_self=False
    )


# --------------------------------------------------
# Transcription Control Signaling
# --------------------------------------------------

@socketio.on("toggle-transcription")
def handle_toggle_transcription(data):
    room_code = (data.get("room_code") or "").upper()
    enabled = bool(data.get("enabled", True))
    display_name = data.get("display_name", "A participant")

    emit(
        "transcription-status-changed",
        {
            "enabled": enabled,
            "initiated_by": display_name
        },
        to=room_code
    )


# --------------------------------------------------
# Explicit Leave Room
# --------------------------------------------------

@socketio.on("leave-room")
def handle_leave_room(data):
    room_code = (data.get("room_code") or "").upper()
    socket_id = request.sid

    if room_code in room_participants and socket_id in room_participants[room_code]:
        participant = room_participants[room_code].pop(socket_id)
        emit(
            "user-left",
            {
                "socket_id": socket_id,
                "display_name": participant["display_name"]
            },
            to=room_code
        )

        if not room_participants[room_code]:
            del room_participants[room_code]
# --------------------------------------------------

@socketio.on("disconnect")
def handle_disconnect():

    socket_id = request.sid

    print(
        f"Socket disconnected: {socket_id}"
    )

    disconnected_room = None
    disconnected_participant = None

    for room_code, participants in room_participants.items():

        if socket_id in participants:

            disconnected_room = room_code

            disconnected_participant = participants[
                socket_id
            ]

            del participants[socket_id]

            break

    if disconnected_room:

        print(
            f"{disconnected_participant['display_name']} "
            f"left room {disconnected_room}"
        )

        emit(
            "user-left",
            {
                "socket_id": socket_id,
                "display_name":
                    disconnected_participant[
                        "display_name"
                    ]
            },
            to=disconnected_room
        )

        if not room_participants[
            disconnected_room
        ]:

            del room_participants[
                disconnected_room
            ]

        print(
            f"Participants remaining in "
            f"{disconnected_room}:",
            room_participants.get(
                disconnected_room,
                {}
            )
        )


# --------------------------------------------------
# Start server
# --------------------------------------------------

if __name__ == "__main__":

    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True
    )