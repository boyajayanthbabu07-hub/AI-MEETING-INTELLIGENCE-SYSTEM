import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import Base, engine
from backend.models.models import User, Meeting, Transcript, ActionItem

Base.metadata.create_all(bind=engine)

print("Database tables created successfully")