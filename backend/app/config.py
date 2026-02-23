import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── Database ──────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
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
    STRIPE_SECRET_KEY      = os.environ["STRIPE_SECRET_KEY"]
    STRIPE_WEBHOOK_SECRET  = os.environ["STRIPE_WEBHOOK_SECRET"]
    STRIPE_PRICE_BASIC_3M  = os.environ["STRIPE_PRICE_BASIC_3M"]
    STRIPE_PRICE_PREMIUM_1Y = os.environ["STRIPE_PRICE_PREMIUM_1Y"]

    # ── URLs ──────────────────────────────────────────────
    FRONTEND_BASE_URL = os.environ["FRONTEND_BASE_URL"]
    BACKEND_BASE_URL  = os.environ["BACKEND_BASE_URL"]

    # ── Trial ─────────────────────────────────────────────
    TRIAL_DAYS = int(os.getenv("TRIAL_DAYS", "7"))

    # ── Admin cap ─────────────────────────────────────────
    MAX_DRFAHM_ADMINS = int(os.getenv("MAX_DRFAHM_ADMINS", "5"))

    # ── Progression ───────────────────────────────────────
    # Minimum percentage of correct answers to pass a level (0–100)
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