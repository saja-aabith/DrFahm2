"""
backend/seed_questions.py

Seeds the question bank directly into the database from a JSON file.

Usage:
    cd backend
    python seed_questions.py --file seed_data/qudurat_all_questions.json

Each record in the JSON must have:
    exam, world_key, index, question_text,
    option_a, option_b, option_c, option_d,
    correct_answer, is_active

Optional fields:
    topic, difficulty

Rules:
- correct_answer defaults to "a" (placeholder) if missing.
- is_active defaults to False if missing (questions locked until admin reviews).
- Uses SQLAlchemy merge (upsert) on (exam, world_key, index).
- Safe to run multiple times — idempotent.
- Will NOT overwrite correct_answer if it has already been set to something
  other than "a" by an admin (preserves reviewed answers).
"""

import argparse
import json
import sys
import os

# ── Bootstrap Flask app context ───────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import create_app
from app.extensions import db
from app.models.question import Question, Difficulty
from app.utils.world_config import VALID_WORLD_KEYS, VALID_EXAMS

app = create_app()

VALID_ANSWERS  = {"a", "b", "c", "d"}
VALID_DIFFICULTY = {d.value for d in Difficulty} | {None}


def validate_record(rec: dict, line_num: int) -> list[str]:
    """Returns list of error strings for a record. Empty = valid."""
    errors = []
    for field in ["exam", "world_key", "index", "question_text",
                  "option_a", "option_b", "option_c", "option_d"]:
        if not rec.get(field) and rec.get(field) != 0:
            errors.append(f"[{line_num}] Missing required field: {field}")

    if rec.get("exam") and rec["exam"] not in VALID_EXAMS:
        errors.append(f"[{line_num}] Invalid exam: {rec['exam']!r}")

    if rec.get("world_key") and rec["world_key"] not in VALID_WORLD_KEYS:
        errors.append(f"[{line_num}] Invalid world_key: {rec['world_key']!r}")

    if rec.get("correct_answer") and rec["correct_answer"] not in VALID_ANSWERS:
        errors.append(f"[{line_num}] Invalid correct_answer: {rec['correct_answer']!r}")

    try:
        idx = int(rec.get("index", 0))
        if idx < 1:
            errors.append(f"[{line_num}] index must be >= 1")
    except (ValueError, TypeError):
        errors.append(f"[{line_num}] index must be an integer")

    return errors


def seed(json_path: str, dry_run: bool = False):
    with open(json_path, encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list):
        print("ERROR: JSON file must contain a top-level array.")
        sys.exit(1)

    print(f"Loaded {len(records)} records from {json_path}")

    # ── Validate all records before touching DB ──
    all_errors = []
    for i, rec in enumerate(records):
        all_errors.extend(validate_record(rec, i + 1))

    if all_errors:
        print(f"\n{len(all_errors)} validation error(s) found:")
        for e in all_errors[:20]:
            print(f"  {e}")
        if len(all_errors) > 20:
            print(f"  ... and {len(all_errors) - 20} more")
        print("\nAborted — fix errors and re-run.")
        sys.exit(1)

    if dry_run:
        print("Dry run — validation passed. No DB changes made.")
        return

    # ── Upsert into DB ────────────────────────────────────────────────────────
    inserted = 0
    updated  = 0
    skipped  = 0

    with app.app_context():
        for rec in records:
            exam      = rec["exam"]
            world_key = rec["world_key"]
            index     = int(rec["index"])

            existing = Question.query.filter_by(
                exam=exam, world_key=world_key, index=index
            ).first()

            if existing:
                # Update content fields — but NEVER overwrite a reviewed answer
                existing.question_text = rec["question_text"]
                existing.option_a      = rec["option_a"]
                existing.option_b      = rec["option_b"]
                existing.option_c      = rec["option_c"]
                existing.option_d      = rec["option_d"]
                existing.topic         = rec.get("topic")

                diff = rec.get("difficulty")
                if diff and diff in {d.value for d in Difficulty}:
                    existing.difficulty = Difficulty(diff)

                # Only overwrite correct_answer if it is still the placeholder
                if existing.correct_answer == "a" and not existing.is_active:
                    existing.correct_answer = rec.get("correct_answer", "a")

                # is_active: only set to False if currently False (don't re-lock reviewed)
                if not existing.is_active:
                    existing.is_active = rec.get("is_active", False)

                existing.version += 1
                updated += 1
            else:
                q = Question(
                    exam=exam,
                    world_key=world_key,
                    index=index,
                    question_text=rec["question_text"],
                    option_a=rec["option_a"],
                    option_b=rec["option_b"],
                    option_c=rec["option_c"],
                    option_d=rec["option_d"],
                    correct_answer=rec.get("correct_answer", "a"),
                    is_active=rec.get("is_active", False),
                    topic=rec.get("topic"),
                    difficulty=Difficulty(rec["difficulty"])
                                if rec.get("difficulty")
                                   and rec["difficulty"] in {d.value for d in Difficulty}
                                else None,
                )
                db.session.add(q)
                inserted += 1

            # Commit in batches of 100
            if (inserted + updated) % 100 == 0:
                db.session.commit()
                print(f"  Progress: {inserted + updated}/{len(records)}...")

        db.session.commit()

    print(f"\n✅ Done.")
    print(f"   Inserted: {inserted}")
    print(f"   Updated:  {updated}")
    print(f"   Skipped:  {skipped}")
    print(f"\n⚠️  All questions imported with is_active=False and correct_answer='a' (placeholder).")
    print(f"   Use the DrFahm Admin UI (Chunk 7) to review each question,")
    print(f"   set the correct answer, and activate them.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed question bank from JSON file.")
    parser.add_argument("--file", required=True, help="Path to JSON file")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate without writing to DB")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)

    seed(args.file, dry_run=args.dry_run)