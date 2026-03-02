"""
Backfill last_reviewed_at for questions already reviewed.

BACKGROUND:
  The old review progress tracking used a heuristic: correct_answer != 'a'
  meant "reviewed" (because all placeholder answers were seeded as 'a').
  This was buggy — questions where the REAL answer IS 'a' could never be
  counted as reviewed.

  The new system uses last_reviewed_at (timestamp) as the source of truth.
  This script backfills that timestamp for questions that were already
  reviewed under the old heuristic, so no team work is lost.

SAFETY:
  - Only updates rows where last_reviewed_at IS NULL
  - Never overwrites existing review timestamps
  - Uses the question's updated_at as the review timestamp (best available proxy)
  - Runs in a single transaction — all-or-nothing
  - Prints before/after counts for verification
  - Can be run multiple times safely (idempotent)

USAGE:
  # From the backend directory with FLASK_APP and DATABASE_URL set:
  python -m scripts.backfill_reviews

  # Or with explicit database URL:
  DATABASE_URL=postgresql://... python -m scripts.backfill_reviews

  # Dry run (prints what would happen without committing):
  python -m scripts.backfill_reviews --dry-run
"""

import os
import sys
import argparse
from datetime import datetime, timezone

import sqlalchemy as sa


def get_engine():
    """Create engine from DATABASE_URL environment variable."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL environment variable not set.")
        print("Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname")
        sys.exit(1)
    return sa.create_engine(url)


def backfill(dry_run=False):
    engine = get_engine()

    with engine.connect() as conn:
        # ── Current state ──
        total = conn.execute(sa.text(
            "SELECT COUNT(*) FROM questions WHERE deleted_at IS NULL"
        )).scalar()

        already_reviewed = conn.execute(sa.text(
            "SELECT COUNT(*) FROM questions "
            "WHERE deleted_at IS NULL AND last_reviewed_at IS NOT NULL"
        )).scalar()

        needs_backfill = conn.execute(sa.text(
            "SELECT COUNT(*) FROM questions "
            "WHERE deleted_at IS NULL "
            "AND last_reviewed_at IS NULL "
            "AND correct_answer != 'a'"
        )).scalar()

        answer_is_a_unreviewed = conn.execute(sa.text(
            "SELECT COUNT(*) FROM questions "
            "WHERE deleted_at IS NULL "
            "AND last_reviewed_at IS NULL "
            "AND correct_answer = 'a'"
        )).scalar()

        print("=" * 60)
        print("BACKFILL REVIEW TIMESTAMPS")
        print("=" * 60)
        print(f"Total questions:              {total}")
        print(f"Already have reviewed_at:     {already_reviewed}")
        print(f"Need backfill (answer != a):  {needs_backfill}")
        print(f"Answer is 'a', unreviewed:    {answer_is_a_unreviewed}")
        print(f"  (these need manual ✓ Confirm in admin panel)")
        print("-" * 60)

        if needs_backfill == 0:
            print("Nothing to backfill. All done!")
            return

        if dry_run:
            print(f"DRY RUN: Would set last_reviewed_at for {needs_backfill} questions.")
            print("Run without --dry-run to apply.")
            return

        # ── Backfill ──
        # Use updated_at as best proxy for when the review happened.
        # Only touch rows where last_reviewed_at IS NULL.
        result = conn.execute(sa.text("""
            UPDATE questions
            SET last_reviewed_at = updated_at
            WHERE deleted_at IS NULL
              AND last_reviewed_at IS NULL
              AND correct_answer != 'a'
        """))
        conn.commit()

        affected = result.rowcount
        print(f"✓ Backfilled last_reviewed_at for {affected} questions.")

        # ── Verify ──
        new_reviewed = conn.execute(sa.text(
            "SELECT COUNT(*) FROM questions "
            "WHERE deleted_at IS NULL AND last_reviewed_at IS NOT NULL"
        )).scalar()

        remaining_unreviewed = conn.execute(sa.text(
            "SELECT COUNT(*) FROM questions "
            "WHERE deleted_at IS NULL AND last_reviewed_at IS NULL"
        )).scalar()

        print(f"Total reviewed now:           {new_reviewed}")
        print(f"Remaining unreviewed:         {remaining_unreviewed}")
        print(f"  (use ✓ Confirm button for questions where answer IS 'a')")
        print("=" * 60)
        print("DONE — no data was lost, no answers were changed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill last_reviewed_at timestamps")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without committing")
    args = parser.parse_args()

    backfill(dry_run=args.dry_run)
