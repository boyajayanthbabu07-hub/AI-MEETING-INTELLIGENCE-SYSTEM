
import hashlib
import os
import re
import secrets
import smtplib
import string
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, Dict, Any, Tuple, List
from dotenv import load_dotenv


# Load the root project .env file explicitly.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = PROJECT_ROOT / ".env"
load_dotenv(ENV_PATH, override=True)


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def hash_otp(otp_code: str) -> str:
    """Hash OTP using SHA-256 with a salt."""
    salt = os.getenv("SECRET_KEY", "ai-meeting-salt-2026")
    return hashlib.sha256(f"{otp_code}:{salt}".encode("utf-8")).hexdigest()


def verify_otp_hash(otp_code: str, stored_hash: str) -> bool:
    """Verify an OTP hash."""
    return hash_otp(otp_code) == stored_hash


def is_smtp_configured() -> bool:
    """Check whether SMTP username and password exist."""
    username = os.getenv("MAIL_USERNAME", "").strip()
    password = os.getenv("MAIL_PASSWORD", "").strip()
    return bool(username and password)


def get_smtp_status() -> Dict[str, Any]:
    """Return sanitized SMTP status without exposing the password."""
    username = os.getenv("MAIL_USERNAME", "").strip()
    password = os.getenv("MAIL_PASSWORD", "").strip()
    server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    port = int(os.getenv("MAIL_PORT", "587"))
    use_tls = os.getenv("MAIL_USE_TLS", "True").lower() in ("true", "1", "yes")
    default_sender = os.getenv("MAIL_DEFAULT_SENDER", "").strip()

    masked_user = ""
    if username:
        parts = username.split("@")
        if len(parts) == 2:
            masked_user = f"{parts[0][:2]}***@{parts[1]}"
        else:
            masked_user = f"{username[:2]}***"

    return {
        "configured": bool(username and password),
        "mail_server": server,
        "mail_port": port,
        "mail_use_tls": use_tls,
        "mail_username_masked": masked_user,
        "mail_default_sender": default_sender or (
            f"AI Meeting Intelligence <{username}>" if username else ""
        ),
        "has_password": bool(password),
    }


def safe_smtp_login(
    server: smtplib.SMTP,
    username: str,
    password: str,
) -> Tuple[int, bytes]:
    """Authenticate using an advertised SMTP mechanism."""
    import base64

    mechanisms = [
        item.upper()
        for item in server.esmtp_features.get("auth", "").split()
    ]

    if "LOGIN" in mechanisms:
        code, response = server.docmd(
            "AUTH LOGIN",
            base64.b64encode(username.encode("utf-8")).decode("ascii"),
        )

        if code == 334:
            code, response = server.docmd(
                base64.b64encode(password.encode("utf-8")).decode("ascii")
            )

        response_bytes = (
            response if isinstance(response, bytes)
            else str(response).encode("utf-8")
        )

        if code in (235, 503):
            return code, response_bytes

        if code == 535 or b"5.7.8" in response_bytes:
            raise smtplib.SMTPAuthenticationError(code, response_bytes)

        raise smtplib.SMTPAuthenticationError(code, response_bytes)

    if "PLAIN" in mechanisms:
        auth_string = f"\0{username}\0{password}"
        encoded = base64.b64encode(auth_string.encode("utf-8")).decode("ascii")
        code, response = server.docmd("AUTH PLAIN", encoded)

        response_bytes = (
            response if isinstance(response, bytes)
            else str(response).encode("utf-8")
        )

        if code in (235, 503):
            return code, response_bytes

        raise smtplib.SMTPAuthenticationError(code, response_bytes)

    return server.login(username, password)


