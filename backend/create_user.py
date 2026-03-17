"""Admin CLI: 사용자 계정 생성

사용법:
    python -m backend.create_user <username> <password> [--admin]
"""
import sys

from backend.database import SessionLocal, engine
from backend import models
from backend.auth import hash_password

models.Base.metadata.create_all(bind=engine)


def create_user(username: str, password: str, is_admin: bool = False):
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.username == username).first()
        if existing:
            print(f"Error: user '{username}' already exists.")
            sys.exit(1)
        user = models.User(
            username=username,
            hashed_password=hash_password(password),
            is_admin=is_admin,
        )
        db.add(user)
        db.commit()
        role = "admin" if is_admin else "user"
        print(f"User '{username}' created successfully (id={user.id}, role={role}).")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m backend.create_user <username> <password> [--admin]")
        sys.exit(1)
    _is_admin = "--admin" in sys.argv
    create_user(sys.argv[1], sys.argv[2], is_admin=_is_admin)
