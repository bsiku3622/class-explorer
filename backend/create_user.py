"""Admin CLI: 사용자 계정 생성

가입 창구가 없어서 계정은 여기서만 만들어집니다.

사용법:
    python -m backend.create_user <username> <password> [--manager | --admin]
"""
import sys

from backend.database import SessionLocal, init_schema
from backend import models
from backend.auth import hash_password

init_schema()


def create_user(username: str, password: str, role: str = "user"):
    if role not in models.ROLES:
        print(f"Error: unknown role '{role}'. Use one of {', '.join(models.ROLES)}.")
        sys.exit(1)
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.username == username).first()
        if existing:
            print(f"Error: user '{username}' already exists.")
            sys.exit(1)
        user = models.User(
            username=username,
            hashed_password=hash_password(password),
            role=role,
        )
        db.add(user)
        db.commit()
        print(f"User '{username}' created successfully (id={user.id}, role={role}).")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m backend.create_user <username> <password> [--manager | --admin]")
        sys.exit(1)
    _role = "admin" if "--admin" in sys.argv else "manager" if "--manager" in sys.argv else "user"
    create_user(sys.argv[1], sys.argv[2], role=_role)
