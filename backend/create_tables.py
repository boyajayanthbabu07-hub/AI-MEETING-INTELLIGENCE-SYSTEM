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

from sqlalchemy import text

Base.metadata.create_all(bind=engine)

# Ensure new columns on meetings table exist idempotently
with engine.connect() as conn:
    cols = [c[0] for c in conn.execute(text("DESCRIBE meetings")).fetchall()]
    if "passcode" not in cols:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN passcode VARCHAR(50) NULL"))
    if "meeting_type" not in cols:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN meeting_type VARCHAR(50) DEFAULT 'internal' NOT NULL"))
    if "external_link" not in cols:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN external_link VARCHAR(500) NULL"))
    conn.commit()

print("All database tables and columns created / verified successfully.")