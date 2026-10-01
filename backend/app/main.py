import os
import sys

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
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO, join_room, emit

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
# Real-time audio transcription
# --------------------------------------------------

@socketio.on("audio-chunk")
def handle_audio_chunk(data):

    try:

        room_code = data.get("room_code")
        audio_data = data.get("audio")

        if not room_code or not audio_data:
            return

        if isinstance(audio_data, list):
            audio_bytes = bytes(audio_data)
        elif isinstance(audio_data, bytes):
            audio_bytes = audio_data
        else:
            return

        print(
            f"Audio chunk received from {request.sid}: "
            f"{len(audio_bytes)} bytes"
        )

        text = transcribe_audio(audio_bytes)

        if not text:
            return

        participant = None

        if room_code in room_participants:
            participant = room_participants[
                room_code
            ].get(request.sid)

        speaker_name = "Unknown"

        if participant:
            speaker_name = participant[
                "display_name"
            ]

        print(
            f"Transcription from {speaker_name}: "
            f"{text}"
        )

        emit(
            "transcription-result",
            {
                "speaker_name": speaker_name,
                "text": text
            },
            to=room_code
        )

    except Exception as error:

        print(
            "Audio transcription error:",
            error
        )


# --------------------------------------------------
# Disconnect
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
        debug=True
    )