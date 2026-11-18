"""Credential hashing, opaque session tokens and simple role permissions (Prisma ORM)."""
import hashlib
import hmac
import secrets
import time
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from prisma import Prisma
from db import User, get_db

roles = {'viewer': 0, 'editor': 1, 'operator': 2, 'admin': 3, 'superadmin': 4}
auth_header = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError('Password must contain at least 12 characters')
    salt = secrets.token_bytes(16)
    value = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 380000)
    return 'pbkdf2_sha256$380000$' + salt.hex() + '$' + value.hex()


def check_password(password: str, hashval: str) -> bool:
    try:
        algo, rounds, salt, val = hashval.split('$')
        if algo != 'pbkdf2_sha256':
            return False
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(actual, bytes.fromhex(val))
    except (ValueError, TypeError):
        return False


def current_user(
    req: Request,
    token: HTTPAuthorizationCredentials = Depends(auth_header),
    db: Prisma = Depends(get_db),
) -> User:
    raw_token = token.credentials if token else req.query_params.get('token', '').strip()
    if not raw_token:
        raise HTTPException(401, 'Login required')
    signature = hashlib.sha256(raw_token.encode()).hexdigest()
    sess = db.sessiontoken.find_unique(where={'token_hash': signature})
    if not sess or sess.expires < time.time():
        raise HTTPException(401, 'Session expired')
    user = db.user.find_unique(where={'id': sess.user_id}) if sess.user_id is not None else None
    if not user or not user.enabled:
        raise HTTPException(401, 'Account disabled')
    return user


def require(min_role: str):
    def guard(user: User = Depends(current_user)):
        if roles.get(user.role or '', -1) < roles[min_role]:
            raise HTTPException(403, f'{min_role} role required')
        return user
    return guard
