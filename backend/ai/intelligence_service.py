
import os
import re
import json
import time
from typing import List, Dict, Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_TIMEOUT = 20
GEMINI_MAX_ATTEMPTS = 2


def format_timestamp(seconds: Optional[float]) -> str:
    """Convert seconds to mm:ss format."""
    if seconds is None:
        return "00:00"

    try:
        seconds = max(0, float(seconds))
    except (TypeError, ValueError):
        return "00:00"

    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"


def _empty_intelligence(meeting_title: str) -> Dict[str, Any]:
    """Return a consistent, truthful intelligence structure."""
    return {
        "summary": f"No transcript recorded for '{meeting_title}' yet.",
        "detailed_notes": [],
        "key_discussion_points": [],
        "decisions": [],
        "action_items": [],
        "unresolved_questions": [],
        "blockers": []
    }


def _parse_json_response(response_text: str) -> Dict[str, Any]:
    """Parse a JSON object returned by Gemini."""
    text = (response_text or "").strip()

    # Accommodate responses wrapped in Markdown code fences.
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)

    result = json.loads(text)

    if not isinstance(result, dict):
        raise ValueError("Gemini response must be a JSON object.")

    return result


def _normalize_intelligence(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and normalize fields before returning them to the API."""
    def string_list(value: Any) -> List[str]:
        if not isinstance(value, list):
            return []

        return [
            item.strip()
            for item in value
            if isinstance(item, str) and item.strip()
        ]

    raw_actions = data.get("action_items", [])
    action_items = []

    if isinstance(raw_actions, list):
        for item in raw_actions:
            if not isinstance(item, dict):
                continue

            task = item.get("task")
            if not isinstance(task, str) or not task.strip():
                continue

            assignee = item.get("assignee")
            deadline = item.get("deadline")

            action_items.append({
                "task": task.strip(),
                "assignee": (
                    assignee.strip()
                    if isinstance(assignee, str) and assignee.strip()
                    else None
                ),
                "deadline": (
                    deadline.strip()
                    if isinstance(deadline, str) and deadline.strip()
                    else None
                )
            })

    summary = data.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("Gemini response has no valid summary.")

    return {
        "summary": summary.strip(),
        "detailed_notes": string_list(data.get("detailed_notes")),
        "key_discussion_points": string_list(
            data.get("key_discussion_points")
        ),
        "decisions": string_list(data.get("decisions")),
        "action_items": action_items,
        "unresolved_questions": string_list(
            data.get("unresolved_questions")
        ),
        "blockers": string_list(data.get("blockers"))
    }


def generate_intelligence_from_gemini(
    transcript_segments: List[Dict[str, Any]],
    meeting_title: str = "Meeting"
) -> Optional[Dict[str, Any]]:
    """Generate meeting intelligence using the Gemini REST API."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        print("[GEMINI INTELLIGENCE] GEMINI_API_KEY is not configured.")
        return None

    transcript_lines = []

    for segment in transcript_segments:
        text = segment.get("text") or ""
        if not isinstance(text, str) or not text.strip():
            continue

        speaker = segment.get("speaker_name") or "Participant"
        timestamp = format_timestamp(segment.get("start_time"))

        transcript_lines.append(
            f"[{timestamp}] {speaker}: {text.strip()}"
        )

    full_transcript = "\n".join(transcript_lines)

    if not full_transcript:
        return None

    prompt = f"""
You are an expert AI meeting assistant.

Analyze the meeting transcript below and produce accurate, useful meeting
intelligence for the meeting titled "{meeting_title}".

Rules:
- Use only facts supported by the transcript.
- Never invent decisions, action items, names, deadlines, or blockers.
- Include an action item only when an actual task or commitment is expressed.
- Use null for an unknown assignee or deadline.
- Do not treat a question or suggestion as an approved decision.
- If no decisions or action items are mentioned, return empty arrays.
- Write concise but meaningful notes.
- Return only one valid JSON object, without Markdown fences.

Required JSON structure:
{{
  "summary": "Executive summary",
  "detailed_notes": ["Important note"],
  "key_discussion_points": ["Discussion point"],
  "decisions": ["Explicit decision"],
  "action_items": [
    {{
      "task": "Explicit task or commitment",
      "assignee": null,
      "deadline": null
    }}
  ],
  "unresolved_questions": ["Open question"],
  "blockers": ["Explicit blocker or risk"]
}}

Meeting transcript:
{full_transcript}
"""

    url = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{GEMINI_MODEL}:generateContent"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }

    for attempt in range(1, GEMINI_MAX_ATTEMPTS + 1):
        try:
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=GEMINI_TIMEOUT
            )

            if response.status_code == 200:
                response_data = response.json()

                candidates = response_data.get("candidates", [])
                if not candidates:
                    print(
                        "[GEMINI INTELLIGENCE] API returned no candidates."
                    )
                    return None

                content = candidates[0].get("content", {})
                parts = content.get("parts", [])

                response_text = "".join(
                    part.get("text", "")
                    for part in parts
                    if isinstance(part, dict)
                ).strip()

                if not response_text:
                    print(
                        "[GEMINI INTELLIGENCE] API returned empty content."
                    )
                    return None

                try:
                    parsed = _parse_json_response(response_text)
                    intelligence = _normalize_intelligence(parsed)
                    print(
                        f"[GEMINI INTELLIGENCE] Generated successfully "
                        f"using {GEMINI_MODEL}."
                    )
                    return intelligence
                except (json.JSONDecodeError, ValueError, TypeError) as exc:
                    print(
                        "[GEMINI INTELLIGENCE] Invalid response format: "
                        f"{exc}"
                    )
                    return None

            # Retry temporary rate-limit and service-capacity errors.
            if response.status_code in (429, 500, 502, 503, 504):
                print(
                    f"[GEMINI INTELLIGENCE] Temporary API error "
                    f"{response.status_code}; attempt "
                    f"{attempt}/{GEMINI_MAX_ATTEMPTS}."
                )

                if attempt < GEMINI_MAX_ATTEMPTS:
                    time.sleep(2 ** (attempt - 1))
                    continue

                print(
                    "[GEMINI INTELLIGENCE] Retry limit reached; "
                    "using local fallback."
                )
                return None

            # Do not print the request URL because it can contain secrets
            # in other API configurations.
            print(
                f"[GEMINI INTELLIGENCE] API request failed with HTTP "
                f"{response.status_code}: {response.text[:500]}"
            )
            return None

        except requests.RequestException as exc:
            print(
                f"[GEMINI INTELLIGENCE] Network error on attempt "
                f"{attempt}/{GEMINI_MAX_ATTEMPTS}: {exc}"
            )

            if attempt < GEMINI_MAX_ATTEMPTS:
                time.sleep(2 ** (attempt - 1))

        except (ValueError, KeyError, TypeError) as exc:
            print(
                f"[GEMINI INTELLIGENCE] Response processing error: {exc}"
            )
            return None

    return None


