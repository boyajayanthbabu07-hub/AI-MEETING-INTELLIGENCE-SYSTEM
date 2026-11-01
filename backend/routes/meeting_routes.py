import os
import re
import secrets
import string
from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.app.database import SessionLocal
from backend.models.models import (
    ActionItem,
    Decision,
    Meeting,
    MeetingMessage,
    MeetingRemoval,
    MeetingSummary,
    Participant,
    Transcript,
    User,
    UserDeletedMeeting,
)
from backend.services.email_service import (
    is_smtp_configured,
    send_meeting_invite_email,
    send_meeting_summary_email,
)
from backend.ai.intelligence_service import generate_meeting_intelligence, format_timestamp
from backend.utils.pdf_generator import generate_meeting_pdf
from sqlalchemy import or_
import io

meeting_bp = Blueprint("meeting", __name__, url_prefix="/api/meetings")

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


def generate_room_code(length=8):
    characters = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(characters) for _ in range(length))


def generate_passcode(length=6):
    """Generate numeric meeting passcode / password."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def parse_email_list(raw_input):
    """Extract and validate distinct email addresses from list or string."""
    if isinstance(raw_input, list):
        items = raw_input
    elif isinstance(raw_input, str):
        items = re.split(r"[,\s;]+", raw_input)
    else:
        items = []

    valid = []
    for item in items:
        cleaned = str(item).strip().lower()
        if cleaned and re.match(EMAIL_REGEX, cleaned) and cleaned not in valid:
            valid.append(cleaned)
    return valid


# ======================================================================
# 1. CREATE MEETING
# ======================================================================

@meeting_bp.route("/create", methods=["POST"])
@jwt_required()
def create_meeting():
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    meeting_type = (data.get("meeting_type") or "internal").strip().lower()
    external_link = (data.get("external_link") or "").strip()

    # Passcode handling: can be custom, auto-generated if requested, or none
    passcode = data.get("passcode")
    require_passcode = bool(data.get("require_passcode", False))

    if require_passcode and not passcode:
        passcode = generate_passcode(6)
    elif passcode:
        passcode = str(passcode).strip()
    else:
        passcode = None

    if not title:
        return {
            "message": "Meeting title is required"
        }, 400

    # Auto-detect Google Meet link if provided
    if external_link and ("meet.google.com" in external_link or "google" in external_link):
        meeting_type = "google_meet"

    user_id = int(get_jwt_identity())
    db = SessionLocal()

    try:
        room_code = generate_room_code()
        while db.query(Meeting).filter(Meeting.room_code == room_code).first():
            room_code = generate_room_code()

        meeting = Meeting(
            user_id=user_id,
            title=title,
            description=description or None,
            room_code=room_code,
            passcode=passcode,
            meeting_type=meeting_type,
            external_link=external_link or None,
            status="waiting"
        )

        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        frontend_base = os.getenv("FRONTEND_URL", "https://localhost:5173").rstrip("/")
        join_url = f"{frontend_base}/meeting/{meeting.room_code}"
        if meeting.passcode:
            join_url = f"{join_url}?passcode={meeting.passcode}"

        return {
            "message": "Meeting created successfully",
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
                "description": meeting.description,
                "room_code": meeting.room_code,
                "passcode": meeting.passcode,
                "meeting_type": meeting.meeting_type,
                "external_link": meeting.external_link,
                "status": meeting.status,
                "join_url": join_url,
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


# ======================================================================
# 2. JOIN MEETING
# ======================================================================

@meeting_bp.route("/join", methods=["POST"])
@jwt_required()
def join_meeting():
    data = request.get_json() or {}

    room_code = (data.get("room_code") or "").strip().upper()
    display_name = (data.get("display_name") or "").strip()
    provided_passcode = (data.get("passcode") or "").strip()

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
        meeting = db.query(Meeting).filter(Meeting.room_code == room_code).first()

        if not meeting:
            return {
                "message": "Meeting not found"
            }, 404

        if meeting.status == "ended":
            return {
                "message": "Meeting has already ended"
            }, 400

        # Check if this user was removed by host from this meeting
        removal = db.query(MeetingRemoval).filter(
            MeetingRemoval.meeting_id == meeting.id,
            MeetingRemoval.user_id == user_id
        ).first()
        if removal and not is_host:
            return {
                "message": "You were removed from this meeting by the host and cannot rejoin."
            }, 403

        # Password / Passcode enforcement
        # If the user is the host who created the meeting, bypass passcode check
        is_host = meeting.user_id == user_id
        if meeting.passcode and not is_host:
            if not provided_passcode:
                return {
                    "message": "This meeting is password-protected. Please enter the passcode to join.",
                    "require_passcode": True
                }, 403

            if provided_passcode != meeting.passcode:
                return {
                    "message": "Incorrect meeting password / passcode.",
                    "require_passcode": True
                }, 403

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
                    "status": meeting.status,
                    "passcode": meeting.passcode if is_host else None,
                    "meeting_type": meeting.meeting_type,
                    "external_link": meeting.external_link,
                    "is_host": is_host,
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
                "status": meeting.status,
                "passcode": meeting.passcode if is_host else None,
                "meeting_type": meeting.meeting_type,
                "external_link": meeting.external_link,
                "is_host": is_host,
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


# ======================================================================
# 3. GET MEETING DETAILS
# ======================================================================

@meeting_bp.route("/<int:meeting_id>", methods=["GET"])
@jwt_required()
def get_meeting(meeting_id):
    user_id = int(get_jwt_identity())
    db = SessionLocal()

    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()

        if not meeting:
            return {
                "message": "Meeting not found"
            }, 404

        is_host = meeting.user_id == user_id

        participants = db.query(Participant).filter(
            Participant.meeting_id == meeting_id
        ).all()

        participant_list = []
        for participant in participants:
            participant_list.append({
                "id": participant.id,
                "user_id": participant.user_id,
                "display_name": participant.display_name,
                "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
                "left_at": participant.left_at.isoformat() if participant.left_at else None
            })

        return {
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
                "description": meeting.description,
                "room_code": meeting.room_code,
                "passcode": meeting.passcode if is_host else None,
                "has_passcode": bool(meeting.passcode),
                "meeting_type": meeting.meeting_type,
                "external_link": meeting.external_link,
                "is_host": is_host,
                "status": meeting.status,
                "started_at": meeting.started_at.isoformat() if meeting.started_at else None,
                "ended_at": meeting.ended_at.isoformat() if meeting.ended_at else None,
                "created_at": meeting.created_at.isoformat()
            },
            "participants": participant_list
        }, 200

    finally:
        db.close()


# ======================================================================
# 4. CHECK MEETING BY ROOM CODE (PUBLIC / PRE-JOIN METADATA)
# ======================================================================

@meeting_bp.route("/check/<room_code>", methods=["GET"])
def check_meeting(room_code):
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()

        if not meeting:
            return {
                "exists": False,
                "message": "No meeting found with this room code"
            }, 404

        host_name = meeting.user.name if meeting.user else "Host"
        host_user_id = meeting.user_id

        return {
            "exists": True,
            "title": meeting.title,
            "room_code": meeting.room_code,
            "status": meeting.status,
            "requires_passcode": bool(meeting.passcode),
            "meeting_type": meeting.meeting_type,
            "external_link": meeting.external_link,
            "host_name": host_name,
            "host_user_id": host_user_id,
        }, 200

    finally:
        db.close()


# ======================================================================
# 5. MY MEETINGS (HOST LIST)
# ======================================================================

@meeting_bp.route("/my-meetings", methods=["GET"])
@jwt_required()
def get_my_meetings():
    user_id = int(get_jwt_identity())
    db = SessionLocal()

    try:
        deleted_ids = [
            row[0]
            for row in db.query(UserDeletedMeeting.meeting_id)
            .filter(UserDeletedMeeting.user_id == user_id)
            .all()
        ]

        query = db.query(Meeting).filter(Meeting.user_id == user_id)
        if deleted_ids:
            query = query.filter(Meeting.id.notin_(deleted_ids))

        meetings = (
            query.order_by(Meeting.created_at.desc())
            .limit(25)
            .all()
        )

        frontend_base = os.getenv("FRONTEND_URL", "https://localhost:5173").rstrip("/")

        result = []
        for m in meetings:
            join_url = f"{frontend_base}/meeting/{m.room_code}"
            if m.passcode:
                join_url = f"{join_url}?passcode={m.passcode}"

            result.append({
                "id": m.id,
                "title": m.title,
                "description": m.description,
                "room_code": m.room_code,
                "passcode": m.passcode,
                "meeting_type": m.meeting_type,
                "external_link": m.external_link,
                "status": m.status,
                "join_url": join_url,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })

        return {"meetings": result}, 200

    finally:
        db.close()


@meeting_bp.route("/<int:meeting_id>", methods=["DELETE"])
@jwt_required()
def delete_meeting_for_user(meeting_id):
    """
    Remove / delete meeting from the current user's account only.
    Does NOT delete the meeting from the database or affect any other participant/host.
    Preserves all email communications, transcripts, and intelligence reports.
    """
    user_id = int(get_jwt_identity())
    db = SessionLocal()

    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        existing = db.query(UserDeletedMeeting).filter(
            UserDeletedMeeting.user_id == user_id,
            UserDeletedMeeting.meeting_id == meeting_id
        ).first()

        if not existing:
            deleted_record = UserDeletedMeeting(
                user_id=user_id,
                meeting_id=meeting_id
            )
            db.add(deleted_record)
            db.commit()

        return {
            "message": "Meeting removed from your account successfully",
            "meeting_id": meeting_id
        }, 200

    except Exception as e:
        db.rollback()
        return {"message": "Failed to remove meeting from account", "error": str(e)}, 500

    finally:
        db.close()


# ======================================================================
# CHAT MESSAGES PERSISTENCE & HISTORY
# ======================================================================

@meeting_bp.route("/<room_code>/messages", methods=["GET"])
@jwt_required()
def get_meeting_messages(room_code):
    """Retrieve all persisted chat messages for a meeting room."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        messages = (
            db.query(MeetingMessage)
            .filter(MeetingMessage.meeting_id == meeting.id)
            .order_by(MeetingMessage.created_at.asc())
            .all()
        )

        return {
            "messages": [
                {
                    "id": m.id,
                    "sender_name": m.sender_name,
                    "message": m.message,
                    "user_id": m.user_id,
                    "created_at": m.created_at.isoformat() if m.created_at else None
                }
                for m in messages
            ]
        }, 200
    finally:
        db.close()


