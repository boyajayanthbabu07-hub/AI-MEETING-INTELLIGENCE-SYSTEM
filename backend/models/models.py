from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        nullable=False
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    meetings = relationship(
        "Meeting",
        back_populates="user"
    )

    participants = relationship(
        "Participant",
        back_populates="user"
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    room_code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="waiting"
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    user = relationship(
        "User",
        back_populates="meetings"
    )

    participants = relationship(
        "Participant",
        back_populates="meeting",
        cascade="all, delete-orphan"
    )

    transcript_segments = relationship(
        "Transcript",
        back_populates="meeting",
        cascade="all, delete-orphan"
    )

    action_items = relationship(
        "ActionItem",
        back_populates="meeting",
        cascade="all, delete-orphan"
    )

    summary = relationship(
        "MeetingSummary",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan"
    )

    decisions = relationship(
        "Decision",
        back_populates="meeting",
        cascade="all, delete-orphan"
    )


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id"),
        nullable=False
    )

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )

    display_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    left_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    meeting = relationship(
        "Meeting",
        back_populates="participants"
    )

    user = relationship(
        "User",
        back_populates="participants"
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id"),
        nullable=False
    )

    speaker_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    text: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    start_time: Mapped[float | None] = mapped_column(
        nullable=True
    )

    end_time: Mapped[float | None] = mapped_column(
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    meeting = relationship(
        "Meeting",
        back_populates="transcript_segments"
    )


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id"),
        nullable=False
    )

    task: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    assignee: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    deadline: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="pending"
    )

    meeting = relationship(
        "Meeting",
        back_populates="action_items"
    )


class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id"),
        nullable=False,
        unique=True
    )

    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    key_points: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    meeting = relationship(
        "Meeting",
        back_populates="summary"
    )


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id"),
        nullable=False
    )

    decision: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    made_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    meeting = relationship(
        "Meeting",
        back_populates="decisions"
    )