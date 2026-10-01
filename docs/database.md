# Database Architecture & Schema Documentation

The **AI Meeting Intelligence System** uses **MySQL 8.0** with SQLAlchemy 2.0 ORM. All tables, foreign key constraints, indexes, and cascades are documented below.

---

## Entity Relationship Summary

```
                      +-------------------+
                      |       User        |
                      +---------+---------+
                                | 1:N
        +-----------------------+-----------------------+
        |                       |                       |
+-------v-------+       +-------v-------+       +-------v-------+
|  MeetingFile  |       |    Meeting    |       |  Participant  |
+---------------+       +-------+-------+       +---------------+
                                | 1:N
        +-----------------------+-----------------------+-----------------------+
        |                       |                       |                       |
+-------v-------+       +-------v-------+       +-------v-------+       +-------v-------+
|  Transcript   |       |  ActionItem   |       |  Decision     |       |MeetingSummary |
+-------+-------+       +---------------+       +---------------+       +---------------+
        | 1:N
+-------v---------------+
| EmbeddingsMetadata    |
+-----------------------+
```

---

## Complete Table Specifications

### 1. `users`
Represents registered users in the system.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique user ID |
| `name` | VARCHAR(100) | No | User's full display name |
| `email` | VARCHAR(150) | No | Unique email address (indexed) |
| `password_hash` | VARCHAR(255) | No | Werkzeug secure password hash |
| `is_verified` | BOOLEAN | No | Email verification status (default FALSE) |
| `avatar_url` | VARCHAR(255) | Yes | Optional avatar image path |
| `created_at` | DATETIME | No | Account registration timestamp |
| `updated_at` | DATETIME | Yes | Timestamp of last profile update |

---

### 2. `email_verification_otps`
Stores cryptographically secure 6-digit OTPs for email verification.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique OTP record ID |
| `user_id` | INT (FK -> users.id) | Yes | Optional associated user ID |
| `email` | VARCHAR(150) | No | Recipient email address (indexed) |
| `otp_hash` | VARCHAR(255) | No | Secure hash of the 6-digit OTP |
| `expires_at` | DATETIME | No | OTP expiration timestamp (typically 10-15 mins) |
| `is_used` | BOOLEAN | No | Flag indicating if OTP was consumed |
| `attempts` | INT | No | Verification attempt counter (rate limiting) |
| `created_at` | DATETIME | No | OTP issuance timestamp |

---

### 3. `password_reset_otps`
Stores cryptographically secure 6-digit OTPs for password recovery.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique reset record ID |
| `user_id` | INT (FK -> users.id) | No | User requesting password reset |
| `email` | VARCHAR(150) | No | Recipient email address (indexed) |
| `otp_hash` | VARCHAR(255) | No | Secure hash of the 6-digit OTP |
| `expires_at` | DATETIME | No | Reset OTP expiration timestamp |
| `is_used` | BOOLEAN | No | Flag indicating if reset OTP was used |
| `attempts` | INT | No | Verification attempt counter |
| `created_at` | DATETIME | No | Creation timestamp |

---

### 4. `meetings`
Represents scheduled, ongoing, or past video conference sessions.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique meeting ID |
| `user_id` | INT (FK -> users.id) | No | Meeting creator / host (indexed) |
| `title` | VARCHAR(255) | No | Title / agenda of the meeting |
| `description` | TEXT | Yes | Detailed meeting description |
| `room_code` | VARCHAR(100) | No | Unique 8-character meeting room code (indexed) |
| `status` | VARCHAR(50) | No | Status (`waiting`, `active`, `ended`) |
| `duration` | INT | Yes | Total meeting duration in seconds |
| `started_at` | DATETIME | Yes | Timestamp when first participant joined |
| `ended_at` | DATETIME | Yes | Timestamp when host ended the meeting |
| `created_at` | DATETIME | No | Meeting creation timestamp |

---

### 5. `participants`
Tracks users and guests who joined a meeting room.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique participant record ID |
| `meeting_id` | INT (FK -> meetings.id) | No | Associated meeting (indexed) |
| `user_id` | INT (FK -> users.id) | Yes | Authenticated user ID (null for guests) |
| `display_name` | VARCHAR(150) | No | In-meeting display name |
| `joined_at` | DATETIME | No | Participant join timestamp |
| `left_at` | DATETIME | Yes | Participant exit timestamp |

---

