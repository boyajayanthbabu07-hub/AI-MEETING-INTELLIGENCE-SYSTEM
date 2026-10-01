# AI Meeting Intelligence System

A full-stack, production-style AI-powered meeting platform similar in core workflow to modern video-conferencing systems such as Google Meet, enhanced with real-time speech transcription, speaker attribution, AI meeting summaries, key points, action items tracking, decisions extraction, semantic transcript search with FAISS, and an interactive AI Meeting Assistant.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |          React 19 Frontend            |
                      |  (Vite HTTPS, WebRTC, Socket.IO Client)|
                      +-------------------+-------------------+
                                          |
                        HTTP / REST APIs  |  WebRTC Signaling & Events
                                          |
                      +-------------------v-------------------+
                      |           Flask Backend               |
                      |  (Flask-JWT-Extended, Flask-SocketIO) |
                      +-------------------+-------------------+
                                          |
            +-----------------------------+-----------------------------+
            |                             |                             |
+-----------v-----------+     +-----------v-----------+     +-----------v-----------+
|    MySQL 8 Database   |     |    Whisper Engine     |     |   AI & Search Engine  |
| Users, Meetings,      |     | Local Speech-to-Text  |     | FAISS Vector Index,   |
| Transcripts, Actions, |     | with FFmpeg Audio     |     | LLM Summaries,        |
| Decisions, Messages   |     | Extraction Pipeline   |     | Decisions, Q&A RAG    |
+-----------------------+     +-----------------------+     +-----------------------+
```

---

## Key Features

1. **Authentication & Profile Security**:
   - Secure account registration with hashed passwords (Werkzeug).
   - JWT-based authentication with protected API endpoints.
   - Email verification with cryptographically secure 6-digit OTPs.
   - Forgot password and reset password flow with expiration limits.
   - User profile management.

2. **Real-Time Video Conferencing (Google-Meet-Style)**:
   - Meeting creation with unique room codes and shareable links.
   - Multi-peer WebRTC mesh streaming (Google STUN: `stun:stun.l.google.com:19302`).
   - Camera and microphone toggle controls.
   - Real-time screen sharing via browser display media API.
   - In-meeting persistent chat with Socket.IO.
   - Participant list, raise/lower hand, and active speaker detection.
   - Real-time meeting timer (`HH:MM:SS`).

3. **Speech-to-Text & Live Captions**:
   - OpenAI Whisper speech recognition with FFmpeg.
   - Streaming/windowed audio processing without blocking WebRTC signaling.
   - Live captions overlay in the meeting room.
   - Speaker attribution and timestamped transcript segments stored in MySQL.

4. **AI Meeting Intelligence & Insights**:
   - Automated executive summaries.
   - Key discussion points extraction.
   - Action items extraction with task, assignee, deadline, and interactive status tracking.
   - Meeting decisions extraction.
   - Vector chunking, embeddings, and FAISS-powered semantic search across meeting history.
   - Interactive AI Q&A assistant grounded in actual meeting transcripts (no hallucinations).

5. **Audio/Video Meeting Upload**:
   - Upload pre-recorded meetings (MP3, WAV, M4A, WEBM, MP4).
   - Audio extraction with FFmpeg and offline Whisper transcription.
   - Full post-meeting AI intelligence pipeline.

---

## Tech Stack

- **Frontend**: React 19, Vite 8, React Router 7, Axios, Socket.IO Client, WebRTC APIs, `@vitejs/plugin-basic-ssl`.
- **Backend**: Python 3.11, Flask 3.1, Flask-SocketIO 5.6, Flask-JWT-Extended, Flask-CORS, SQLAlchemy 2.1, PyMySQL.
- **Database**: MySQL 8.0.
- **AI & Audio**: OpenAI Whisper, FFmpeg 9, PyTorch CPU, FAISS.

---

## Prerequisites

- **Python**: 3.11.9+
- **Node.js**: v20.x or v24.x
- **npm**: 10.x or 11.x
- **MySQL**: 8.0+
- **FFmpeg**: Installed and accessible in system PATH

---

## Setup & Installation

### 1. Backend Setup
1. Activate the Python virtual environment:
   ```bash
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   # Or Command Prompt
   .\venv\Scripts\activate.bat
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment variables:
   - Copy `.env.example` to `.env` (or configure existing `.env`).
   - Set MySQL database credentials (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
   - Set `JWT_SECRET_KEY` and SMTP configuration for OTP emails.

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm.cmd install
   ```
3. Configure frontend environment in `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_SOCKET_URL=http://localhost:5000
   ```

---

## Running the Application

### Start Backend Server:
```bash
python backend/app/main.py
```
Backend will start on `http://127.0.0.1:5000` (or `http://192.168.0.108:5000` for LAN access).

### Start Frontend Dev Server:
```bash
cd frontend
npm.cmd run dev
```
Frontend will start on HTTPS `https://192.168.0.108:5173` (or `https://localhost:5173`).

---

## Project Structure

```
AI-Meeting-Intelligence/
│
├── backend/
│   ├── app/
│   │   ├── database.py         # SQLAlchemy engine & session maker
│   │   └── main.py             # Flask app & Socket.IO server
│   ├── models/
│   │   └── models.py           # Database models (User, Meeting, Transcript, etc.)
│   ├── routes/
│   │   ├── auth_routes.py      # Authentication endpoints
│   │   └── meeting_routes.py   # Meeting management endpoints
│   ├── services/               # Business logic & email services
│   ├── ai/
│   │   └── transcription_service.py # Whisper transcription
│   ├── utils/                  # Shared helpers
│   ├── uploads/                # Meeting audio/video files
│   └── create_tables.py        # Database schema initialization
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx       # Login view
│   │   │   ├── Register.jsx    # User registration
│   │   │   ├── Dashboard.jsx   # Meeting dashboard
│   │   │   └── MeetingRoom.jsx # WebRTC room with controls
│   │   ├── api.js              # Axios client with JWT interceptor
│   │   ├── App.jsx             # React Router routing
│   │   └── main.jsx            # React root entrypoint
│   ├── package.json
│   └── vite.config.js          # Vite config with HTTPS SSL plugin
│
├── database/                   # Migrations & schema definitions
├── docs/                       # Architecture & design documentation
├── faiss_data/                 # FAISS vector indexes
├── tests/                      # Automated tests
├── .env.example                # Sample environment configuration
├── requirements.txt            # Python dependencies
└── README.md                   # Project documentation
```

---

## Development Roadmap & Phases

- [x] **Phase 0**: Project Audit & Diagnostics
- [x] **Phase 1**: Project Foundation (.gitignore, .env.example, README, Git init, dependencies)
- [ ] **Phase 2**: Database Architecture & Safe Schema Evolution
- [ ] **Phase 3**: Complete Authentication Backend
- [ ] **Phase 4**: Email & OTP System
- [ ] **Phase 5**: Authentication Frontend
- [ ] **Phase 6**: Global UI Design System
- [ ] **Phase 7**: Dashboard
- [ ] **Phase 8**: Meeting Management
- [ ] **Phase 9 & 10**: Professional Meeting Room & WebRTC Optimization
- [ ] **Phase 11 & 12**: Real-Time Chat & Participant Controls
- [ ] **Phase 13**: Meeting Timer
- [ ] **Phase 14 & 15**: Audio Capture & Background Whisper Pipeline
- [ ] **Phase 16 & 17**: Live Captions & Speaker Identification
- [ ] **Phase 18**: Transcript System
- [ ] **Phase 19 to 23**: AI Intelligence (Summaries, Actions, Decisions)
- [ ] **Phase 24 & 25**: Meeting Details & Meeting History
- [ ] **Phase 26 to 28**: Embeddings, FAISS Semantic Search & AI Q&A
- [ ] **Phase 29 & 30**: Audio/Video Upload & File Processing
- [ ] **Phase 31 & 32**: Settings & Device Management
- [ ] **Phase 33 to 35**: Security, Error Handling & End-to-End Testing
- [ ] **Phase 36 to 39**: Performance, Documentation & Deployment
