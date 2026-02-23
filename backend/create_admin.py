"""
Create the first DrFahm admin user.

Usage (Railway):
    railway run python create_admin.py --username saja --password YOUR_SECURE_PASSWORD

Usage (local):
    cd backend
    python create_admin.py --username saja --password YOUR_SECURE_PASSWORD

This is idempotent — if the username already exists, it will skip.
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.models.user import User, UserRole

app = create_app()


def main():
    parser = argparse.ArgumentParser(description="Create first admin user")
    parser.add_argument("--username", required=True, help="Admin username")
    parser.add_argument("--password", required=True, help="Admin password (min 8 chars)")
    parser.add_argument("--email", default=None, help="Admin email (optional)")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("ERROR: Password must be at least 8 characters.")
        sys.exit(1)

    with app.app_context():
        existing = User.query.filter_by(username=args.username).first()
        if existing:
            print(f"User '{args.username}' already exists (id={existing.id}, role={existing.role.value}). Skipping.")
            return

        admin = User(
            username=args.username,
            email=args.email,
            role=UserRole.DRFAHM_ADMIN,
        )
        admin.set_password(args.password)
        db.session.add(admin)
        db.session.commit()
        print(f"✅ Admin user '{args.username}' created (id={admin.id}).")
        print(f"   Login at: {app.config.get('FRONTEND_BASE_URL', '')}/login")


if __name__ == "__main__":
    main()
