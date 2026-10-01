import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal
from backend.app.main import app
from backend.models.models import (
    EmailVerificationOTP,
    PasswordResetOTP,
    User,
)
from backend.services.email_service import hash_otp


class TestAuthBackend(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.test_email = "test_autouser_phase3@example.com"
        self.test_password = "SecurePassword123!"
        self.test_name = "Auth Test User"

        # Cleanup test user if exists
        db = SessionLocal()
        user = db.query(User).filter(User.email == self.test_email).first()
        if user:
            db.query(EmailVerificationOTP).filter(EmailVerificationOTP.email == self.test_email).delete()
            db.query(PasswordResetOTP).filter(PasswordResetOTP.email == self.test_email).delete()
            db.delete(user)
            db.commit()
        db.close()

    def tearDown(self):
        db = SessionLocal()
        user = db.query(User).filter(User.email == self.test_email).first()
        if user:
            db.query(EmailVerificationOTP).filter(EmailVerificationOTP.email == self.test_email).delete()
            db.query(PasswordResetOTP).filter(PasswordResetOTP.email == self.test_email).delete()
            db.delete(user)
            db.commit()
        db.close()

    def test_01_registration_validation(self):
        # Missing fields
        res = self.client.post("/api/auth/register", json={})
        self.assertEqual(res.status_code, 400)

        # Invalid email
        res = self.client.post("/api/auth/register", json={
            "name": "Test",
            "email": "invalid-email-address",
            "password": "123"
        })
        self.assertEqual(res.status_code, 400)

        # Short password
        res = self.client.post("/api/auth/register", json={
            "name": "Test",
            "email": self.test_email,
            "password": "123"
        })
        self.assertEqual(res.status_code, 400)

    def test_02_registration_and_email_verification_flow(self):
        # 1. Register
        res = self.client.post("/api/auth/register", json={
            "name": self.test_name,
            "email": self.test_email,
            "password": self.test_password,
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["require_verification"])

        # 2. Check unverified login attempt
        res_login = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password,
        })
        self.assertEqual(res_login.status_code, 403)
        self.assertTrue(res_login.get_json()["require_verification"])

        # 3. Retrieve OTP from DB to simulate user receiving email
        db = SessionLocal()
        user = db.query(User).filter(User.email == self.test_email).first()
        self.assertFalse(user.is_verified)
        
        # In a real test, set a known OTP hash
        known_otp = "123456"
        otp_record = (
            db.query(EmailVerificationOTP)
            .filter(EmailVerificationOTP.email == self.test_email, EmailVerificationOTP.is_used == False)
            .first()
        )
        self.assertIsNotNone(otp_record)
        otp_record.otp_hash = hash_otp(known_otp)
        db.commit()
        db.close()

        # 4. Try wrong OTP
        res_wrong = self.client.post("/api/auth/verify-email", json={
            "email": self.test_email,
            "otp": "999999",
        })
        self.assertEqual(res_wrong.status_code, 400)

        # 5. Submit correct OTP
        res_verify = self.client.post("/api/auth/verify-email", json={
            "email": self.test_email,
            "otp": known_otp,
        })
        self.assertEqual(res_verify.status_code, 200)
        verify_data = res_verify.get_json()
        self.assertIn("access_token", verify_data)
        self.assertTrue(verify_data["user"]["is_verified"])

        # 6. Test login with verified account
        res_valid_login = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password,
        })
        self.assertEqual(res_valid_login.status_code, 200)
        token = res_valid_login.get_json()["access_token"]

        # 7. Test /api/auth/me
        res_me = self.client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.get_json()["email"], self.test_email)

        # 8. Test /api/auth/profile update
        res_profile = self.client.put("/api/auth/profile", headers={
            "Authorization": f"Bearer {token}"
        }, json={
            "name": "Updated Name",
            "avatar_url": "https://example.com/avatar.png"
        })
        self.assertEqual(res_profile.status_code, 200)
        self.assertEqual(res_profile.get_json()["user"]["name"], "Updated Name")

        # 9. Test password change
        res_change_pw = self.client.post("/api/auth/change-password", headers={
            "Authorization": f"Bearer {token}"
        }, json={
            "current_password": self.test_password,
            "new_password": "NewSecretPassword456!",
        })
        self.assertEqual(res_change_pw.status_code, 200)

        # 10. Login with new password
        res_new_login = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": "NewSecretPassword456!",
        })
        self.assertEqual(res_new_login.status_code, 200)

    def test_03_forgot_and_reset_password_flow(self):
        # Create a verified user
        self.client.post("/api/auth/register", json={
            "name": self.test_name,
            "email": self.test_email,
            "password": self.test_password,
        })
        db = SessionLocal()
        user = db.query(User).filter(User.email == self.test_email).first()
        user.is_verified = True
        db.commit()
        db.close()

        # Request forgot password
        res_forgot = self.client.post("/api/auth/forgot-password", json={
            "email": self.test_email
        })
        self.assertEqual(res_forgot.status_code, 200)

        # Set known reset OTP
        known_reset_otp = "654321"
        db = SessionLocal()
        reset_record = (
            db.query(PasswordResetOTP)
            .filter(PasswordResetOTP.email == self.test_email, PasswordResetOTP.is_used == False)
            .first()
        )
        self.assertIsNotNone(reset_record)
        reset_record.otp_hash = hash_otp(known_reset_otp)
        db.commit()
        db.close()

        # Verify reset OTP
        res_verify_otp = self.client.post("/api/auth/verify-reset-otp", json={
            "email": self.test_email,
            "otp": known_reset_otp
        })
        self.assertEqual(res_verify_otp.status_code, 200)
        self.assertTrue(res_verify_otp.get_json()["valid"])

        # Reset password
        res_reset = self.client.post("/api/auth/reset-password", json={
            "email": self.test_email,
            "otp": known_reset_otp,
            "new_password": "CompletelyNewPassword789!"
        })
        self.assertEqual(res_reset.status_code, 200)

        # Login with reset password
        res_login = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": "CompletelyNewPassword789!"
        })
        self.assertEqual(res_login.status_code, 200)


if __name__ == "__main__":
    unittest.main()
