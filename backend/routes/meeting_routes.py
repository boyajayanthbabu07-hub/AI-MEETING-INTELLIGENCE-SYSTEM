import secrets
import string
from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.app.database import SessionLocal
from backend.models.models import Meeting, Participant


meeting_bp = Blueprint(
    "meeting",
    __name__,
    url_prefix="/api/meetings"
)


def generate_room_code(length=8):
    characters = string.ascii_uppercase + string.digits

    return "".join(
        secrets.choice(characters)
        for _ in range(length)
    )


@meeting_bp.route("/create", methods=["POST"])
@jwt_required()
def create_meeting():

    data = request.get_json() or {}

    title = data.get("title")

    if not title:
        return {
            "message": "Meeting title is required"
        }, 400

    user_id = int(get_jwt_identity())

    db = SessionLocal()

    try:

        room_code = generate_room_code()

        while db.query(Meeting).filter(
            Meeting.room_code == room_code
        ).first():

            room_code = generate_room_code()

        meeting = Meeting(
            user_id=user_id,
            title=title,
            room_code=room_code,
            status="waiting"
        )

        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        return {
            "message": "Meeting created successfully",
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
                "room_code": meeting.room_code,
                "status": meeting.status,
                "created_at": meeting.created_at.isoformat()
            }
        }, 201

    except Exception as e:

        db.rollback()

        return {
            "message": "Meeting creation failed",
            "error": str(e)
        }, 500

    finally:

        db.close()


@meeting_bp.route("/join", methods=["POST"])
@jwt_required()
def join_meeting():

    data = request.get_json() or {}

    room_code = data.get("room_code")
    display_name = data.get("display_name")

    if not room_code:
        return {
            "message": "Room code is required"
        }, 400

    if not display_name:
        return {
            "message": "Display name is required"
        }, 400

    user_id = int(get_jwt_identity())

    db = SessionLocal()

    try:

        meeting = db.query(Meeting).filter(
            Meeting.room_code == room_code.upper()
        ).first()

        if not meeting:
            return {
                "message": "Meeting not found"
            }, 404

        if meeting.status == "ended":
            return {
                "message": "Meeting has already ended"
            }, 400

        existing_participant = db.query(Participant).filter(
            Participant.meeting_id == meeting.id,
            Participant.user_id == user_id,
            Participant.left_at.is_(None)
        ).first()

        if existing_participant:

            return {
                "message": "Already joined this meeting",
                "meeting": {
                    "id": meeting.id,
                    "title": meeting.title,
                    "room_code": meeting.room_code,
                    "status": meeting.status
                },
                "participant": {
                    "id": existing_participant.id,
                    "display_name": existing_participant.display_name,
                    "joined_at": existing_participant.joined_at.isoformat()
                }
            }, 200

        participant = Participant(
            meeting_id=meeting.id,
            user_id=user_id,
            display_name=display_name
        )

        if meeting.status == "waiting":
            meeting.status = "active"
            meeting.started_at = datetime.utcnow()

        db.add(participant)
        db.commit()
        db.refresh(participant)

        return {
            "message": "Joined meeting successfully",
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
                "room_code": meeting.room_code,
                "status": meeting.status
            },
            "participant": {
                "id": participant.id,
                "display_name": participant.display_name,
                "joined_at": participant.joined_at.isoformat()
            }
        }, 200

    except Exception as e:

        db.rollback()

        return {
            "message": "Failed to join meeting",
            "error": str(e)
        }, 500

    finally:

        db.close()


@meeting_bp.route("/<int:meeting_id>", methods=["GET"])
@jwt_required()
def get_meeting(meeting_id):

    db = SessionLocal()

    try:

        meeting = db.query(Meeting).filter(
            Meeting.id == meeting_id
        ).first()

        if not meeting:
            return {
                "message": "Meeting not found"
            }, 404

        participants = db.query(Participant).filter(
            Participant.meeting_id == meeting_id
        ).all()

        participant_list = []

        for participant in participants:

            participant_list.append({
                "id": participant.id,
                "user_id": participant.user_id,
                "display_name": participant.display_name,
                "joined_at": (
                    participant.joined_at.isoformat()
                    if participant.joined_at
                    else None
                ),
                "left_at": (
                    participant.left_at.isoformat()
                    if participant.left_at
                    else None
                )
            })

        return {
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
                "room_code": meeting.room_code,
                "status": meeting.status,
                "started_at": (
                    meeting.started_at.isoformat()
                    if meeting.started_at
                    else None
                ),
                "ended_at": (
                    meeting.ended_at.isoformat()
                    if meeting.ended_at
                    else None
                ),
                "created_at": meeting.created_at.isoformat()
            },
            "participants": participant_list
        }, 200

    finally:

        db.close()