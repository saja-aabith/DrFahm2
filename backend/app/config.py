import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── Database ──────────────────────────────────────────────────────────────
    # Railway gives postgres:// but SQLAlchemy 2.x requires postgresql://
    _raw_db_url = os.environ["DATABASE_URL"]
    SQLALCHEMY_DATABASE_URI = _raw_db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
    }

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY                = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES      = 60 * 60            # 1 hour
    JWT_REFRESH_TOKEN_EXPIRES     = 60 * 60 * 24 * 30  # 30 days

    # ── Stripe — keys ─────────────────────────────────────────────────────────
    STRIPE_SECRET_KEY     = os.environ.get("STRIPE_SECRET_KEY",     "sk_test_placeholder")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")

    # ── Stripe — individual plan Price IDs (one per exam × plan) ─────────────
    # Create these in your Stripe dashboard as one-time prices in SAR.
    # Individual: Basic = SAR 199, Premium = SAR 299
    STRIPE_PRICE_BASIC_QUDURAT   = os.environ.get("STRIPE_PRICE_BASIC_QUDURAT",   "price_placeholder")
    STRIPE_PRICE_BASIC_TAHSILI   = os.environ.get("STRIPE_PRICE_BASIC_TAHSILI",   "price_placeholder")
    STRIPE_PRICE_PREMIUM_QUDURAT = os.environ.get("STRIPE_PRICE_PREMIUM_QUDURAT", "price_placeholder")
    STRIPE_PRICE_PREMIUM_TAHSILI = os.environ.get("STRIPE_PRICE_PREMIUM_TAHSILI", "price_placeholder")

    # ── School pricing (halalas — SAR × 100) ─────────────────────────────────
    # School checkout sessions use price_data (dynamic amount), not Price IDs.
    SCHOOL_PRICE_STANDARD_HALALAS = int(os.environ.get("SCHOOL_PRICE_STANDARD_HALALAS", "9900"))   # SAR 99
    SCHOOL_PRICE_VOLUME_HALALAS   = int(os.environ.get("SCHOOL_PRICE_VOLUME_HALALAS",   "7500"))   # SAR 75
    SCHOOL_VOLUME_MIN_STUDENTS    = int(os.environ.get("SCHOOL_VOLUME_MIN_STUDENTS",    "100"))

    # ── URLs ──────────────────────────────────────────────────────────────────
    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:3000")
    BACKEND_BASE_URL  = os.environ.get("BACKEND_BASE_URL",  "http://localhost:5000")

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000",
    ).split(",")

    # ── Trial ─────────────────────────────────────────────────────────────────
    TRIAL_DAYS = int(os.getenv("TRIAL_DAYS", "7"))

    # ── Admin cap ─────────────────────────────────────────────────────────────
    MAX_DRFAHM_ADMINS = int(os.getenv("MAX_DRFAHM_ADMINS", "5"))

    # ── Progression ───────────────────────────────────────────────────────────
    PASS_THRESHOLD_PCT = int(os.getenv("PASS_THRESHOLD_PCT", "100"))

    # ── Flask ─────────────────────────────────────────────────────────────────
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