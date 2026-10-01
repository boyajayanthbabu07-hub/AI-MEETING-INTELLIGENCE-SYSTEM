import re
from datetime import datetime, timedelta

from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from werkzeug.security import check_password_hash, generate_password_hash

from backend.app.database import SessionLocal
from backend.models.models import (
    EmailVerificationOTP,
    PasswordResetOTP,
    User,
)
from backend.services.email_service import (
    generate_otp,
    hash_otp,
    send_password_changed_notification,
    send_password_reset_email,
    send_verification_email,
    verify_otp_hash,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


def is_valid_email(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    return bool(re.match(EMAIL_REGEX, email.strip()))


# ======================================================================
# 1. REGISTER
# ======================================================================

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return {
            "message": "Name, email, and password are required"
        }, 400

    if len(name) < 2:
        return {
            "message": "Name must be at least 2 characters long"
        }, 400

    if not is_valid_email(email):
        return {
            "message": "Please provide a valid email address"
        }, 400

    if len(password) < 6:
        return {
            "message": "Password must be at least 6 characters long"
        }, 400

    db = SessionLocal()

    try:
        existing_user = db.query(User).filter(User.email == email).first()

        # If user already registered and verified
        if existing_user and existing_user.is_verified:
            return {
                "message": "Email is already registered. Please login instead."
            }, 409

        password_hash = generate_password_hash(password)

        if existing_user and not existing_user.is_verified:
            # Update pending unverified account
            existing_user.name = name
            existing_user.password_hash = password_hash
            existing_user.updated_at = datetime.utcnow()
            user = existing_user
        else:
            # Create new unverified user
            user = User(
                name=name,
                email=email,
                password_hash=password_hash,
                is_verified=False,
            )
            db.add(user)

        db.commit()
        db.refresh(user)

        # Invalidate any prior active OTPs for this email
        db.query(EmailVerificationOTP).filter(
            EmailVerificationOTP.email == email,
            EmailVerificationOTP.is_used == False,
        ).update({"is_used": True})

        # Generate fresh 6-digit OTP (valid for 10 minutes)
        otp_code = generate_otp(6)
        otp_record = EmailVerificationOTP(
            user_id=user.id,
            email=email,
            otp_hash=hash_otp(otp_code),
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            is_used=False,
            attempts=0,
        )
        db.add(otp_record)
        db.commit()

        # Dispatch verification email (asynchronous or SMTP)
        send_verification_email(email, name, otp_code)

        return {
            "message": "Registration successful. Please verify your email with the 6-digit OTP sent to your inbox.",
            "email": user.email,
            "require_verification": True,
        }, 201

    except Exception as e:
        db.rollback()
        return {
            "message": "Registration failed",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 2. VERIFY EMAIL OTP
# ======================================================================

@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    otp_code = (data.get("otp") or "").strip()

    if not email or not otp_code:
        return {
            "message": "Email and 6-digit OTP code are required"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return {
                "message": "No account found with this email address"
            }, 404

        # Find latest unused OTP for this email
        otp_record = (
            db.query(EmailVerificationOTP)
            .filter(
                EmailVerificationOTP.email == email,
                EmailVerificationOTP.is_used == False,
            )
            .order_by(EmailVerificationOTP.created_at.desc())
            .first()
        )

        if not otp_record:
            return {
                "message": "No pending verification code found. Please request a new code."
            }, 400

        # Check expiration
        if datetime.utcnow() > otp_record.expires_at:
            otp_record.is_used = True
            db.commit()
            return {
                "message": "Verification code has expired. Please request a new code."
            }, 400

        # Check rate-limiting attempts
        if otp_record.attempts >= 5:
            otp_record.is_used = True
            db.commit()
            return {
                "message": "Too many failed attempts. This code is now invalid. Please request a new code."
            }, 429

        # Increment attempts
        otp_record.attempts += 1

        # Verify hash
        if not verify_otp_hash(otp_code, otp_record.otp_hash):
            db.commit()
            remaining = 5 - otp_record.attempts
            return {
                "message": f"Invalid verification code. {remaining} attempt(s) remaining."
            }, 400

        # Mark OTP used and verify user
        otp_record.is_used = True
        user.is_verified = True
        user.updated_at = datetime.utcnow()
        db.commit()

        # Issue JWT access token for immediate seamless login
        access_token = create_access_token(identity=str(user.id))

        return {
            "message": "Email verified successfully! Welcome to AI Meeting Intelligence.",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "is_verified": user.is_verified,
            },
        }, 200

    except Exception as e:
        db.rollback()
        return {
            "message": "Verification failed",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 3. RESEND VERIFICATION OTP
# ======================================================================

@auth_bp.route("/resend-verification", methods=["POST"])
def resend_verification():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email or not is_valid_email(email):
        return {
            "message": "A valid email address is required"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return {
                "message": "No account found with this email"
            }, 404

        if user.is_verified:
            return {
                "message": "This account is already verified. Please login."
            }, 400

        # Check cooldown (60 seconds)
        recent_otp = (
            db.query(EmailVerificationOTP)
            .filter(
                EmailVerificationOTP.email == email,
                EmailVerificationOTP.created_at >= datetime.utcnow() - timedelta(seconds=60),
            )
            .first()
        )

        if recent_otp:
            return {
                "message": "Please wait at least 60 seconds before requesting a new code."
            }, 429

        # Invalidate previous unused OTPs
        db.query(EmailVerificationOTP).filter(
            EmailVerificationOTP.email == email,
            EmailVerificationOTP.is_used == False,
        ).update({"is_used": True})

        # Generate new OTP
        otp_code = generate_otp(6)
        otp_record = EmailVerificationOTP(
            user_id=user.id,
            email=email,
            otp_hash=hash_otp(otp_code),
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            is_used=False,
            attempts=0,
        )
        db.add(otp_record)
        db.commit()

        send_verification_email(email, user.name, otp_code)

        return {
            "message": "A fresh verification code has been sent to your email."
        }, 200

    except Exception as e:
        db.rollback()
        return {
            "message": "Failed to resend verification code",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 4. LOGIN
# ======================================================================

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return {
            "message": "Email and password are required"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()

        if not user or not check_password_hash(user.password_hash, password):
            return {
                "message": "Invalid email or password"
            }, 401

        # Check if user is verified
        if not user.is_verified:
            # Generate fresh verification OTP
            otp_code = generate_otp(6)
            otp_record = EmailVerificationOTP(
                user_id=user.id,
                email=email,
                otp_hash=hash_otp(otp_code),
                expires_at=datetime.utcnow() + timedelta(minutes=10),
                is_used=False,
                attempts=0,
            )
            db.add(otp_record)
            db.commit()

            send_verification_email(email, user.name, otp_code)

            return {
                "message": "Your email address is not verified yet. A verification code has been sent to your email.",
                "require_verification": True,
                "email": user.email,
            }, 403

        access_token = create_access_token(identity=str(user.id))

        return {
            "message": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "is_verified": user.is_verified,
            },
        }, 200

    finally:
        db.close()


# ======================================================================
# 5. LOGOUT
# ======================================================================

@auth_bp.route("/logout", methods=["POST"])
@jwt_required(optional=True)
def logout():
    return {
        "message": "Logged out successfully"
    }, 200


# ======================================================================
# 6. GET CURRENT USER (ME)
# ======================================================================

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()

        if not user:
            return {
                "message": "User not found"
            }, 404

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }, 200

    finally:
        db.close()


# ======================================================================
# 7. FORGOT PASSWORD (REQUEST OTP)
# ======================================================================

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email or not is_valid_email(email):
        return {
            "message": "A valid email address is required"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()

        # For security, avoid leaking whether the email exists
        if not user:
            return {
                "message": "If an account exists with this email, a password reset code has been sent.",
                "email": email,
            }, 200

        # Check 60-second cooldown
        recent_otp = (
            db.query(PasswordResetOTP)
            .filter(
                PasswordResetOTP.email == email,
                PasswordResetOTP.created_at >= datetime.utcnow() - timedelta(seconds=60),
            )
            .first()
        )

        if recent_otp:
            return {
                "message": "Please wait at least 60 seconds before requesting another reset code."
            }, 429

        # Invalidate older reset OTPs
        db.query(PasswordResetOTP).filter(
            PasswordResetOTP.email == email,
            PasswordResetOTP.is_used == False,
        ).update({"is_used": True})

        # Generate 6-digit reset OTP (valid for 15 minutes)
        otp_code = generate_otp(6)
        reset_otp = PasswordResetOTP(
            user_id=user.id,
            email=email,
            otp_hash=hash_otp(otp_code),
            expires_at=datetime.utcnow() + timedelta(minutes=15),
            is_used=False,
            attempts=0,
        )
        db.add(reset_otp)
        db.commit()

        send_password_reset_email(email, user.name, otp_code)

        return {
            "message": "If an account exists with this email, a password reset code has been sent.",
            "email": email,
        }, 200

    except Exception as e:
        db.rollback()
        return {
            "message": "Failed to process password reset request",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 8. VERIFY RESET OTP
# ======================================================================

@auth_bp.route("/verify-reset-otp", methods=["POST"])
def verify_reset_otp():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    otp_code = (data.get("otp") or "").strip()

    if not email or not otp_code:
        return {
            "message": "Email and reset code are required"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return {
                "message": "Invalid request"
            }, 400

        otp_record = (
            db.query(PasswordResetOTP)
            .filter(
                PasswordResetOTP.email == email,
                PasswordResetOTP.is_used == False,
            )
            .order_by(PasswordResetOTP.created_at.desc())
            .first()
        )

        if not otp_record:
            return {
                "message": "No active reset request found. Please request a new code."
            }, 400

        if datetime.utcnow() > otp_record.expires_at:
            otp_record.is_used = True
            db.commit()
            return {
                "message": "Reset code has expired. Please request a new one."
            }, 400

        if otp_record.attempts >= 5:
            otp_record.is_used = True
            db.commit()
            return {
                "message": "Too many failed attempts. Please request a new reset code."
            }, 429

        otp_record.attempts += 1

        if not verify_otp_hash(otp_code, otp_record.otp_hash):
            db.commit()
            remaining = 5 - otp_record.attempts
            return {
                "message": f"Invalid reset code. {remaining} attempt(s) remaining."
            }, 400

        db.commit()

        return {
            "message": "Reset code verified successfully",
            "valid": True,
        }, 200

    except Exception as e:
        db.rollback()
        return {
            "message": "Verification failed",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 9. RESET PASSWORD (SUBMIT NEW PASSWORD)
# ======================================================================

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    otp_code = (data.get("otp") or "").strip()
    new_password = data.get("new_password") or ""

    if not email or not otp_code or not new_password:
        return {
            "message": "Email, reset code, and new password are required"
        }, 400

    if len(new_password) < 6:
        return {
            "message": "New password must be at least 6 characters long"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return {
                "message": "User not found"
            }, 404

        otp_record = (
            db.query(PasswordResetOTP)
            .filter(
                PasswordResetOTP.email == email,
                PasswordResetOTP.is_used == False,
            )
            .order_by(PasswordResetOTP.created_at.desc())
            .first()
        )

        if not otp_record or datetime.utcnow() > otp_record.expires_at:
            return {
                "message": "Reset code is invalid or has expired. Please request a new code."
            }, 400

        if not verify_otp_hash(otp_code, otp_record.otp_hash):
            return {
                "message": "Invalid reset code"
            }, 400

        # Mark OTP used and update password
        otp_record.is_used = True
        user.password_hash = generate_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        db.commit()

        # Send confirmation email
        send_password_changed_notification(email, user.name)

        return {
            "message": "Password reset successfully. You can now log in with your new password."
        }, 200

    except Exception as e:
        db.rollback()
        return {
            "message": "Password reset failed",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 10. CHANGE PASSWORD (AUTHENTICATED)
# ======================================================================

@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return {
            "message": "Current password and new password are required"
        }, 400

    if len(new_password) < 6:
        return {
            "message": "New password must be at least 6 characters long"
        }, 400

    if current_password == new_password:
        return {
            "message": "New password must be different from current password"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            return {
                "message": "User not found"
            }, 404

        if not check_password_hash(user.password_hash, current_password):
            return {
                "message": "Current password is incorrect"
            }, 400

        user.password_hash = generate_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        db.commit()

        send_password_changed_notification(user.email, user.name)

        return {
            "message": "Password updated successfully"
        }, 200

    except Exception as e:
        db.rollback()
        return {
            "message": "Failed to change password",
            "error": str(e)
        }, 500

    finally:
        db.close()


# ======================================================================
# 11. UPDATE PROFILE (AUTHENTICATED)
# ======================================================================

@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    name = data.get("name")
    avatar_url = data.get("avatar_url")

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            return {
                "message": "User not found"
            }, 404

        if name is not None:
            name_clean = name.strip()
            if len(name_clean) < 2:
                return {
                    "message": "Name must be at least 2 characters long"
                }, 400
            user.name = name_clean

        if avatar_url is not None:
            user.avatar_url = avatar_url.strip() if avatar_url else None

        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)

        return {
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "is_verified": user.is_verified,
            },
        }, 200

    except Exception as e:
        db.rollback()
        return {
            "message": "Failed to update profile",
            "error": str(e)
        }, 500

    finally:
        db.close()