@meeting_bp.route("/joined-meetings", methods=["GET"])
@jwt_required()
def get_joined_meetings():
    """Retrieve all meetings this user attended as a participant (excluding ones they hosted)."""
    user_id = int(get_jwt_identity())
    db = SessionLocal()

    try:
        deleted_ids = [
            row[0]
            for row in db.query(UserDeletedMeeting.meeting_id)
            .filter(UserDeletedMeeting.user_id == user_id)
            .all()
        ]

        query = (
            db.query(Meeting)
            .join(Participant, Participant.meeting_id == Meeting.id)
            .filter(Participant.user_id == user_id, Meeting.user_id != user_id)
        )
        if deleted_ids:
            query = query.filter(Meeting.id.notin_(deleted_ids))

        joined_meetings = (
            query.order_by(Meeting.created_at.desc())
            .limit(50)
            .all()
        )

        frontend_base = os.getenv("FRONTEND_URL", "https://localhost:5173").rstrip("/")

        result = []
        for m in joined_meetings:
            host_user = db.query(User).filter(User.id == m.user_id).first()
            host_name = host_user.name if host_user else "Meeting Host"

            join_url = f"{frontend_base}/meeting/{m.room_code}"
            if m.passcode:
                join_url = f"{join_url}?passcode={m.passcode}"

            result.append({
                "id": m.id,
                "title": m.title,
                "description": m.description,
                "room_code": m.room_code,
                "passcode": m.passcode,
                "meeting_type": m.meeting_type,
                "external_link": m.external_link,
                "status": m.status,
                "host_name": host_name,
                "join_url": join_url,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })

        return {"meetings": result}, 200

    finally:
        db.close()


