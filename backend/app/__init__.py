from flask import Flask
from flask_cors import CORS
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
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    # ── Models (must be imported before migrate) ──────────
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

    from .api.admin import admin_bp
    app.register_blueprint(admin_bp)

    from .api.schools import schools_bp
    app.register_blueprint(schools_bp)

    from .api.events import events_bp
    app.register_blueprint(events_bp)

    # ── Health check ──────────────────────────────────────
    @app.route("/api/health")
    def health():
        return {"status": "ok", "service": "drfahm2-api"}

    return app