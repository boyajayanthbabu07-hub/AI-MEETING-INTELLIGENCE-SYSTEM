"""
PDF export for meeting notes.

Generates a clean, properly formatted PDF from meeting data using fpdf2.
Handles Unicode safely (falls back to ASCII where the font lacks glyphs).
"""

import io
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

from fpdf import FPDF


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe(text: Any) -> str:
    """Return a clean string, stripping unsupported Unicode characters."""
    if text is None:
        return ""
    return str(text).encode("latin-1", errors="replace").decode("latin-1")


def _fmt_duration(seconds: Optional[int]) -> str:
    if not seconds or seconds <= 0:
        return "N/A"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


# ---------------------------------------------------------------------------
# PDF builder
# ---------------------------------------------------------------------------

class MeetingPDF(FPDF):
    def header(self):
        self.set_fill_color(11, 15, 25)          # --bg-main dark navy
        self.rect(0, 0, self.w, 18, "F")
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(56, 189, 248)         # --primary cyan
        self.set_y(4)
        self.cell(0, 10, "AI Meeting Intelligence", align="L", ln=True)
        self.set_text_color(80, 100, 130)
        self.set_font("Helvetica", "", 8)
        self.set_y(4)
        self.cell(0, 10, f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", align="R", ln=True)
        self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(120, 130, 150)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")

    def section_title(self, title: str, color=(56, 189, 248)):
        self.ln(3)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*color)
        self.cell(0, 7, _safe(title), ln=True)
        # Underline
        self.set_draw_color(*color)
        self.set_line_width(0.3)
        x = self.get_x()
        y = self.get_y()
        self.line(x, y, x + self.epw, y)
        self.set_line_width(0.2)
        self.ln(3)
        self.set_text_color(220, 225, 235)

    def body_text(self, text: str, indent: float = 0):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(210, 218, 230)
        self.set_x(self.l_margin + indent)
        self.multi_cell(self.epw - indent, 5, _safe(text))

    def bullet(self, text: str, indent: float = 4, bullet_char: str = "-"):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(210, 218, 230)
        # bullet marker
        self.set_x(self.l_margin + indent)
        self.cell(5, 5, _safe(bullet_char))
        self.set_x(self.l_margin + indent + 5)
        self.multi_cell(self.epw - indent - 5, 5, _safe(text))

    def info_row(self, label: str, value: str):
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(120, 150, 180)
        self.cell(32, 5, _safe(label) + ":", ln=False)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(220, 225, 235)
        self.multi_cell(self.epw - 32, 5, _safe(value))


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------

def generate_meeting_pdf(
    title: str,
    room_code: str,
    host_name: str,
    date_str: str,
    duration_seconds: Optional[int],
    participants: List[str],
    summary: str,
    key_points: List[str],
    decisions: List[str],
    action_items: List[Dict[str, Any]],
    transcripts: List[Dict[str, Any]],
) -> bytes:
    """
    Build a PDF for a meeting and return the raw bytes.

    All text parameters accept ordinary Python strings; Unicode characters
    that cannot be encoded in latin-1 are replaced automatically.
    """
    pdf = MeetingPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(15, 22, 15)
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.set_fill_color(11, 15, 25)

    # ---- Cover ----
    pdf.add_page()
    pdf.set_fill_color(11, 15, 25)
    pdf.rect(0, 0, pdf.w, pdf.h, "F")

    # Accent bar
    pdf.set_fill_color(56, 189, 248)
    pdf.rect(0, 22, 5, 50, "F")

    pdf.set_y(28)
    pdf.set_x(12)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(255, 255, 255)
    pdf.multi_cell(pdf.epw, 9, _safe(title))

    pdf.ln(4)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 150, 180)
    pdf.info_row("Room Code", room_code)
    pdf.info_row("Host", host_name)
    pdf.info_row("Date", date_str)
    pdf.info_row("Duration", _fmt_duration(duration_seconds))
    pdf.info_row("Participants", str(len(participants)))

    if participants:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(120, 150, 180)
        pdf.cell(32, 5, "Attendees:", ln=False)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(220, 225, 235)
        pdf.multi_cell(pdf.epw - 32, 5, _safe(", ".join(participants)))

    # ---- Page 2: Summary & Key Points ----
    pdf.add_page()
    pdf.set_fill_color(11, 15, 25)
    pdf.rect(0, 0, pdf.w, pdf.h, "F")

    pdf.section_title("1. Executive Summary")
    if summary and summary.strip():
        pdf.body_text(summary)
    else:
        pdf.body_text("No summary generated.")

    pdf.section_title("2. Key Discussion Points", color=(99, 102, 241))
    if key_points:
        for pt in key_points:
            if pt.strip():
                pdf.bullet(pt)
    else:
        pdf.body_text("No key points recorded.")

    # ---- Decisions ----
    pdf.section_title("3. Decisions Reached", color=(16, 185, 129))
    if decisions:
        for d in decisions:
            if d.strip():
                pdf.bullet(d, bullet_char=">")
    else:
        pdf.body_text("No formal decisions recorded.")

    # ---- Action Items ----
    pdf.section_title("4. Action Items & Next Steps", color=(251, 191, 36))
    if action_items:
        for i, item in enumerate(action_items, 1):
            task = _safe(item.get("task", ""))
            assignee = _safe(item.get("assignee") or "Unassigned")
            deadline = _safe(item.get("deadline") or "-")
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(255, 255, 255)
            pdf.set_x(pdf.l_margin + 4)
            pdf.cell(0, 5, f"{i}. {task}", ln=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(120, 150, 180)
            pdf.set_x(pdf.l_margin + 10)
            pdf.cell(0, 4, f"Owner: {assignee}   |   Deadline: {deadline}", ln=True)
            pdf.ln(1)
    else:
        pdf.body_text("No action items recorded.")

    # ---- Full Transcript ----
    if transcripts:
        pdf.add_page()
        pdf.set_fill_color(11, 15, 25)
        pdf.rect(0, 0, pdf.w, pdf.h, "F")
        pdf.section_title("5. Full Conversation Transcript", color=(148, 163, 184))

        last_speaker = None
        for seg in transcripts:
            speaker = _safe(seg.get("speaker_name") or "Participant")
            text = _safe(seg.get("text") or "")
            ts = _safe(seg.get("timestamp_str") or "00:00")

            if not text.strip():
                continue

            if speaker != last_speaker:
                pdf.ln(2)
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(56, 189, 248)
                pdf.cell(0, 5, f"{speaker}", ln=True)
                last_speaker = speaker

            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(80, 100, 130)
            pdf.set_x(pdf.l_margin + 4)
            pdf.cell(14, 4, f"[{ts}]", ln=False)
            pdf.set_text_color(200, 210, 225)
            pdf.multi_cell(pdf.epw - 14 - 4, 4, text)

    # Output as bytes
    return pdf.output()