# ======================================================================
# 6. SEND MEETING INVITATIONS (HOST SENDS LINK, ID & PASSWORD)
# ======================================================================

@meeting_bp.route("/<int:meeting_id>/invite", methods=["POST"])
@jwt_required()
def invite_to_meeting(meeting_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    emails = parse_email_list(data.get("emails", []))
    custom_message = (data.get("custom_message") or "").strip()

    if not emails:
        return {
            "message": "At least one valid recipient email is required"
        }, 400

    db = SessionLocal()

    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()

        if not meeting:
            return {
                "message": "Meeting not found"
            }, 404

        host_user = db.query(User).filter(User.id == user_id).first()
        inviter_name = host_user.name if host_user else "Meeting Host"

        frontend_base = os.getenv("FRONTEND_URL", "https://localhost:5173").rstrip("/")
        join_url = f"{frontend_base}/meeting/{meeting.room_code}"
        if meeting.passcode:
            join_url = f"{join_url}?passcode={meeting.passcode}"

        sent_emails = []
        failed_emails = []

        for email in emails:
            res = send_meeting_invite_email(
                to_email=email,
                inviter_name=inviter_name,
                meeting_title=meeting.title,
                room_code=meeting.room_code,
                join_url=join_url,
                passcode=meeting.passcode,
                meeting_type=meeting.meeting_type,
                external_link=meeting.external_link,
                custom_message=custom_message or None
            )

            if res.get("success") or res.get("mock"):
                sent_emails.append({
                    "email": email,
                    "mock": res.get("mock", False)
                })
            else:
                failed_emails.append({
                    "email": email,
                    "error": res.get("message")
                })

        all_mock = all(s.get("mock") for s in sent_emails) if sent_emails else False

        msg = f"Meeting invitations sent to {len(sent_emails)} recipient(s)!"
        if all_mock and not is_smtp_configured():
            msg = f"Invitations processed for {len(sent_emails)} email(s). (NOTE: SMTP credentials not set in .env, so invitations were logged in backend terminal)."

        return {
            "message": msg,
            "sent_count": len(sent_emails),
            "failed_count": len(failed_emails),
            "sent": sent_emails,
            "failed": failed_emails,
            "mock_mode": all_mock,
        }, 200

    except Exception as e:
        return {
            "message": "Failed to send meeting invitations",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 7. SEND CUSTOM / GOOGLE MEET INVITATION DIRECTLY
# ======================================================================

@meeting_bp.route("/send-custom-invite", methods=["POST"])
@jwt_required()
def send_custom_invite():
    """Allows host to send meeting link, meeting ID, and password (e.g. for Google Meet or custom call)."""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    title = (data.get("title") or "Video Conference").strip()
    meeting_link = (data.get("meeting_link") or "").strip()
    meeting_id = (data.get("meeting_id") or "").strip()
    password = (data.get("password") or "").strip()
    custom_message = (data.get("custom_message") or "").strip()
    emails = parse_email_list(data.get("emails", []))

    if not meeting_link and not meeting_id:
        return {
            "message": "Please provide at least a Meeting Link or Meeting ID"
        }, 400

    if not emails:
        return {
            "message": "At least one valid recipient email is required"
        }, 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        inviter_name = user.name if user else "Host"

        is_google = "meet.google" in meeting_link or "google" in meeting_link.lower()
        meeting_type = "google_meet" if is_google else "custom"
        room_code = meeting_id or (meeting_link.split("/")[-1] if "/" in meeting_link else "MEETING")

        sent_emails = []
        failed_emails = []

        for email in emails:
            res = send_meeting_invite_email(
                to_email=email,
                inviter_name=inviter_name,
                meeting_title=title,
                room_code=room_code,
                join_url=meeting_link or f"https://meet.google.com/{room_code}",
                passcode=password or None,
                meeting_type=meeting_type,
                external_link=meeting_link if is_google else None,
                custom_message=custom_message or None
            )

            if res.get("success") or res.get("mock"):
                sent_emails.append({"email": email, "mock": res.get("mock", False)})
            else:
                failed_emails.append({"email": email, "error": res.get("message")})

        all_mock = all(s.get("mock") for s in sent_emails) if sent_emails else False

        return {
            "message": f"Invitation dispatched to {len(sent_emails)} recipient(s)!",
            "sent_count": len(sent_emails),
            "failed_count": len(failed_emails),
            "sent": sent_emails,
            "failed": failed_emails,
            "mock_mode": all_mock,
        }, 200

    finally:
        db.close()


# ======================================================================
# 8. GET & ADD TRANSCRIPTS FOR MEETING
# ======================================================================

@meeting_bp.route("/<room_code>/transcripts", methods=["GET"])
def get_transcripts(room_code):
    """Retrieve timestamped transcript segments for a meeting."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        transcripts = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .order_by(Transcript.created_at.asc(), Transcript.start_time.asc())
            .all()
        )

        result = []
        for t in transcripts:
            result.append({
                "id": t.id,
                "speaker_name": t.speaker_name or "Participant",
                "text": t.text,
                "start_time": t.start_time,
                "end_time": t.end_time,
                "timestamp_str": format_timestamp(t.start_time),
                "created_at": t.created_at.isoformat() if t.created_at else None
            })

        return {
            "meeting_id": meeting.id,
            "room_code": meeting.room_code,
            "title": meeting.title,
            "count": len(result),
            "transcripts": result
        }, 200

    finally:
        db.close()


@meeting_bp.route("/<room_code>/transcripts", methods=["POST"])
def add_transcript(room_code):
    """Store an individual transcript segment."""
    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    speaker_name = (data.get("speaker_name") or "Participant").strip()
    start_time = data.get("start_time")
    end_time = data.get("end_time")

    if not text:
        return {"message": "Transcript text is required"}, 400

    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        now = datetime.utcnow()
        if start_time is None and meeting.started_at:
            start_time = max(0.0, (now - meeting.started_at).total_seconds())

        transcript = Transcript(
            meeting_id=meeting.id,
            speaker_name=speaker_name,
            text=text,
            start_time=start_time,
            end_time=end_time or ((start_time or 0.0) + 4.0)
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)

        return {
            "message": "Transcript saved",
            "transcript": {
                "id": transcript.id,
                "speaker_name": transcript.speaker_name,
                "text": transcript.text,
                "start_time": transcript.start_time,
                "end_time": transcript.end_time,
                "timestamp_str": format_timestamp(transcript.start_time),
                "created_at": transcript.created_at.isoformat()
            }
        }, 201

    finally:
        db.close()


# ======================================================================
# 9. MEETING INTELLIGENCE (GENERATE & GET)
# ======================================================================

@meeting_bp.route("/<room_code>/intelligence/generate", methods=["POST"])
def generate_intelligence(room_code):
    """Generate or update AI meeting intelligence from actual transcripts."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        transcripts = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .order_by(Transcript.created_at.asc(), Transcript.start_time.asc())
            .all()
        )

        segments = [
            {
                "id": t.id,
                "speaker_name": t.speaker_name or "Participant",
                "text": t.text,
                "start_time": t.start_time,
                "end_time": t.end_time
            }
            for t in transcripts
        ]

        intelligence = generate_meeting_intelligence(segments, meeting.title)

        # 1. Update or create MeetingSummary
        existing_summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting.id).first()
        key_points_str = "\n".join(intelligence.get("key_discussion_points", []))

        if existing_summary:
            existing_summary.summary = intelligence.get("summary", "")
            existing_summary.key_points = key_points_str
        else:
            new_summary = MeetingSummary(
                meeting_id=meeting.id,
                summary=intelligence.get("summary", ""),
                key_points=key_points_str
            )
            db.add(new_summary)

        # 2. Sync Action Items
        db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).delete()
        for item in intelligence.get("action_items", []):
            action_record = ActionItem(
                meeting_id=meeting.id,
                task=item.get("task", ""),
                assignee=item.get("assignee"),
                deadline=item.get("deadline"),
                status="pending"
            )
            db.add(action_record)

        # 3. Sync Decisions
        db.query(Decision).filter(Decision.meeting_id == meeting.id).delete()
        for dec in intelligence.get("decisions", []):
            dec_record = Decision(
                meeting_id=meeting.id,
                decision=dec,
                made_at=datetime.utcnow()
            )
            db.add(dec_record)

        db.commit()

        return {
            "message": "AI meeting intelligence generated successfully",
            "meeting_id": meeting.id,
            "room_code": meeting.room_code,
            "intelligence": intelligence
        }, 200

    except Exception as e:
        db.rollback()
        return {"message": f"Intelligence generation failed: {str(e)}"}, 500

    finally:
        db.close()


