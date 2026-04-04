"""
Keboola OIDC user context.

In production, Keboola injects the user's email via the x-kbc-user-email
HTTP header (OIDC proxy). This module reads that header and provides a
UserContext dependency for FastAPI routes.

LOCAL DEV: Set DEV_USER_EMAIL in backend/.env to simulate a user.
CUSTOMIZE: Add role detection logic if your app needs role-based access.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Request


@dataclass
class UserContext:
    """Current user info, extracted from Keboola OIDC headers."""
    email: Optional[str] = None
    role: str = "viewer"

    @property
    def is_authenticated(self) -> bool:
        return self.email is not None


def get_user_context(request: Request) -> UserContext:
    """FastAPI dependency — read x-kbc-user-email header.

    Starlette lowercases all HTTP headers, so we only check lowercase.
    """
    email = (
        request.headers.get("x-kbc-user-email")
        or os.getenv("DEV_USER_EMAIL", "").strip()
        or None
    )

    if email:
        email = email.strip().lower()

    # CUSTOMIZE: Add role detection here
    role = "admin" if email else "viewer"

    return UserContext(email=email, role=role)
