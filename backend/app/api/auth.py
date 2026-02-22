from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from functools import wraps

from ..extensions import db
from ..models.user import User, UserRole
from ..api.errors import bad_request, unauthorized, forbidden

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ── Role enforcement decorators ───────────────────────────────────────────────

def roles_required(*roles: UserRole):
    """
    Decorator: requires a valid JWT AND that the current user's role
    is in the allowed set.

    Usage:
        @roles_required(UserRole.DRFAHM_ADMIN)
        @roles_required(UserRole.DRFAHM_ADMIN, UserRole.SCHOOL_LEADER)
    """
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = _get_current_user()
            if user is None:
                return unauthorized("User not found.")
            if not user.is_active:
                return forbidden("account_inactive", "Your account has been deactivated.")
            if user.role not in roles:
                return forbidden(
                    "insufficient_role",
                    f"Required role(s): {[r.value for r in roles]}. "
                    f"Your role: {user.role.value}."
                )
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_auth(fn):
    """
    Decorator: requires valid JWT + active account. Any role allowed.
    """
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = _get_current_user()
        if user is None:
            return unauthorized("User not found.")
        if not user.is_active:
            return forbidden("account_inactive", "Your account has been deactivated.")
        return fn(*args, **kwargs)
    return wrapper


def _get_current_user() -> User | None:
    """Fetch User from DB using JWT identity (user id stored as string)."""
    user_id = get_jwt_identity()
    if user_id is None:
        return None
    return db.session.get(User, int(user_id))


# ── POST /api/auth/register ───────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Public registration. Creates student accounts only.
    drfahm_admin and school_leader are created by DrFahm Admin — not here.
    """
    data = request.get_json(silent=True) or {}

    # ── Validate required fields ──
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    email    = (data.get("email") or "").strip() or None

    if not username:
        return bad_request("validation_error", "username is required.")
    if len(username) < 3 or len(username) > 80:
        return bad_request("validation_error",
                           "username must be 3–80 characters.")
    if not password:
        return bad_request("validation_error", "password is required.")
    if len(password) < 8:
        return bad_request("validation_error",
                           "password must be at least 8 characters.")
    if email and len(email) > 255:
        return bad_request("validation_error", "email is too long.")

    # ── Uniqueness checks ──
    if User.query.filter_by(username=username).first():
        return bad_request("username_taken", "That username is already taken.")
    if email and User.query.filter_by(email=email).first():
        return bad_request("email_taken", "That email is already registered.")

    # ── Create user ──
    user = User(username=username, email=email, role=UserRole.STUDENT)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    access_token  = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "user":          user.to_dict(),
        "access_token":  access_token,
        "refresh_token": refresh_token,
    }), 201


# ── POST /api/auth/login ──────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Login with username or email + password.
    Returns access_token and refresh_token.
    """
    data = request.get_json(silent=True) or {}

    identifier = (data.get("username") or data.get("email") or "").strip()
    password   = (data.get("password") or "").strip()

    if not identifier:
        return bad_request("validation_error",
                           "username or email is required.")
    if not password:
        return bad_request("validation_error", "password is required.")

    # Find user by username or email
    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user or not user.check_password(password):
        # Deliberately vague — do not reveal which field was wrong
        return unauthorized("Invalid credentials.")

    if not user.is_active:
        return forbidden("account_inactive",
                         "Your account has been deactivated. "
                         "Contact support for assistance.")

    access_token  = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "user":          user.to_dict(),
        "access_token":  access_token,
        "refresh_token": refresh_token,
    }), 200


# ── POST /api/auth/refresh ────────────────────────────────────────────────────

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """
    Exchange a valid refresh token for a new access token.
    Refresh token must be sent in Authorization: Bearer <refresh_token>.
    """
    user_id = get_jwt_identity()
    user    = db.session.get(User, int(user_id))

    if not user:
        return unauthorized("User not found.")
    if not user.is_active:
        return forbidden("account_inactive", "Your account has been deactivated.")

    new_access_token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": new_access_token}), 200


# ── GET /api/auth/me ──────────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
@require_auth
def me():
    """Returns the currently authenticated user's profile."""
    user = _get_current_user()
    return jsonify({"user": user.to_dict()}), 200


# ── POST /api/auth/logout ─────────────────────────────────────────────────────

@auth_bp.route("/logout", methods=["POST"])
@jwt_required(optional=True)
def logout():
    """
    MVP: JWT is stateless — actual invalidation is done client-side
    by removing tokens from localStorage.
    This endpoint exists so clients have a consistent logout call target.
    POST-MVP: add server-side token blocklist (Redis or DB).
    """
    return jsonify({"message": "Logged out successfully."}), 200