import hashlib
import os
import secrets
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP."""
    digits = string.digits
    return "".join(secrets.choice(digits) for _ in range(length))


def hash_otp(otp_code: str) -> str:
    """Hash the OTP using SHA-256 with a salt from environment for secure DB storage."""
    salt = os.getenv("SECRET_KEY", "ai-meeting-salt-2026")
    return hashlib.sha256(f"{otp_code}:{salt}".encode("utf-8")).hexdigest()


def verify_otp_hash(otp_code: str, stored_hash: str) -> bool:
    """Verify an OTP against a stored SHA-256 hash."""
    return hash_otp(otp_code) == stored_hash


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """
    Send an email via SMTP.
    If SMTP credentials are not configured (e.g. during offline local development),
    it logs the email details to console cleanly without throwing unhandled errors.
    """
    mail_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    mail_port = int(os.getenv("MAIL_PORT", "587"))
    mail_use_tls = os.getenv("MAIL_USE_TLS", "True").lower() in ("true", "1", "yes")
    mail_username = os.getenv("MAIL_USERNAME", "")
    mail_password = os.getenv("MAIL_PASSWORD", "")
    default_sender = os.getenv(
        "MAIL_DEFAULT_SENDER",
        f"AI Meeting Intelligence <{mail_username or 'no-reply@meetingintelligence.ai'}>"
    )

    # If credentials are not configured, log to console in dev mode
    if not mail_username or not mail_password:
        print(f"\n[EMAIL SERVICE DEV MOCK]")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body:\n{text_content or html_content}")
        print(f"[EMAIL SERVICE DEV MOCK END]\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = default_sender
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        if html_content:
            msg.attach(MIMEText(html_content, "html"))

        if mail_use_tls:
            server = smtplib.SMTP(mail_server, mail_port, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(mail_server, mail_port, timeout=10)

        server.login(mail_username, mail_password)
        server.send_message(msg)
        server.quit()
        print(f"Email successfully sent to {to_email}")
        return True
    except Exception as error:
        print(f"Failed to send email to {to_email}: {error}")
        return False


# ----------------------------------------------------------------------
# Professional HTML Email Templates
# ----------------------------------------------------------------------

def send_verification_email(to_email: str, user_name: str, otp_code: str) -> bool:
    """Send a 6-digit email verification OTP."""
    subject = f"{otp_code} is your AI Meeting Intelligence verification code"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }}
            .container {{ max-width: 520px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 36px; border: 1px solid #334155; }}
            .logo {{ font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; letter-spacing: -0.5px; }}
            h2 {{ color: #ffffff; margin-top: 0; font-size: 22px; }}
            p {{ color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 12px 0; }}
            .otp-box {{ background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 6px; text-align: center; padding: 18px; border-radius: 8px; margin: 28px 0; }}
            .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">AI Meeting Intelligence System</div>
            <h2>Verify Your Email Address</h2>
            <p>Hello <strong>{user_name}</strong>,</p>
            <p>Thank you for signing up. Please use the following 6-digit verification code to complete your registration and activate your account:</p>
            <div class="otp-box">{otp_code}</div>
            <p>This code will expire in <strong>10 minutes</strong>. If you did not create an account, you can safely ignore this email.</p>
            <div class="footer">
                &copy; 2026 AI Meeting Intelligence System. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    AI Meeting Intelligence System
    -----------------------------------
    Verify Your Email Address

    Hello {user_name},

    Your 6-digit verification code is: {otp_code}

    This code will expire in 10 minutes. If you did not request this, please ignore this email.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_password_reset_email(to_email: str, user_name: str, otp_code: str) -> bool:
    """Send a 6-digit password reset OTP."""
    subject = f"{otp_code} is your password reset code"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }}
            .container {{ max-width: 520px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 36px; border: 1px solid #334155; }}
            .logo {{ font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; letter-spacing: -0.5px; }}
            h2 {{ color: #ffffff; margin-top: 0; font-size: 22px; }}
            p {{ color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 12px 0; }}
            .otp-box {{ background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 6px; text-align: center; padding: 18px; border-radius: 8px; margin: 28px 0; }}
            .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">AI Meeting Intelligence System</div>
            <h2>Password Reset Request</h2>
            <p>Hello <strong>{user_name}</strong>,</p>
            <p>We received a request to reset the password for your account. Use the 6-digit code below to set a new password:</p>
            <div class="otp-box">{otp_code}</div>
            <p>This code will expire in <strong>15 minutes</strong>. If you did not request a password reset, please secure your account immediately.</p>
            <div class="footer">
                &copy; 2026 AI Meeting Intelligence System. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    AI Meeting Intelligence System
    -----------------------------------
    Password Reset Request

    Hello {user_name},

    Your 6-digit password reset code is: {otp_code}

    This code will expire in 15 minutes. If you did not request a password reset, please ignore this email.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_password_changed_notification(to_email: str, user_name: str) -> bool:
    """Send confirmation that password has been changed."""
    subject = "Your password has been changed - AI Meeting Intelligence"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }}
            .container {{ max-width: 520px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 36px; border: 1px solid #334155; }}
            .logo {{ font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; letter-spacing: -0.5px; }}
            h2 {{ color: #ffffff; margin-top: 0; font-size: 22px; }}
            p {{ color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 12px 0; }}
            .alert-box {{ background-color: #064e3b; border: 1px solid #059669; color: #6ee7b7; padding: 14px 18px; border-radius: 8px; margin: 20px 0; font-size: 14px; }}
            .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">AI Meeting Intelligence System</div>
            <h2>Password Changed Successfully</h2>
            <p>Hello <strong>{user_name}</strong>,</p>
            <div class="alert-box">Your account password was just changed successfully.</div>
            <p>If you made this change, no further action is required. If you did not make this change, please reset your password immediately or contact support.</p>
            <div class="footer">
                &copy; 2026 AI Meeting Intelligence System. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    AI Meeting Intelligence System
    -----------------------------------
    Password Changed Successfully

    Hello {user_name},

    Your account password was successfully updated. If you did not make this change, please reset your password immediately.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_meeting_invite_email(
    to_email: str,
    inviter_name: str,
    meeting_title: str,
    room_code: str,
    join_url: str
) -> bool:
    """Send an invitation to join a meeting room."""
    subject = f"Invitation: {meeting_title} ({room_code}) - AI Meeting Intelligence"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }}
            .container {{ max-width: 520px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 36px; border: 1px solid #334155; }}
            .logo {{ font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; letter-spacing: -0.5px; }}
            h2 {{ color: #ffffff; margin-top: 0; font-size: 22px; }}
            p {{ color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 12px 0; }}
            .meeting-card {{ background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 18px; margin: 20px 0; }}
            .meeting-title {{ font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }}
            .room-code {{ font-family: monospace; font-size: 16px; color: #38bdf8; font-weight: 600; }}
            .button {{ display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 14px; text-align: center; }}
            .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">AI Meeting Intelligence System</div>
            <h2>You are invited to a meeting</h2>
            <p><strong>{inviter_name}</strong> has invited you to join a video conference:</p>
            <div class="meeting-card">
                <div class="meeting-title">{meeting_title}</div>
                <div class="room-code">Room Code: {room_code}</div>
                <a href="{join_url}" class="button" target="_blank">Join Meeting Room</a>
            </div>
            <p>Or join directly using the room code <strong>{room_code}</strong> at {join_url}.</p>
            <div class="footer">
                &copy; 2026 AI Meeting Intelligence System. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    AI Meeting Intelligence System
    -----------------------------------
    You're invited to a meeting!

    {inviter_name} has invited you to join:
    Title: {meeting_title}
    Room Code: {room_code}
    Link: {join_url}
    """

    return send_email(to_email, subject, html_content, text_content)
