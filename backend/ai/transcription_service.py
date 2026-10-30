
import os
import tempfile
import subprocess
import shutil
import threading

import whisper

print("Loading Whisper model...")
_model = whisper.load_model("tiny")
_model_lock = threading.Lock()
print("Whisper model loaded successfully.")


def _detect_audio_format(audio_bytes: bytes) -> str:
    """Guess the container format from the first few bytes."""
    if audio_bytes[:4] == b"OggS":
        return "ogg"
    if audio_bytes[:4] == b"fLaC":
        return "flac"
    if audio_bytes[:3] == b"ID3" or audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "mp3"
    if audio_bytes[:4] == b"RIFF":
        return "wav"
    # Default to webm (Chrome/Edge/Firefox MediaRecorder output)
    return "webm"


def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribe raw audio bytes using OpenAI Whisper.
    Accepts:
    1. RIFF WAV audio directly
    2. WebM/OGG/MP3 compressed audio (converted via FFmpeg)
    3. Raw PCM 16-bit 16kHz mono (converted via FFmpeg)
    """
    input_path = None
    output_path = None

    try:
        if not audio_bytes or len(audio_bytes) < 800:
            return ""

        # If audio is already valid RIFF WAV, feed it directly to Whisper!
        if len(audio_bytes) > 44 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                wav_path = f.name
            try:
                with _model_lock:
                    transcription = _model.transcribe(wav_path, fp16=False)
                return transcription.get("text", "").strip()
            finally:
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass

        fmt = _detect_audio_format(audio_bytes)

        # Write raw bytes to a temp file
        with tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False) as f:
            f.write(audio_bytes)
            input_path = f.name

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            output_path = f.name

        ffmpeg_path = shutil.which("ffmpeg")
        if not ffmpeg_path:
            print("[TRANSCRIPTION] FFmpeg not found on PATH.")
            return ""

        # For WebM chunks that may be missing the EBML header,
        # try matroska demuxer, fall back to standard demuxing
        if fmt == "webm":
            input_flags = [
                "-err_detect", "ignore_err",
                "-f", "matroska",
                "-i", input_path,
            ]
        else:
            input_flags = ["-i", input_path]

        command = [
            ffmpeg_path,
            "-y",
            *input_flags,
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "pcm_s16le",
            output_path,
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            print("[TRANSCRIPTION] FFmpeg conversion failed:", result.stderr[-400:])
            return ""

        wav_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        if wav_size < 500:
            print(f"[TRANSCRIPTION] WAV output too small ({wav_size} bytes), skipping.")
            return ""

        with _model_lock:
            transcription = _model.transcribe(output_path, fp16=False)

        text = transcription.get("text", "").strip()
        return text

    except subprocess.TimeoutExpired:
        print("[TRANSCRIPTION] FFmpeg timed out.")
        return ""

    except Exception as err:
        print("[TRANSCRIPTION] Error:", err)
        return ""

    finally:
        for path in (input_path, output_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