@meeting_bp.route("/<room_code>/intelligence", methods=["GET"])
def get_intelligence(room_code):
    """Retrieve the current AI intelligence for a meeting."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        summary_record = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting.id).first()
        action_records = db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).all()
        decision_records = db.query(Decision).filter(Decision.meeting_id == meeting.id).all()

        transcripts = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .order_by(Transcript.created_at.asc(), Transcript.start_time.asc())
            .all()
        )

        # If summary has not been generated yet but transcripts exist, generate on the fly
        if not summary_record and transcripts:
            segments = [
                {
                    "id": t.id,
                    "speaker_name": t.speaker_name or "Participant",
                    "text": t.text,
                    "start_time": t.start_time,
                    "end_time": t.end_time
                }
                for t in transcripts
            ]
            intelligence = generate_meeting_intelligence(segments, meeting.title)
            return {
                "meeting_id": meeting.id,
                "room_code": meeting.room_code,
                "title": meeting.title,
                "intelligence": intelligence
            }, 200

        key_points = []
        if summary_record and summary_record.key_points:
            key_points = [p.strip() for p in summary_record.key_points.split("\n") if p.strip()]

        action_items = [
            {
                "id": a.id,
                "task": a.task,
                "assignee": a.assignee,
                "deadline": a.deadline,
                "status": a.status
            }
            for a in action_records
        ]

        decisions = [d.decision for d in decision_records]

        # Extract blockers and questions from transcripts if needed
        unresolved_questions = []
        blockers = []
        for t in transcripts:
            t_lower = t.text.lower()
            if "?" in t.text and t.text not in unresolved_questions:
                unresolved_questions.append(f"{t.speaker_name or 'Speaker'}: {t.text}")
            if any(b in t_lower for b in ["blocker", "blocked", "issue with", "risk", "delay"]) and t.text not in blockers:
                blockers.append(f"{t.speaker_name or 'Speaker'}: {t.text}")

        return {
            "meeting_id": meeting.id,
            "room_code": meeting.room_code,
            "title": meeting.title,
            "intelligence": {
                "summary": summary_record.summary if summary_record else "No summary available yet.",
                "detailed_notes": key_points,
                "key_discussion_points": key_points,
                "decisions": decisions if decisions else ["No explicit decisions recorded."],
                "action_items": action_items,
                "unresolved_questions": unresolved_questions[:8],
                "blockers": blockers[:6]
            }
        }, 200

    finally:
        db.close()


# ======================================================================
# 10. EXPORT MEETING NOTES & SUMMARIES
# ======================================================================

@meeting_bp.route("/<room_code>/export", methods=["GET"])
def export_meeting(room_code):
    """Export formatted meeting notes and intelligence as Markdown or JSON."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        summary_record = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting.id).first()
        action_records = db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).all()
        decision_records = db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
        transcripts = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .order_by(Transcript.created_at.asc(), Transcript.start_time.asc())
            .all()
        )

        date_str = meeting.created_at.strftime("%B %d, %Y")
        host_name = meeting.user.name if meeting.user else "Host"

        # Construct Markdown Export
        md_lines = [
            f"# Meeting Notes: {meeting.title}",
            f"**Room Code:** `{meeting.room_code}` | **Date:** {date_str} | **Host:** {host_name}",
            "",
            "## 1. Executive Summary",
            summary_record.summary if summary_record else "No summary generated.",
            "",
            "## 2. Key Discussion Points",
        ]

        if summary_record and summary_record.key_points:
            for pt in summary_record.key_points.split("\n"):
                if pt.strip():
                    md_lines.append(f"- {pt.strip()}")
        else:
            md_lines.append("- No key points recorded.")

        md_lines.extend(["", "## 3. Decisions Reached"])
        if decision_records:
            for d in decision_records:
                md_lines.append(f"- **[Decided]** {d.decision}")
        else:
            md_lines.append("- No formal decisions recorded.")

        md_lines.extend(["", "## 4. Action Items & Next Steps"])
        if action_records:
            for a in action_records:
                assignee_str = f" (Owner: {a.assignee})" if a.assignee else ""
                deadline_str = f" [Deadline: {a.deadline}]" if a.deadline else ""
                md_lines.append(f"- [ ] **{a.task}**{assignee_str}{deadline_str}")
        else:
            md_lines.append("- No action items recorded.")

        md_lines.extend(["", "## 5. Full Timestamped Transcript"])
        if transcripts:
            for t in transcripts:
                ts = format_timestamp(t.start_time)
                md_lines.append(f"**[{ts}] {t.speaker_name or 'Participant'}:** {t.text}")
        else:
            md_lines.append("_No transcript segments recorded._")

        export_markdown = "\n".join(md_lines)

        return {
            "title": meeting.title,
            "room_code": meeting.room_code,
            "markdown": export_markdown,
            "filename": f"Meeting_{meeting.room_code}_Notes.md"
        }, 200

    finally:
        db.close()


