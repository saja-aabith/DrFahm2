import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── Database ──────────────────────────────────────────
    # Railway gives postgres:// but SQLAlchemy 2.x requires postgresql://
    _raw_db_url = os.environ["DATABASE_URL"]
    SQLALCHEMY_DATABASE_URI = _raw_db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
    }

    # ── JWT ───────────────────────────────────────────────
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES  = 60 * 60            # 1 hour
    JWT_REFRESH_TOKEN_EXPIRES = 60 * 60 * 24 * 30  # 30 days

    # ── Stripe ────────────────────────────────────────────
    STRIPE_SECRET_KEY      = os.environ.get("STRIPE_SECRET_KEY", "sk_test_placeholder")
    STRIPE_WEBHOOK_SECRET  = os.environ.get("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
    STRIPE_PRICE_BASIC_3M  = os.environ.get("STRIPE_PRICE_BASIC_3M", "price_placeholder")
    STRIPE_PRICE_PREMIUM_1Y = os.environ.get("STRIPE_PRICE_PREMIUM_1Y", "price_placeholder")

    # ── URLs ──────────────────────────────────────────────
    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:3000")
    BACKEND_BASE_URL  = os.environ.get("BACKEND_BASE_URL", "http://localhost:5000")

    # ── CORS ──────────────────────────────────────────────
    # Comma-separated list of allowed origins
    # e.g. "https://drfahm.com,https://www.drfahm.com,http://localhost:3000"
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000"
    ).split(",")

    # ── Trial ─────────────────────────────────────────────
    TRIAL_DAYS = int(os.getenv("TRIAL_DAYS", "7"))

    # ── Admin cap ─────────────────────────────────────────
    MAX_DRFAHM_ADMINS = int(os.getenv("MAX_DRFAHM_ADMINS", "5"))

    # ── Progression ───────────────────────────────────────
    PASS_THRESHOLD_PCT = int(os.getenv("PASS_THRESHOLD_PCT", "100"))

    # ── Flask ─────────────────────────────────────────────
    JSON_SORT_KEYS = False


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


def get_config():
    env = os.getenv("FLASK_ENV", "development")
    if env == "production":
        return ProductionConfig
    return DevelopmentConfig