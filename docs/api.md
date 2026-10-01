# API Reference Documentation

Base URL: `http://127.0.0.1:5000/api` (or LAN IP e.g. `http://192.168.0.108:5000/api`)

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1 Register
- **Endpoint**: `POST /api/auth/register`
- **Description**: Creates a new unverified user account and generates a 6-digit email verification OTP.
- **Request Body**:
  ```json
  {
    "name": "Alex Mercer",
    "email": "alex@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "message": "Registration successful. Please verify your email with the 6-digit OTP sent to your inbox.",
    "email": "alex@example.com",
    "require_verification": true
  }
  ```

---

### 1.2 Verify Email OTP
- **Endpoint**: `POST /api/auth/verify-email`
- **Description**: Verifies a 6-digit OTP, marks the account as verified, and returns a JWT access token.
- **Request Body**:
  ```json
  {
    "email": "alex@example.com",
    "otp": "485029"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Email verified successfully! Welcome to AI Meeting Intelligence.",
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 3,
      "name": "Alex Mercer",
      "email": "alex@example.com",
      "avatar_url": null,
      "is_verified": true
    }
  }
  ```

---

### 1.3 Resend Verification OTP
- **Endpoint**: `POST /api/auth/resend-verification`
- **Description**: Generates and emails a new 6-digit verification OTP (subject to 60s cooldown).
- **Request Body**:
  ```json
  {
    "email": "alex@example.com"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "A fresh verification code has been sent to your email."
  }
  ```

---

### 1.4 Login
- **Endpoint**: `POST /api/auth/login`
- **Description**: Authenticates user credentials. Rejects unverified accounts with 403 and automatically dispatches a fresh verification code.
- **Request Body**:
  ```json
  {
    "email": "alex@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 3,
      "name": "Alex Mercer",
      "email": "alex@example.com",
      "avatar_url": null,
      "is_verified": true
    }
  }
  ```

---

### 1.5 Logout
- **Endpoint**: `POST /api/auth/logout`
- **Headers**: `Authorization: Bearer <access_token>` (optional)
- **Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

### 1.6 Get Current User (`/me`)
- **Endpoint**: `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <access_token>` (required)
- **Response (200 OK)**:
  ```json
  {
    "id": 3,
    "name": "Alex Mercer",
    "email": "alex@example.com",
    "avatar_url": null,
    "is_verified": true,
    "created_at": "2026-10-01T20:41:00"
  }
  ```

---

### 1.7 Update Profile
- **Endpoint**: `PUT /api/auth/profile`
- **Headers**: `Authorization: Bearer <access_token>` (required)
- **Request Body**:
  ```json
  {
    "name": "Alex Mercer Updated",
    "avatar_url": "https://example.com/avatar.jpg"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Profile updated successfully",
    "user": {
      "id": 3,
      "name": "Alex Mercer Updated",
      "email": "alex@example.com",
      "avatar_url": "https://example.com/avatar.jpg",
      "is_verified": true
    }
  }
  ```

---

### 1.8 Change Password
- **Endpoint**: `POST /api/auth/change-password`
- **Headers**: `Authorization: Bearer <access_token>` (required)
- **Request Body**:
  ```json
  {
    "current_password": "SecurePassword123!",
    "new_password": "NewSuperSecret456!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Password updated successfully"
  }
  ```

---

### 1.9 Forgot Password (Request Reset OTP)
- **Endpoint**: `POST /api/auth/forgot-password`
- **Request Body**:
  ```json
  {
    "email": "alex@example.com"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "If an account exists with this email, a password reset code has been sent.",
    "email": "alex@example.com"
  }
  ```

---

### 1.10 Verify Reset OTP
- **Endpoint**: `POST /api/auth/verify-reset-otp`
- **Request Body**:
  ```json
  {
    "email": "alex@example.com",
    "otp": "610477"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Reset code verified successfully",
    "valid": true
  }
  ```

---

### 1.11 Reset Password
- **Endpoint**: `POST /api/auth/reset-password`
- **Request Body**:
  ```json
  {
    "email": "alex@example.com",
    "otp": "610477",
    "new_password": "CompletelyNewPassword789!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Password reset successfully. You can now log in with your new password."
  }
  ```