# ======================================================================
# 11. GLOBAL SEARCH ACROSS PREVIOUS MEETINGS & TRANSCRIPTS
# ======================================================================

@meeting_bp.route("/search", methods=["GET"])
@jwt_required()
def search_meetings():
    """Search across previous meetings, transcripts, summaries, and action items."""
    query = (request.args.get("q") or "").strip()
    if not query:
        return {"query": "", "results": []}, 200

    user_id = int(get_jwt_identity())
    db = SessionLocal()
    search_term = f"%{query}%"

    try:
        deleted_ids = [
            row[0]
            for row in db.query(UserDeletedMeeting.meeting_id)
            .filter(UserDeletedMeeting.user_id == user_id)
            .all()
        ]

        # 1. Search in Meeting title & description
        query_m = db.query(Meeting).filter(
            Meeting.user_id == user_id,
            or_(
                Meeting.title.ilike(search_term),
                Meeting.room_code.ilike(search_term),
                Meeting.description.ilike(search_term)
            )
        )
        if deleted_ids:
            query_m = query_m.filter(Meeting.id.notin_(deleted_ids))
        matching_meetings = query_m.all()

        # 2. Search in Transcripts of user's meetings
        query_t = db.query(Transcript, Meeting).join(Meeting, Transcript.meeting_id == Meeting.id).filter(
            Meeting.user_id == user_id,
            or_(
                Transcript.text.ilike(search_term),
                Transcript.speaker_name.ilike(search_term)
            )
        )
        if deleted_ids:
            query_t = query_t.filter(Meeting.id.notin_(deleted_ids))
        matching_transcripts = query_t.limit(20).all()

        # 3. Search in Summaries
        query_s = db.query(MeetingSummary, Meeting).join(Meeting, MeetingSummary.meeting_id == Meeting.id).filter(
            Meeting.user_id == user_id,
            or_(
                MeetingSummary.summary.ilike(search_term),
                MeetingSummary.key_points.ilike(search_term)
            )
        )
        if deleted_ids:
            query_s = query_s.filter(Meeting.id.notin_(deleted_ids))
        matching_summaries = query_s.limit(10).all()

        # 4. Search in Action Items
        query_a = db.query(ActionItem, Meeting).join(Meeting, ActionItem.meeting_id == Meeting.id).filter(
            Meeting.user_id == user_id,
            or_(
                ActionItem.task.ilike(search_term),
                ActionItem.assignee.ilike(search_term)
            )
        )
        if deleted_ids:
            query_a = query_a.filter(Meeting.id.notin_(deleted_ids))
        matching_actions = query_a.limit(10).all()

        results = []
        seen_meetings = set()

        for m in matching_meetings:
            seen_meetings.add(m.id)
            results.append({
                "type": "meeting",
                "meeting_id": m.id,
                "room_code": m.room_code,
                "title": m.title,
                "snippet": m.description or f"Meeting ID: {m.room_code}",
                "date": m.created_at.strftime("%b %d, %Y") if m.created_at else None
            })

        for t, m in matching_transcripts:
            results.append({
                "type": "transcript",
                "meeting_id": m.id,
                "room_code": m.room_code,
                "title": m.title,
                "speaker": t.speaker_name,
                "timestamp_str": format_timestamp(t.start_time),
                "snippet": t.text,
                "date": m.created_at.strftime("%b %d, %Y") if m.created_at else None
            })

        for s, m in matching_summaries:
            results.append({
                "type": "summary",
                "meeting_id": m.id,
                "room_code": m.room_code,
                "title": m.title,
                "snippet": s.summary[:200] + "...",
                "date": m.created_at.strftime("%b %d, %Y") if m.created_at else None
            })

        for a, m in matching_actions:
            results.append({
                "type": "action_item",
                "meeting_id": m.id,
                "room_code": m.room_code,
                "title": m.title,
                "snippet": f"Task: {a.task} (Owner: {a.assignee or 'None'}, Deadline: {a.deadline or 'None'})",
                "date": m.created_at.strftime("%b %d, %Y") if m.created_at else None
            })

        return {
            "query": query,
            "total_matches": len(results),
            "results": results
        }, 200

    finally:
        db.close()