def send_email_detailed(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None,
) -> Dict[str, Any]:
    """Send an email and return diagnostic results.

    attachment_bytes  -- raw PDF (or other) bytes to attach
    attachment_filename -- suggested filename shown in the email client
    """

    mail_server = os.getenv("MAIL_SERVER", "smtp.gmail.com").strip()
    mail_port = int(os.getenv("MAIL_PORT", "587"))
    mail_use_tls = os.getenv("MAIL_USE_TLS", "True").lower() in (
        "true", "1", "yes"
    )
    mail_username = os.getenv("MAIL_USERNAME", "").strip()
    mail_password = os.getenv("MAIL_PASSWORD", "").strip().replace(" ", "")
    default_sender = os.getenv(
        "MAIL_DEFAULT_SENDER",
        f"AI Meeting Intelligence <{mail_username or 'no-reply@meetingintelligence.ai'}>",
    ).strip()

    if not mail_username or not mail_password:
        print("[EMAIL SERVICE] SMTP credentials are not configured.")
        return {
            "success": False,
            "mock": True,
            "message": "MAIL_USERNAME or MAIL_PASSWORD is missing.",
        }

    stage = "initializing"
    server = None

    try:
        message = MIMEMultipart("mixed")
        message["Subject"] = subject
        message["From"] = default_sender
        message["To"] = to_email

        # Build text+html alternative part
        alternative = MIMEMultipart("alternative")
        if text_content:
            alternative.attach(MIMEText(text_content, "plain", "utf-8"))
        if html_content:
            alternative.attach(MIMEText(html_content, "html", "utf-8"))
        message.attach(alternative)

        # Attach PDF if provided
        if attachment_bytes and attachment_filename:
            part = MIMEApplication(attachment_bytes, _subtype="pdf")
            part.add_header(
                "Content-Disposition",
                "attachment",
                filename=attachment_filename
            )
            message.attach(part)

        stage = f"connecting to {mail_server}:{mail_port}"

        if mail_port == 465 or not mail_use_tls:
            server = smtplib.SMTP_SSL(mail_server, mail_port, timeout=20)
            stage = "SSL EHLO"
            server.ehlo()
        else:
            server = smtplib.SMTP(mail_server, mail_port, timeout=20)
            stage = "initial EHLO"
            server.ehlo()
            stage = "STARTTLS"
            server.starttls()
            stage = "post-TLS EHLO"
            server.ehlo()

        stage = "authenticating"
        safe_smtp_login(server, mail_username, mail_password)

        stage = "sending message"
        server.send_message(message)

        print(f"[EMAIL SERVICE] Email sent to {to_email}")
        return {
            "success": True,
            "mock": False,
            "message": f"Email successfully sent to {to_email}",
        }

    except smtplib.SMTPAuthenticationError as error:
        print(
            f"[EMAIL SERVICE ERROR] Authentication failed for "
            f"{mail_username} during '{stage}'. SMTP code: {error.smtp_code}"
        )
        return {
            "success": False,
            "mock": False,
            "message": (
                f"SMTP authentication failed during '{stage}'. "
                "Gmail rejected the credentials used by the running backend. "
                "Verify the account and App Password. The password was not logged."
            ),
        }

    except smtplib.SMTPServerDisconnected as error:
        print(f"[EMAIL SERVICE ERROR] Disconnected during '{stage}': {error}")
        return {
            "success": False,
            "mock": False,
            "message": f"SMTP server disconnected during '{stage}'.",
        }

    except smtplib.SMTPConnectError as error:
        print(f"[EMAIL SERVICE ERROR] Connection failed: {error}")
        return {
            "success": False,
            "mock": False,
            "message": f"Cannot connect to {mail_server}:{mail_port}.",
        }

    except Exception as error:
        print(
            f"[EMAIL SERVICE ERROR] Failed during '{stage}': "
            f"{type(error).__name__}: {error}"
        )
        return {
            "success": False,
            "mock": False,
            "message": (
                f"Email operation failed during '{stage}' "
                f"({type(error).__name__})."
            ),
        }

    finally:
        if server:
            try:
                server.quit()
            except Exception:
                try:
                    server.close()
                except Exception:
                    pass


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> bool:
    """Legacy boolean wrapper."""
    result = send_email_detailed(to_email, subject, html_content, text_content)
    return result["success"] or result["mock"]