### 6. `meeting_messages`
Stores persistent in-meeting chat messages exchanged via Socket.IO.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique message ID |
| `meeting_id` | INT (FK -> meetings.id) | No | Meeting ID (indexed) |
| `user_id` | INT (FK -> users.id) | Yes | Sender user ID (null for guest) |
| `sender_name` | VARCHAR(150) | No | Display name of sender |
| `message` | TEXT | No | Message content |
| `created_at` | DATETIME | No | Message timestamp |

---

### 7. `transcripts`
Stores timestamped speech segments transcribed by OpenAI Whisper.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique transcript segment ID |
| `meeting_id` | INT (FK -> meetings.id) | No | Meeting ID (indexed) |
| `speaker_name` | VARCHAR(150) | Yes | Attributed speaker name |
| `text` | TEXT | No | Transcribed spoken text |
| `start_time` | DOUBLE | Yes | Start timestamp in seconds from meeting start |
| `end_time` | DOUBLE | Yes | End timestamp in seconds from meeting start |
| `created_at` | DATETIME | No | Creation timestamp |

---

### 8. `action_items`
Stores action items extracted by LLM from meeting transcripts.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique action item ID |
| `meeting_id` | INT (FK -> meetings.id) | No | Associated meeting (indexed) |
| `task` | TEXT | No | Action task description |
| `assignee` | VARCHAR(150) | Yes | Designated responsible person |
| `deadline` | VARCHAR(100) | Yes | Due date or timeframe |
| `status` | VARCHAR(50) | No | `pending`, `in_progress`, `completed` |
| `created_at` | DATETIME | No | Extraction timestamp |
| `updated_at` | DATETIME | Yes | Status update timestamp |

---

### 9. `meeting_summaries`
Stores structured executive summaries generated by AI.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique summary ID |
| `meeting_id` | INT (FK -> meetings.id) | No | Meeting ID (Unique, 1-to-1 relationship) |
| `summary` | TEXT | No | Comprehensive meeting summary |
| `key_points` | TEXT | Yes | Bulleted key discussion takeaways |
| `created_at` | DATETIME | No | Generation timestamp |

---

### 10. `decisions`
Stores key decisions made during the meeting extracted by AI.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique decision ID |
| `meeting_id` | INT (FK -> meetings.id) | No | Associated meeting (indexed) |
| `decision` | TEXT | No | Agreed decision text |
| `made_at` | DATETIME | No | Decision creation timestamp |

---

### 11. `meeting_files`
Stores uploaded pre-recorded audio/video meeting files.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique file ID |
| `meeting_id` | INT (FK -> meetings.id) | Yes | Optional linked meeting |
| `user_id` | INT (FK -> users.id) | No | Uploader ID (indexed) |
| `filename` | VARCHAR(255) | No | Stored unique filename on disk |
| `original_filename` | VARCHAR(255) | No | Original filename provided by user |
| `file_path` | VARCHAR(500) | No | Absolute or relative storage path |
| `file_size` | INT | No | Size in bytes |
| `file_type` | VARCHAR(50) | No | Extension / MIME type (mp3, mp4, etc.) |
| `status` | VARCHAR(50) | No | `uploaded`, `processing`, `completed`, `failed` |
| `created_at` | DATETIME | No | Upload timestamp |

---

### 12. `embeddings_metadata`
Maps transcript chunks to FAISS vector index IDs for semantic search.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique metadata ID |
| `meeting_id` | INT (FK -> meetings.id) | No | Meeting ID (indexed) |
| `transcript_id` | INT (FK -> transcripts.id) | Yes | Source transcript record |
| `chunk_index` | INT | No | Sequential chunk index |
| `chunk_text` | TEXT | No | Text chunk content |
| `speaker_name` | VARCHAR(150) | Yes | Attributed speaker for chunk |
| `start_time` | FLOAT | Yes | Start time in seconds |
| `end_time` | FLOAT | Yes | End time in seconds |
| `faiss_id` | INT | Yes | Vector index identifier in FAISS |
| `created_at` | DATETIME | No | Indexing timestamp |

---

### 13. `meeting_settings`
Stores user-specific meeting preferences.
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INT (PK, Auto) | No | Unique settings ID |
| `user_id` | INT (FK -> users.id) | No | User ID (Unique, 1-to-1 relationship) |
| `default_mic_on` | BOOLEAN | No | Default microphone state (default TRUE) |
| `default_cam_on` | BOOLEAN | No | Default camera state (default TRUE) |
| `captions_enabled` | BOOLEAN | No | Default captions state (default FALSE) |
| `preferred_theme` | VARCHAR(20) | No | UI theme (`dark` / `light`) |
| `created_at` | DATETIME | No | Creation timestamp |
| `updated_at` | DATETIME | Yes | Update timestamp |