# ======================================================================
# 12. END MEETING ROOM
# ======================================================================

@meeting_bp.route("/<room_code>/end", methods=["POST"])
def end_meeting(room_code):
    """Mark meeting as ended, record end time and duration."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        now = datetime.utcnow()
        meeting.status = "ended"
        meeting.ended_at = now

        if meeting.started_at:
            duration = int((now - meeting.started_at).total_seconds())
            meeting.duration = duration

        # Mark all active participants as left
        db.query(Participant).filter(
            Participant.meeting_id == meeting.id,
            Participant.left_at.is_(None)
        ).update({"left_at": now})

        db.commit()

        # Auto-generate intelligence and dispatch summary + PDF emails to host & participants
        try:
            transcripts_for_intel = (
                db.query(Transcript)
                .filter(Transcript.meeting_id == meeting.id)
                .order_by(Transcript.created_at.asc())
                .all()
            )
            segments = [
                {
                    "id": t.id,
                    "speaker_name": t.speaker_name or "Participant",
                    "text": t.text,
                    "start_time": t.start_time,
                    "end_time": t.end_time,
                }
                for t in transcripts_for_intel
            ]

            if segments:
                intel = generate_meeting_intelligence(segments, meeting.title)
            else:
                intel = {
                    "summary": f"The meeting '{meeting.title}' concluded successfully. No live spoken audio transcripts were recorded during this session.",
                    "key_discussion_points": [
                        "Session held via AI Meeting Intelligence.",
                        f"Meeting room: {meeting.room_code}",
                        f"Duration: {meeting.duration or 0} seconds."
                    ],
                    "decisions": [],
                    "action_items": []
                }

            key_points_str = "\n".join(intel.get("key_discussion_points", []))
            existing_summary = db.query(MeetingSummary).filter(
                MeetingSummary.meeting_id == meeting.id
            ).first()
            if existing_summary:
                existing_summary.summary = intel.get("summary", "")
                existing_summary.key_points = key_points_str
            else:
                db.add(MeetingSummary(
                    meeting_id=meeting.id,
                    summary=intel.get("summary", ""),
                    key_points=key_points_str,
                ))

            db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).delete()
            for item in intel.get("action_items", []):
                db.add(ActionItem(
                    meeting_id=meeting.id,
                    task=item.get("task", ""),
                    assignee=item.get("assignee"),
                    deadline=item.get("deadline"),
                    status="pending",
                ))

            db.query(Decision).filter(Decision.meeting_id == meeting.id).delete()
            for dec in intel.get("decisions", []):
                db.add(Decision(
                    meeting_id=meeting.id,
                    decision=dec,
                    made_at=datetime.utcnow(),
                ))

            db.commit()
            print(f"[END MEETING] Auto-generated intelligence for {clean_code} (segments: {len(segments)})")

            # Automatically email summary & PDF to host and all participants
            try:
                participant_records = db.query(Participant).filter(Participant.meeting_id == meeting.id).all()
                recipients = set()
                
                # Add host email
                if meeting.user and meeting.user.email:
                    recipients.add(meeting.user.email)
                elif meeting.user_id:
                    h = db.query(User).filter(User.id == meeting.user_id).first()
                    if h and h.email:
                        recipients.add(h.email)
                
                # Add all joined users' emails
                for p in participant_records:
                    if p.user and p.user.email:
                        recipients.add(p.user.email)
                    elif p.user_id:
                        u = db.query(User).filter(User.id == p.user_id).first()
                        if u and u.email:
                            recipients.add(u.email)

                # Also check active socket participants memory in case any left just before end
                try:
                    from backend.app.main import room_participants
                    room_live = room_participants.get(clean_code, {})
                    for p_info in room_live.values():
                        uid = p_info.get("user_id")
                        if uid:
                            u = db.query(User).filter(User.id == uid).first()
                            if u and u.email:
                                recipients.add(u.email)
                except Exception as mem_err:
                    print(f"[END MEETING] Note: Could not inspect room_participants: {mem_err}")

                if recipients:
                    print(f"[END MEETING] Auto-sending summary to participants: {recipients}")
                    
                    host_name = meeting.user.name if meeting.user else "Host"
                    date_str = meeting.created_at.strftime("%B %d, %Y") if meeting.created_at else "N/A"
                    participant_names = list({p.display_name for p in participant_records if p.display_name})
                    if not participant_names and meeting.user:
                        participant_names = [meeting.user.name]
                    
                    kp = intel.get("key_discussion_points", [])
                    dec_list = intel.get("decisions", [])
                    actions = [
                        {"task": a.get("task", ""), "assignee": a.get("assignee"), "deadline": a.get("deadline")}
                        for a in intel.get("action_items", [])
                    ]
                    
                    trans_list = [
                        {
                            "speaker_name": t.speaker_name or "Participant",
                            "text": t.text,
                            "timestamp_str": format_timestamp(t.start_time),
                        }
                        for t in transcripts_for_intel
                    ]
                    
                    pdf_bytes = None
                    try:
                        pdf_bytes = generate_meeting_pdf(
                            title=meeting.title,
                            room_code=meeting.room_code,
                            host_name=host_name,
                            date_str=date_str,
                            duration_seconds=meeting.duration,
                            participants=participant_names,
                            summary=intel.get("summary", ""),
                            key_points=kp,
                            decisions=dec_list,
                            action_items=actions,
                            transcripts=trans_list,
                        )
                    except Exception as pe:
                        print(f"[END MEETING] PDF gen for auto-email failed: {pe}")

                    pdf_fn = f"Meeting_{meeting.room_code}_Summary.pdf" if pdf_bytes else None

                    for recipient in recipients:
                        try:
                            send_meeting_summary_email(
                                to_email=recipient,
                                recipient_name=recipient,
                                meeting_title=meeting.title,
                                room_code=meeting.room_code,
                                date_str=date_str,
                                summary=intel.get("summary", ""),
                                decisions=dec_list,
                                action_items=actions,
                                pdf_bytes=pdf_bytes,
                                pdf_filename=pdf_fn,
                            )
                        except Exception as send_err:
                            print(f"[END MEETING] Failed to send email to {recipient}: {send_err}")

                    print(f"[END MEETING] Successfully processed email dispatch for {len(recipients)} recipient(s).")
                else:
                    print(f"[END MEETING] Warning: No recipient emails found for meeting {clean_code}")
            except Exception as email_err:
                print(f"[END MEETING] Auto-email dispatch error (non-fatal): {email_err}")
        except Exception as intel_err:
            print(f"[END MEETING] Intelligence generation error (non-fatal): {intel_err}")

        return {
            "message": "Meeting ended successfully",
            "room_code": meeting.room_code,
            "duration_seconds": meeting.duration,
            "status": meeting.status
        }, 200

    finally:
        db.close()


# ======================================================================
# GET FULL POST-MEETING RESULTS (summary screen)
# ======================================================================

@meeting_bp.route("/<room_code>/results", methods=["GET"])
def get_meeting_results(room_code):
    """Return the full post-meeting data for the results/summary screen."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        summary_record = db.query(MeetingSummary).filter(
            MeetingSummary.meeting_id == meeting.id
        ).first()
        action_records = db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).all()
        decision_records = db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
        participant_records = db.query(Participant).filter(
            Participant.meeting_id == meeting.id
        ).all()
        transcripts = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .order_by(Transcript.created_at.asc(), Transcript.start_time.asc())
            .all()
        )

        host_name = meeting.user.name if meeting.user else "Host"
        key_points = []
        if summary_record and summary_record.key_points:
            key_points = [p.strip() for p in summary_record.key_points.split("\n") if p.strip()]

        return {
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
                "room_code": meeting.room_code,
                "status": meeting.status,
                "host_name": host_name,
                "started_at": meeting.started_at.isoformat() if meeting.started_at else None,
                "ended_at": meeting.ended_at.isoformat() if meeting.ended_at else None,
                "duration_seconds": meeting.duration,
                "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
            },
            "participants": [
                {"id": p.id, "display_name": p.display_name}
                for p in participant_records
            ],
            "summary": summary_record.summary if summary_record else None,
            "key_points": key_points,
            "decisions": [d.decision for d in decision_records],
            "action_items": [
                {
                    "id": a.id,
                    "task": a.task,
                    "assignee": a.assignee,
                    "deadline": a.deadline,
                    "status": a.status,
                }
                for a in action_records
            ],
            "transcripts": [
                {
                    "id": t.id,
                    "speaker_name": t.speaker_name or "Participant",
                    "text": t.text,
                    "start_time": t.start_time,
                    "timestamp_str": format_timestamp(t.start_time),
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in transcripts
            ],
            "transcript_count": len(transcripts),
            "smtp_configured": is_smtp_configured(),
        }, 200

    finally:
        db.close()