def test_smtp_connection(
    test_recipient: Optional[str] = None,
) -> Dict[str, Any]:
    """Test SMTP configuration by sending a test email."""

    mail_username = os.getenv("MAIL_USERNAME", "").strip()
    target_email = test_recipient or mail_username

    if not is_smtp_configured():
        return {
            "success": False,
            "mock": False,
            "message": "MAIL_USERNAME or MAIL_PASSWORD is missing.",
        }

    if not target_email:
        return {
            "success": False,
            "mock": False,
            "message": "No test recipient email specified.",
        }

    subject = "AI Meeting Intelligence - SMTP Test Connection"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;padding:24px;">
      <h2>SMTP Configuration Test</h2>
      <p>This email confirms that your SMTP connection is working.</p>
      <p>AI Meeting Intelligence System</p>
    </body>
    </html>
    """
    text_content = (
        "SMTP test successful. Real email delivery is available."
    )

    return send_email_detailed(
        target_email, subject, html_content, text_content
    )


def update_smtp_env(
    username: str,
    password: str,
    server: str = "smtp.gmail.com",
    port: int = 587,
    use_tls: bool = True,
    default_sender: Optional[str] = None,
) -> Tuple[bool, str]:
    """Update SMTP settings in the runtime and root .env file."""

    clean_user = username.strip()
    clean_pass = password.strip().replace(" ", "")
    clean_server = server.strip()
    clean_port = str(port).strip()
    clean_tls = "True" if use_tls else "False"
    clean_sender = (
        default_sender or f"AI Meeting Intelligence <{clean_user}>"
    ).strip()

    if not clean_user or not clean_pass:
        return False, "SMTP username and password are required."

    keys_to_update = {
        "MAIL_SERVER": clean_server,
        "MAIL_PORT": clean_port,
        "MAIL_USE_TLS": clean_tls,
        "MAIL_USERNAME": clean_user,
        "MAIL_PASSWORD": clean_pass,
        "MAIL_DEFAULT_SENDER": f'"{clean_sender}"',
    }

    try:
        existing_lines = (
            ENV_PATH.read_text(encoding="utf-8").splitlines()
            if ENV_PATH.exists()
            else []
        )

        new_lines = []
        found = set()

        for line in existing_lines:
            matched_key = None
            for key in keys_to_update:
                if line.startswith(f"{key}=") or line.startswith(f"{key} ="):
                    matched_key = key
                    break

            if matched_key:
                new_lines.append(f"{matched_key}={keys_to_update[matched_key]}")
                found.add(matched_key)
            else:
                new_lines.append(line)

        for key, value in keys_to_update.items():
            if key not in found:
                new_lines.append(f"{key}={value}")

        ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

        # Update the running process to match the saved configuration.
        for key, value in keys_to_update.items():
            os.environ[key] = value.strip('"')

        return True, "SMTP configuration updated successfully."

    except Exception as error:
        return False, f"Failed to persist SMTP configuration: {error}"


def send_verification_email_detailed(
    to_email: str,
    user_name: str,
    otp_code: str,
) -> Dict[str, Any]:
    """Send a 6-digit email verification OTP."""

    subject = (
        f"{otp_code} is your AI Meeting Intelligence verification code"
    )
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;padding:24px;">
      <h2>AI Meeting Intelligence</h2>
      <h3>Verify Your Email Address</h3>
      <p>Hello <strong>{user_name}</strong>,</p>
      <p>Your verification code is:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:6px;">
        {otp_code}
      </div>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not create this account, ignore this email.</p>
    </body>
    </html>
    """
    text_content = (
        f"Hello {user_name},\n\nYour verification code is {otp_code}.\n"
        "This code expires in 10 minutes."
    )
    return send_email_detailed(to_email, subject, html_content, text_content)


# ---------------------------------------------------------------------------
# Meeting Summary / PDF Email
# ---------------------------------------------------------------------------

