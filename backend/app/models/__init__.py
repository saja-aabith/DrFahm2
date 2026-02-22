# Import all models here so Flask-Migrate / Alembic can detect them.
# Order matters for FK resolution — parents before children.

from .org import Org                          # no FK deps
from .user import User                        # FK → Org
from .entitlement import Entitlement, ExamTrial  # FK → User, Org
from .question import Question               # FK → User (admin refs)
from .progress import LevelProgress, WorldProgress  # FK → User
from .billing import StripeEvent             # no FK deps
from .events import AppEvent                 # FK → User (nullable)
from .leads import Lead                      # no FK deps

__all__ = [
    "Org",
    "User",
    "Entitlement",
    "ExamTrial",
    "Question",
    "LevelProgress",
    "WorldProgress",
    "StripeEvent",
    "AppEvent",
    "Lead",
]