# ======================================================================
# 13. EXPORT MEETING AS PDF (download)
# ======================================================================

@meeting_bp.route("/<room_code>/export/pdf", methods=["GET"])
def export_pdf(room_code):
    """Generate and stream a PDF of the meeting notes."""
    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        summary_record = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting.id).first()
        action_records = db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).all()
        decision_records = db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
        transcripts = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .order_by(Transcript.created_at.asc(), Transcript.start_time.asc())
            .all()
        )
        participant_records = db.query(Participant).filter(Participant.meeting_id == meeting.id).all()

        host_name = meeting.user.name if meeting.user else "Host"
        date_str = meeting.created_at.strftime("%B %d, %Y") if meeting.created_at else "N/A"
        participant_names = list({p.display_name for p in participant_records})

        key_points = []
        if summary_record and summary_record.key_points:
            key_points = [p.strip() for p in summary_record.key_points.split("\n") if p.strip()]

        action_items = [
            {
                "task": a.task,
                "assignee": a.assignee,
                "deadline": a.deadline,
            }
            for a in action_records
        ]

        transcript_list = [
            {
                "speaker_name": t.speaker_name or "Participant",
                "text": t.text,
                "timestamp_str": format_timestamp(t.start_time),
            }
            for t in transcripts
        ]

        pdf_bytes = generate_meeting_pdf(
            title=meeting.title,
            room_code=meeting.room_code,
            host_name=host_name,
            date_str=date_str,
            duration_seconds=meeting.duration,
            participants=participant_names,
            summary=summary_record.summary if summary_record else "No summary generated.",
            key_points=key_points,
            decisions=[d.decision for d in decision_records],
            action_items=action_items,
            transcripts=transcript_list,
        )

        filename = f"Meeting_{meeting.room_code}_Notes.pdf"

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        return {"message": f"PDF generation failed: {str(e)}"}, 500

    finally:
        db.close()


# ======================================================================
# 14. EMAIL MEETING SUMMARY (with optional PDF attachment)
# ======================================================================