def send_meeting_summary_email(
    to_email: str,
    recipient_name: str,
    meeting_title: str,
    room_code: str,
    date_str: str,
    summary: str,
    decisions: List[str],
    action_items: List[Dict[str, Any]],
    pdf_bytes: Optional[bytes] = None,
    pdf_filename: Optional[str] = None,
) -> Dict[str, Any]:
    """Email the meeting summary (+ optional PDF attachment) to a participant."""

    subject = f"Meeting Summary: {meeting_title} [{room_code}]"

    decisions_html = "".join(f"<li>{d}</li>" for d in decisions) if decisions else "<li>None recorded.</li>"
    actions_html = "".join(
        f"<li><strong>{a.get('task','')}</strong>"
        f"{' — ' + a['assignee'] if a.get('assignee') else ''}"
        f"{' [' + a['deadline'] + ']' if a.get('deadline') else ''}</li>"
        for a in action_items
    ) if action_items else "<li>None identified.</li>"

    attachment_note = "<p>📎 The full meeting report (PDF) is attached to this email.</p>" if pdf_bytes else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;padding:24px;background:#0b0f19;color:#e2e8f0;">
      <div style="max-width:600px;margin:0 auto;background:#1a1f2e;border-radius:12px;padding:28px;">
        <h2 style="color:#38bdf8;margin-top:0;">AI Meeting Intelligence</h2>
        <h3 style="color:#ffffff;">{meeting_title}</h3>
        <p style="color:#94a3b8;font-size:13px;">Room Code: <strong style="color:#38bdf8;">{room_code}</strong> &nbsp;|&nbsp; Date: {date_str}</p>
        {attachment_note}
        <hr style="border-color:#2d3748;margin:20px 0;">

        <h4 style="color:#38bdf8;">Executive Summary</h4>
        <p style="font-size:13px;line-height:1.6;">{summary or 'No summary generated.'}</p>

        <h4 style="color:#10b981;">Decisions Reached</h4>
        <ul style="font-size:13px;">{decisions_html}</ul>

        <h4 style="color:#fbbf24;">Action Items</h4>
        <ul style="font-size:13px;">{actions_html}</ul>

        <p style="color:#64748b;font-size:11px;margin-top:24px;">This summary was generated automatically by AI Meeting Intelligence.</p>
      </div>
    </body>
    </html>
    """

    text_content = (
        f"Meeting Summary: {meeting_title}\n"
        f"Room Code: {room_code}  |  Date: {date_str}\n\n"
        f"SUMMARY\n{summary or 'No summary generated.'}\n\n"
        f"DECISIONS\n" + "\n".join(f"- {d}" for d in decisions) + "\n\n"
        f"ACTION ITEMS\n" + "\n".join(
            f"- {a.get('task','')} (Owner: {a.get('assignee','?')}, Deadline: {a.get('deadline','?')})"
            for a in action_items
        )
    )

    return send_email_detailed(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        attachment_bytes=pdf_bytes,
        attachment_filename=pdf_filename,
    )


def send_verification_email(
    to_email: str,
    user_name: str,
    otp_code: str,
) -> bool:
    result = send_verification_email_detailed(to_email, user_name, otp_code)
    return result["success"] or result["mock"]


def send_password_reset_email_detailed(
    to_email: str,
    user_name: str,
    otp_code: str,
) -> Dict[str, Any]:
    """Send a password reset OTP."""

    subject = f"{otp_code} is your password reset code"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;padding:24px;">
      <h2>AI Meeting Intelligence</h2>
      <h3>Password Reset Request</h3>
      <p>Hello <strong>{user_name}</strong>,</p>
      <p>Your password reset code is:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:6px;">
        {otp_code}
      </div>
      <p>This code expires in 15 minutes.</p>
    </body>
    </html>
    """
    text_content = (
        f"Hello {user_name},\n\nYour password reset code is {otp_code}.\n"
        "This code expires in 15 minutes."
    )
    return send_email_detailed(to_email, subject, html_content, text_content)


# ---------------------------------------------------------------------------
# Meeting Summary / PDF Email
# ---------------------------------------------------------------------------

