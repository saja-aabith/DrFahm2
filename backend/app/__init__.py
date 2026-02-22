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

    # ── Models ────────────────────────────────────────────
    with app.app_context():
        from . import models  # noqa: F401

    # ── Error handlers ────────────────────────────────────
    register_error_handlers(app)

    # ── Blueprints ────────────────────────────────────────
    from .api.auth import auth_bp
    app.register_blueprint(auth_bp)

    from .api.billing import billing_bp
    app.register_blueprint(billing_bp)

    from .api.exams import exams_bp
    app.register_blueprint(exams_bp)

    # Admin   — CHUNK 7
    # Schools — CHUNK 7
    # Events  — CHUNK 7

    # ── Health check ──────────────────────────────────────
    @app.route("/api/health")
    def health():
        return {"status": "ok", "service": "drfahm2-api"}

    return app