@meeting_bp.route("/<room_code>/email-summary", methods=["POST"])
@jwt_required()
def email_summary(room_code):
    """
    Generate (or re-generate) meeting intelligence and email the summary PDF
    to the host and/or specified additional recipients.

    POST body (JSON, all optional):
      emails         – list of extra recipient emails
      include_pdf    – boolean, default true
      regenerate     – boolean, force re-generate intelligence before sending
    """
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    extra_emails = parse_email_list(data.get("emails", []))
    include_pdf = bool(data.get("include_pdf", True))
    regenerate = bool(data.get("regenerate", False))

    db = SessionLocal()
    try:
        clean_code = room_code.strip().upper()
        meeting = db.query(Meeting).filter(Meeting.room_code == clean_code).first()
        if not meeting:
            return {"message": "Meeting not found"}, 404

        host_user = db.query(User).filter(User.id == meeting.user_id).first()
        current_user = db.query(User).filter(User.id == user_id).first()

        # Collect recipients: host email + extra emails
        recipients = set(extra_emails)
        if host_user and host_user.email:
            recipients.add(host_user.email)
        if current_user and current_user.email:
            recipients.add(current_user.email)

        if not recipients:
            return {"message": "No recipient email addresses available."}, 400

        # Load / generate intelligence
        transcripts = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .order_by(Transcript.created_at.asc(), Transcript.start_time.asc())
            .all()
        )

        summary_record = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting.id).first()
        action_records = db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).all()
        decision_records = db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
        participant_records = db.query(Participant).filter(Participant.meeting_id == meeting.id).all()

        if regenerate or not summary_record:
            segments = [
                {
                    "id": t.id,
                    "speaker_name": t.speaker_name or "Participant",
                    "text": t.text,
                    "start_time": t.start_time,
                    "end_time": t.end_time,
                }
                for t in transcripts
            ]
            intelligence = generate_meeting_intelligence(segments, meeting.title)

            # Persist updated intelligence
            key_points_str = "\n".join(intelligence.get("key_discussion_points", []))
            if summary_record:
                summary_record.summary = intelligence.get("summary", "")
                summary_record.key_points = key_points_str
            else:
                summary_record = MeetingSummary(
                    meeting_id=meeting.id,
                    summary=intelligence.get("summary", ""),
                    key_points=key_points_str,
                )
                db.add(summary_record)

            db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).delete()
            for item in intelligence.get("action_items", []):
                db.add(ActionItem(
                    meeting_id=meeting.id,
                    task=item.get("task", ""),
                    assignee=item.get("assignee"),
                    deadline=item.get("deadline"),
                    status="pending",
                ))

            db.query(Decision).filter(Decision.meeting_id == meeting.id).delete()
            for dec in intelligence.get("decisions", []):
                db.add(Decision(
                    meeting_id=meeting.id,
                    decision=dec,
                    made_at=datetime.utcnow(),
                ))

            db.commit()
            db.refresh(summary_record)
            action_records = db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).all()
            decision_records = db.query(Decision).filter(Decision.meeting_id == meeting.id).all()

        # Build PDF if requested
        pdf_bytes = None
        pdf_filename = None
        if include_pdf:
            host_name = host_user.name if host_user else "Host"
            date_str = meeting.created_at.strftime("%B %d, %Y") if meeting.created_at else "N/A"
            participant_names = list({p.display_name for p in participant_records})
            key_points = []
            if summary_record and summary_record.key_points:
                key_points = [p.strip() for p in summary_record.key_points.split("\n") if p.strip()]

            transcript_list = [
                {
                    "speaker_name": t.speaker_name or "Participant",
                    "text": t.text,
                    "timestamp_str": format_timestamp(t.start_time),
                }
                for t in transcripts
            ]

            try:
                pdf_bytes = generate_meeting_pdf(
                    title=meeting.title,
                    room_code=meeting.room_code,
                    host_name=host_name,
                    date_str=date_str,
                    duration_seconds=meeting.duration,
                    participants=participant_names,
                    summary=summary_record.summary if summary_record else "No summary.",
                    key_points=key_points,
                    decisions=[d.decision for d in decision_records],
                    action_items=[
                        {"task": a.task, "assignee": a.assignee, "deadline": a.deadline}
                        for a in action_records
                    ],
                    transcripts=transcript_list,
                )
                pdf_filename = f"Meeting_{meeting.room_code}_Notes.pdf"
            except Exception as pdf_err:
                print(f"[EMAIL SUMMARY] PDF generation error: {pdf_err}")
                pdf_bytes = None

        # Send emails
        sent = []
        failed = []
        date_str_plain = meeting.created_at.strftime("%B %d, %Y") if meeting.created_at else "N/A"

        for email in recipients:
            result = send_meeting_summary_email(
                to_email=email,
                recipient_name=email,
                meeting_title=meeting.title,
                room_code=meeting.room_code,
                date_str=date_str_plain,
                summary=summary_record.summary if summary_record else "No summary.",
                decisions=[d.decision for d in decision_records],
                action_items=[
                    {"task": a.task, "assignee": a.assignee, "deadline": a.deadline}
                    for a in action_records
                ],
                pdf_bytes=pdf_bytes,
                pdf_filename=pdf_filename,
            )

            if result.get("success") or result.get("mock"):
                sent.append({"email": email, "mock": result.get("mock", False)})
            else:
                failed.append({"email": email, "error": result.get("message")})

        smtp_ok = is_smtp_configured()
        all_mock = all(s.get("mock") for s in sent) if sent else False
        msg = f"Summary sent to {len(sent)} recipient(s)."
        if all_mock and not smtp_ok:
            msg = (
                f"Summary processed for {len(sent)} recipient(s). "
                "Note: SMTP credentials not configured — email logged to backend terminal only."
            )

        return {
            "message": msg,
            "sent_count": len(sent),
            "failed_count": len(failed),
            "sent": sent,
            "failed": failed,
            "mock_mode": all_mock,
            "smtp_configured": smtp_ok,
            "pdf_attached": bool(pdf_bytes),
        }, 200

    except Exception as e:
        db.rollback()
        return {"message": f"Email summary failed: {str(e)}"}, 500

    finally:
        db.close()