def send_meeting_summary_email(
    to_email: str,
    recipient_name: str,
    meeting_title: str,
    room_code: str,
    date_str: str,
    summary: str,
    decisions: List[str],
    action_items: List[Dict[str, Any]],
    pdf_bytes: Optional[bytes] = None,
    pdf_filename: Optional[str] = None,
) -> Dict[str, Any]:
    """Email the meeting summary (+ optional PDF attachment) to a participant."""

    subject = f"Meeting Summary: {meeting_title} [{room_code}]"

    decisions_html = "".join(f"<li>{d}</li>" for d in decisions) if decisions else "<li>None recorded.</li>"
    actions_html = "".join(
        f"<li><strong>{a.get('task','')}</strong>"
        f"{' — ' + a['assignee'] if a.get('assignee') else ''}"
        f"{' [' + a['deadline'] + ']' if a.get('deadline') else ''}</li>"
        for a in action_items
    ) if action_items else "<li>None identified.</li>"

    attachment_note = "<p>📎 The full meeting report (PDF) is attached to this email.</p>" if pdf_bytes else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;padding:24px;background:#0b0f19;color:#e2e8f0;">
      <div style="max-width:600px;margin:0 auto;background:#1a1f2e;border-radius:12px;padding:28px;">
        <h2 style="color:#38bdf8;margin-top:0;">AI Meeting Intelligence</h2>
        <h3 style="color:#ffffff;">{meeting_title}</h3>
        <p style="color:#94a3b8;font-size:13px;">Room Code: <strong style="color:#38bdf8;">{room_code}</strong> &nbsp;|&nbsp; Date: {date_str}</p>
        {attachment_note}
        <hr style="border-color:#2d3748;margin:20px 0;">

        <h4 style="color:#38bdf8;">Executive Summary</h4>
        <p style="font-size:13px;line-height:1.6;">{summary or 'No summary generated.'}</p>

        <h4 style="color:#10b981;">Decisions Reached</h4>
        <ul style="font-size:13px;">{decisions_html}</ul>

        <h4 style="color:#fbbf24;">Action Items</h4>
        <ul style="font-size:13px;">{actions_html}</ul>

        <p style="color:#64748b;font-size:11px;margin-top:24px;">This summary was generated automatically by AI Meeting Intelligence.</p>
      </div>
    </body>
    </html>
    """

    text_content = (
        f"Meeting Summary: {meeting_title}\n"
        f"Room Code: {room_code}  |  Date: {date_str}\n\n"
        f"SUMMARY\n{summary or 'No summary generated.'}\n\n"
        f"DECISIONS\n" + "\n".join(f"- {d}" for d in decisions) + "\n\n"
        f"ACTION ITEMS\n" + "\n".join(
            f"- {a.get('task','')} (Owner: {a.get('assignee','?')}, Deadline: {a.get('deadline','?')})"
            for a in action_items
        )
    )

    return send_email_detailed(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        attachment_bytes=pdf_bytes,
        attachment_filename=pdf_filename,
    )


def send_password_reset_email(
    to_email: str,
    user_name: str,
    otp_code: str,
) -> bool:
    result = send_password_reset_email_detailed(to_email, user_name, otp_code)
    return result["success"] or result["mock"]


def send_password_changed_notification(
    to_email: str,
    user_name: str,
) -> bool:
    subject = "Your password has been changed - AI Meeting Intelligence"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;padding:24px;">
      <h2>Password Changed Successfully</h2>
      <p>Hello <strong>{user_name}</strong>,</p>
      <p>Your account password was changed successfully.</p>
      <p>If you did not make this change, reset your password immediately.</p>
      <p>AI Meeting Intelligence System</p>
    </body>
    </html>
    """
    text_content = (
        f"Hello {user_name},\n\nYour account password was changed successfully."
    )
    return send_email(to_email, subject, html_content, text_content)


