import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import Base, engine
from backend.models.models import (
    User,
    EmailVerificationOTP,
    PasswordResetOTP,
    Meeting,
    Participant,
    MeetingMessage,
    Transcript,
    ActionItem,
    MeetingSummary,
    Decision,
    MeetingFile,
    EmbeddingsMetadata,
    MeetingSettings,
)

Base.metadata.create_all(bind=engine)
print("All database tables created / verified successfully.")