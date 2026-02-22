# API blueprint registration lives in app/__init__.py
# This file intentionally minimal.

from flask import Flask
from .config import get_config
from .extensions import db, migrate, jwt
from .api.errors import register_error_handlers


def create_app():
    app = Flask(__name__)
    app.config.from_object(get_config())

    # ── Extensions ────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # ── Error handlers ────────────────────────────────────
    register_error_handlers(app)

    # ── Blueprints (registered as they are built) ─────────
    # Auth — CHUNK 3
    # Billing — CHUNK 4
    # Exams — CHUNK 5
    # Admin — CHUNK 7
    # Schools — CHUNK 7
    # Events — CHUNK 7

    # ── Health check ──────────────────────────────────────
    @app.route("/api/health")
    def health():
        return {"status": "ok", "service": "drfahm2-api"}

    return app