def send_meeting_invite_email(
    to_email: str,
    inviter_name: str,
    meeting_title: str,
    room_code: str,
    join_url: str,
    passcode: Optional[str] = None,
    meeting_type: str = "internal",
    external_link: Optional[str] = None,
    custom_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Send a meeting invitation email."""

    is_google_meet = (
        meeting_type == "google_meet"
        or bool(external_link and "meet.google" in external_link)
    )
    platform_name = "Google Meet" if is_google_meet else "AI Meeting Intelligence"
    effective_url = (
        external_link
        if is_google_meet and external_link
        else join_url
    )

    subject = f"Invitation: {meeting_title} ({room_code}) - {platform_name}"
    passcode_text = f"\nMeeting Password / Passcode: {passcode}" if passcode else ""
    note_text = f"\nMessage from Host: {custom_message}\n" if custom_message else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;padding:24px;">
      <h2>AI Meeting Intelligence</h2>
      <h3>Meeting Invitation</h3>
      <p><strong>{inviter_name}</strong> has invited you to join a meeting.</p>
      <h3>{meeting_title}</h3>
      <p>Meeting ID / Room Code: <strong>{room_code}</strong></p>
      <p><a href="{effective_url}">Join Meeting Room</a></p>
      <p>Meeting Link: <a href="{effective_url}">{effective_url}</a></p>
      <p>{passcode_text}</p>
      <p>{note_text}</p>
    </body>
    </html>
    """

    text_content = (
        f"Meeting Invitation\n\n"
        f"Host: {inviter_name}\n"
        f"Topic: {meeting_title}\n"
        f"Room Code: {room_code}\n"
        f"Meeting Link: {effective_url}\n"
        f"{passcode_text}\n{note_text}"
    )

    return send_email_detailed(to_email, subject, html_content, text_content)


# ---------------------------------------------------------------------------
# Meeting Summary / PDF Email
# ---------------------------------------------------------------------------

def send_meeting_summary_email(
    to_email: str,
    recipient_name: str,
    meeting_title: str,
    room_code: str,
    date_str: str,
    summary: str,
    decisions: List[str],
    action_items: List[Dict[str, Any]],
    pdf_bytes: Optional[bytes] = None,
    pdf_filename: Optional[str] = None,
) -> Dict[str, Any]:
    """Email the meeting summary (+ optional PDF attachment) to a participant."""

    subject = f"Meeting Summary: {meeting_title} [{room_code}]"

    decisions_html = "".join(f"<li>{d}</li>" for d in decisions) if decisions else "<li>None recorded.</li>"
    actions_html = "".join(
        f"<li><strong>{a.get('task','')}</strong>"
        f"{' — ' + a['assignee'] if a.get('assignee') else ''}"
        f"{' [' + a['deadline'] + ']' if a.get('deadline') else ''}</li>"
        for a in action_items
    ) if action_items else "<li>None identified.</li>"

    attachment_note = "<p>📎 The full meeting report (PDF) is attached to this email.</p>" if pdf_bytes else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;padding:24px;background:#0b0f19;color:#e2e8f0;">
      <div style="max-width:600px;margin:0 auto;background:#1a1f2e;border-radius:12px;padding:28px;">
        <h2 style="color:#38bdf8;margin-top:0;">AI Meeting Intelligence</h2>
        <h3 style="color:#ffffff;">{meeting_title}</h3>
        <p style="color:#94a3b8;font-size:13px;">Room Code: <strong style="color:#38bdf8;">{room_code}</strong> &nbsp;|&nbsp; Date: {date_str}</p>
        {attachment_note}
        <hr style="border-color:#2d3748;margin:20px 0;">

        <h4 style="color:#38bdf8;">Executive Summary</h4>
        <p style="font-size:13px;line-height:1.6;">{summary or 'No summary generated.'}</p>

        <h4 style="color:#10b981;">Decisions Reached</h4>
        <ul style="font-size:13px;">{decisions_html}</ul>

        <h4 style="color:#fbbf24;">Action Items</h4>
        <ul style="font-size:13px;">{actions_html}</ul>

        <p style="color:#64748b;font-size:11px;margin-top:24px;">This summary was generated automatically by AI Meeting Intelligence.</p>
      </div>
    </body>
    </html>
    """

    text_content = (
        f"Meeting Summary: {meeting_title}\n"
        f"Room Code: {room_code}  |  Date: {date_str}\n\n"
        f"SUMMARY\n{summary or 'No summary generated.'}\n\n"
        f"DECISIONS\n" + "\n".join(f"- {d}" for d in decisions) + "\n\n"
        f"ACTION ITEMS\n" + "\n".join(
            f"- {a.get('task','')} (Owner: {a.get('assignee','?')}, Deadline: {a.get('deadline','?')})"
            for a in action_items
        )
    )

    return send_email_detailed(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        attachment_bytes=pdf_bytes,
        attachment_filename=pdf_filename,
    )