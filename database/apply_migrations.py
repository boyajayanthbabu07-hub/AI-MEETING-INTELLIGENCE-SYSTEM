import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from backend.app.database import Base, engine
# Import all models to ensure they are registered with Base.metadata
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


def safe_add_column(connection, table_name, column_name, column_type_sql):
    inspector = inspect(connection)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    if column_name not in columns:
        print(f"  Adding column '{column_name}' to table '{table_name}'...")
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type_sql}"))
        print(f"  [OK] Column '{column_name}' added successfully.")
    else:
        print(f"  Column '{column_name}' already exists in '{table_name}'.")


def run_migrations():
    print("==================================================")
    print("STARTING DATABASE SCHEMA EVOLUTION")
    print("==================================================")

    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = inspector.get_table_names()
        print(f"Initial tables found ({len(existing_tables)}):", existing_tables)

        # 1. Safely alter 'users' table if it exists
        if "users" in existing_tables:
            print("\nUpdating 'users' table schema...")
            safe_add_column(connection, "users", "is_verified", "BOOLEAN NOT NULL DEFAULT FALSE")
            safe_add_column(connection, "users", "avatar_url", "VARCHAR(255) NULL")
            safe_add_column(connection, "users", "updated_at", "DATETIME NULL")
            
            # Ensure existing users are marked as verified so they are not locked out
            connection.execute(text("UPDATE users SET is_verified = 1 WHERE is_verified = 0 OR is_verified IS NULL"))
            print("  [OK] Existing users marked as is_verified=1.")

        # 2. Safely alter 'meetings' table if it exists
        if "meetings" in existing_tables:
            print("\nUpdating 'meetings' table schema...")
            safe_add_column(connection, "meetings", "duration", "INTEGER NULL")
            safe_add_column(connection, "meetings", "description", "TEXT NULL")

        # 3. Safely alter 'action_items' table if it exists
        if "action_items" in existing_tables:
            print("\nUpdating 'action_items' table schema...")
            safe_add_column(connection, "action_items", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
            safe_add_column(connection, "action_items", "updated_at", "DATETIME NULL")

        # 4. Safely alter 'meeting_summaries' table if it exists
        if "meeting_summaries" in existing_tables:
            print("\nUpdating 'meeting_summaries' table schema...")
            safe_add_column(connection, "meeting_summaries", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")

    # 5. Create any new tables defined in models
    print("\nCreating new tables with SQLAlchemy metadata...")
    Base.metadata.create_all(bind=engine)
    print("  [OK] All tables created/verified.")

    # 6. Verify final database state and record counts
    with engine.connect() as connection:
        inspector = inspect(connection)
        final_tables = sorted(inspector.get_table_names())
        print("\n==================================================")
        print(f"DATABASE MIGRATION COMPLETE: {len(final_tables)} TABLES")
        print("==================================================")
        for table in final_tables:
            count = connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"  - {table:<25} : {count} rows")

    print("\nDatabase architecture successfully updated without data loss.\n")


if __name__ == "__main__":
    run_migrations()
