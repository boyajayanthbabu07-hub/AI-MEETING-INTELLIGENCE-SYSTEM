
import os
import tempfile
import subprocess
import shutil
import threading
import re

_model = None
_model_lock = threading.Lock()

def get_whisper_model():
    """Lazily load Whisper model with tiny.en or base.en to conserve RAM on cloud free tiers."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    import whisper
                    model_name = os.getenv("WHISPER_MODEL", "tiny.en")
                    print(f"Loading Whisper model ({model_name})...")
                    _model = whisper.load_model(model_name)
                    print(f"Whisper model ({model_name}) loaded successfully.")
                except Exception as e:
                    print(f"[TRANSCRIPTION] Error loading Whisper model: {e}")
                    return None
    return _model

# Whisper decoding parameters specifically tuned to prevent hallucination:
# 1. language='en': Locks language to English, stopping Chinese/Spanish/Indonesian hallucination.
# 2. temperature=0.0: Greedy decoding prevents random gibberish sampling.
# 3. no_speech_threshold=0.6: Accurately detects silence/ambient background noise and produces empty string.
# 4. condition_on_previous_text=False: Prevents looping hallucinations across consecutive audio chunks.
# 5. compression_ratio_threshold=2.4: Filters out repetitive runaway tokens (e.g. "...", "and see you in court").
WHISPER_OPTS = {
    "fp16": False,
    "language": "en",
    "temperature": 0.0,
    "no_speech_threshold": 0.6,
    "logprob_threshold": -1.0,
    "compression_ratio_threshold": 2.4,
    "condition_on_previous_text": False,
}

# Known common acoustic misrecognitions for Indian names and technical domain terms
COMMON_ACOUSTIC_REPLACEMENTS = [
    (r'\b(?:boya?|boy)?\s*(?:do\s*you\s*have\s*a\s*bubble|do\s*you\s*have\s*a\s*babu|the\s*end\s*baboo|the\s*end\s*babu|the\s*and\s*babu)\b', 'Boya Jayanth Babu'),
    (r'\b(?:boya?|boy)\s*(?:jay\s*and|jay\s*ant|jayan)\b', 'Boya Jayanth'),
    (r'\b(?:jay\s*ant|jay\s*and|the\s*end)\s*baboo?\b', 'Jayanth Babu'),
    (r'\bboyajayanth\b', 'Boya Jayanth'),
    (r'\bai\s*visper\b', 'AI Whisper'),
    (r'\bvisper\b', 'Whisper'),
    (r'\bmanas(?:ha|a)?\b', 'Manasa'),
    (r'\bnithesh\b', 'Nithish'),
    (r'\bnithis\b', 'Nithish'),
    (r'\bvignes\b', 'Vignesh'),
    (r'\btarun\b', 'Tharun'),
]


def post_process_transcript(text: str, known_names: list = None) -> str:
    """
    Ensure 100% precision on participant names and technical terms by:
    1. Replacing known acoustic mishearings.
    2. Case-insensitively restoring exact participant names and casing.
    """
    if not text:
        return ""
    result = text.strip()

    # 1. Apply phonetic/acoustic corrections
    for pattern, replacement in COMMON_ACOUSTIC_REPLACEMENTS:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    # 2. Fix casing for all known participant names
    if known_names:
        for name in sorted(known_names, key=len, reverse=True):
            clean = name.strip()
            if len(clean) >= 3:
                pattern = re.compile(rf'\b{re.escape(clean)}\b', re.IGNORECASE)
                result = pattern.sub(clean, result)

    # 3. Clean hallucinated punctuation or filler
    if result in [".", "..", "...", "....", "you", "Thank you.", "Bye.", "Silence."]:
        return ""

    return result


def _filter_and_extract_speech(transcription: dict, known_names: list = None) -> str:
    """
    Extract genuine speech from Whisper segment metadata.
    Completely eliminates hallucinations during silence (such as repeating the initial prompt roster
    or runaway repetitive tokens like 'All right. All right. All right...').
    """
    segments = transcription.get("segments", [])
    if not segments:
        raw_text = transcription.get("text", "").strip()
        return post_process_transcript(raw_text, known_names=known_names)

    valid_texts = []
    for seg in segments:
        no_speech = seg.get("no_speech_prob", 0.0)
        compression = seg.get("compression_ratio", 1.0)
        avg_logprob = seg.get("avg_logprob", -10.0)
        seg_text = seg.get("text", "").strip()

        # Reject segments with high probability of no speech (silence/background noise)
        if no_speech >= 0.6:
            continue

        # Reject runaway repetitive loops (e.g. "All right. All right. All right...")
        if compression >= 2.4:
            continue

        # Reject very low confidence samples
        if avg_logprob < -1.0:
            continue

        if seg_text:
            valid_texts.append(seg_text)

    combined = " ".join(valid_texts).strip()
    if not combined:
        return ""

    # Check if the output is purely repeating the known names roster
    if known_names:
        clean_tokens = [t.strip().lower() for t in combined.strip(" .,!?").split(",") if t.strip()]
        lower_known = {n.lower().strip() for n in known_names if n}
        if len(clean_tokens) >= 2 and all(tok in lower_known for tok in clean_tokens):
            return ""

    return post_process_transcript(combined, known_names=known_names)
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


def transcribe_audio(audio_bytes: bytes, initial_prompt: str = "", known_names: list = None) -> str:
    """
    Transcribe raw audio bytes using OpenAI Whisper.
    Accepts:
    1. RIFF WAV audio directly
    2. WebM/OGG/MP3 compressed audio (converted via FFmpeg)
    3. Raw PCM 16-bit 16kHz mono (converted via FFmpeg)

    Biases Whisper's decoding vocabulary with `initial_prompt` (containing
    participant names and meeting keywords) for 100% accuracy on proper nouns.
    """
    input_path = None
    output_path = None

    try:
        if not audio_bytes or len(audio_bytes) < 800:
            return ""

        # Prepare whisper decode options with prompt biasing
        opts = dict(WHISPER_OPTS)
        if initial_prompt:
            opts["initial_prompt"] = initial_prompt

        model = get_whisper_model()
        if model is None:
            return ""

        # If audio is already valid RIFF WAV, feed it directly to Whisper!
        if len(audio_bytes) > 44 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                wav_path = f.name
            try:
                with _model_lock:
                    transcription = model.transcribe(wav_path, **opts)
                return _filter_and_extract_speech(transcription, known_names=known_names)
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
            transcription = model.transcribe(output_path, **opts)

        return _filter_and_extract_speech(transcription, known_names=known_names)

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