def extract_intelligence_locally(
    transcript_segments: List[Dict[str, Any]],
    meeting_title: str = "Meeting"
) -> Dict[str, Any]:
    """Extract basic meeting intelligence using local text rules."""
    if not transcript_segments:
        return _empty_intelligence(meeting_title)

    sentences = []
    speaker_statements = {}

    for segment in transcript_segments:
        text = (segment.get("text") or "").strip()
        speaker = segment.get("speaker_name") or "Participant"

        if not text:
            continue

        speaker_statements.setdefault(speaker, []).append(text)

        for sentence in re.split(r"(?<=[.!?])\s+", text):
            sentence = sentence.strip()
            if len(sentence) > 3:
                sentences.append({
                    "text": sentence,
                    "speaker": speaker,
                    "time": segment.get("start_time")
                })

    action_patterns = [
        r"\b(?:i will|i'll|we will|we'll|let's|need to|should|"
        r"action item|task|assigned to|please|todo)\b",
        r"\b(?:will handle|will create|will implement|will test|"
        r"will review|will send|will update|will fix)\b"
    ]

    deadline_patterns = [
        r"\bby (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\bby (?:tomorrow|tonight|next week|eod|end of day|"
        r"end of week|noon)\b",
        r"\bbefore (?:the weekend|tomorrow|friday|monday)\b",
        r"\bwithin (?:\d+|a few|two) (?:days|weeks|hours)\b",
        r"\bdue (?:on|by) [a-zA-Z0-9\s,]+\b"
    ]

    action_items = []
    decisions = []
    questions = []
    blockers = []
    key_points = []
    seen_tasks = set()

    decision_patterns = [
        "we decided",
        "decided to",
        "agreed to",
        "let's go with",
        "approved",
        "finalized",
        "consensus is",
        "we will go with",
        "conclusion is"
    ]

    blocker_patterns = [
        "blocker",
        "blocked",
        "issue with",
        "risk",
        "concern",
        "problem with",
        "waiting for",
        "delay"
    ]

    for item in sentences:
        sentence = item["text"]
        speaker = item["speaker"]
        lowered = sentence.lower()

        if (
            "?" in sentence
            or lowered.startswith((
                "how do we", "what should", "can we", "why is",
                "who is", "when will", "where is", "is there", "are we"
            ))
        ):
            question = f"{speaker}: {sentence}"
            if question not in questions:
                questions.append(question)

        if any(pattern in lowered for pattern in blocker_patterns):
            blocker = f"{speaker}: {sentence}"
            if blocker not in blockers:
                blockers.append(blocker)

        if any(pattern in lowered for pattern in decision_patterns):
            if sentence not in decisions:
                decisions.append(sentence)

        if any(re.search(pattern, lowered) for pattern in action_patterns):
            deadline = None

            for pattern in deadline_patterns:
                match = re.search(pattern, lowered)
                if match:
                    deadline = match.group(0)
                    break

            assignee = None

            if re.search(r"\b(?:i will|i'll|i can)\b", lowered):
                assignee = speaker
            else:
                for other_speaker in speaker_statements:
                    if (
                        other_speaker.lower() in lowered
                        and other_speaker != speaker
                    ):
                        assignee = other_speaker
                        break

            task_key = re.sub(r"\s+", " ", lowered).strip()

            if task_key not in seen_tasks:
                seen_tasks.add(task_key)
                action_items.append({
                    "task": sentence,
                    "assignee": assignee,
                    "deadline": deadline
                })

        if len(sentence) > 25 and not sentence.endswith("?"):
            point = (
                f"[{format_timestamp(item['time'])}] "
                f"{speaker}: {sentence}"
            )
            if point not in key_points:
                key_points.append(point)

    speaker_names = list(speaker_statements.keys())
    num_speakers = len(speaker_names)
    total_segments = len(transcript_segments)

    summary_parts = [
        f"Meeting '{meeting_title}' had {num_speakers} active speaker(s) "
        f"and {total_segments} transcript segment(s) recorded."
    ]

    if decisions:
        summary_parts.append(
            f"{len(decisions)} potential decision statement(s) were identified."
        )

    if action_items:
        summary_parts.append(
            f"{len(action_items)} potential action item(s) were identified."
        )

    if questions:
        summary_parts.append(
            f"{len(questions)} question(s) were raised."
        )

    detailed_notes = key_points[:15]

    return {
        "summary": " ".join(summary_parts),
        "detailed_notes": detailed_notes,
        "key_discussion_points": key_points[:10],
        "decisions": decisions,
        "action_items": action_items,
        "unresolved_questions": questions[:8],
        "blockers": blockers[:6]
    }


def generate_meeting_intelligence(
    transcript_segments: List[Dict[str, Any]],
    meeting_title: str = "Meeting"
) -> Dict[str, Any]:
    """Try Gemini first and fall back to local extraction."""
    if not transcript_segments:
        return _empty_intelligence(meeting_title)

    gemini_result = generate_intelligence_from_gemini(
        transcript_segments,
        meeting_title
    )

    if gemini_result:
        return gemini_result

    print(
        "[MEETING INTELLIGENCE] Gemini unavailable; "
        "using local extraction."
    )

    return extract_intelligence_locally(
        transcript_segments,
        meeting_title
    )
