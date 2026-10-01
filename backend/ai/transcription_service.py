import os
import tempfile

import whisper


print("Loading Whisper model...")

model = whisper.load_model("tiny")

print("Whisper model loaded successfully.")


def transcribe_audio(audio_bytes):
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=".webm",
            delete=False
        ) as temp_file:

            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        result = model.transcribe(
            temp_path,
            fp16=False
        )

        text = result.get("text", "").strip()

        return text

    except Exception as error:
        print("Whisper transcription error:", error)
        return ""

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)