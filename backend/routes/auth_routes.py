from flask import Blueprint, request
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from backend.app.database import SessionLocal
from backend.models.models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return {
            "message": "Name, email and password are required"
        }, 400

    db = SessionLocal()

    try:
        existing_user = db.query(User).filter(User.email == email).first()

        if existing_user:
            return {
                "message": "Email already registered"
            }, 409

        password_hash = generate_password_hash(password)

        user = User(
            name=name,
            email=email,
            password_hash=password_hash
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        }, 201

    except Exception as e:
        db.rollback()

        return {
            "message": "Registration failed",
            "error": str(e)
        }, 500

    finally:
        db.close()


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return {
            "message": "Email and password are required"
        }, 400

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()

        if not user:
            return {
                "message": "Invalid email or password"
            }, 401

        if not check_password_hash(user.password_hash, password):
            return {
                "message": "Invalid email or password"
            }, 401

        access_token = create_access_token(
            identity=str(user.id)
        )

        return {
            "message": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        }, 200

    finally:
        db.close()


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
            "email": user.email
        }, 200

    finally:
        db.close()