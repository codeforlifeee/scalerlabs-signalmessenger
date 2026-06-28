"""
User routes: registration, login, profile management, search.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List

from database import get_db
from models import User
from schemas import (
    RegisterRequest, LoginRequest, OTPVerifyRequest,
    TokenResponse, UserResponse, UserUpdateRequest
)
from auth import (
    hash_password, verify_password, create_access_token,
    verify_otp, get_current_user
)

router = APIRouter(prefix="/api/users", tags=["users"])
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Auth Routes ─────────────────────────────────────────

@auth_router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user."""
    # Check if username already exists
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken"
        )

    user = User(
        username=req.username,
        phone=req.phone,
        display_name=req.display_name,
        password_hash=hash_password(req.password),
        avatar_color=_generate_avatar_color(req.username)
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user)
    )


@auth_router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with username and password."""
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user)
    )


@auth_router.post("/verify-otp")
async def verify_otp_route(req: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify mocked OTP (always accepts '123456')."""
    if not verify_otp(req.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP"
        )
    return {"verified": True, "message": "OTP verified successfully"}


# ─── User Routes ─────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    req: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user profile."""
    if req.display_name is not None:
        current_user.display_name = req.display_name
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url
    if req.avatar_color is not None:
        current_user.avatar_color = req.avatar_color
    if req.status_text is not None:
        current_user.status_text = req.status_text
    if req.phone is not None:
        current_user.phone = req.phone

    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.get("/search", response_model=List[UserResponse])
async def search_users(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search users by username or display name."""
    search_term = f"%{q}%"
    result = await db.execute(
        select(User)
        .where(
            User.id != current_user.id,
            or_(
                User.username.ilike(search_term),
                User.display_name.ilike(search_term)
            )
        )
        .limit(20)
    )
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.get("/online", response_model=List[int])
async def get_online_users(current_user: User = Depends(get_current_user)):
    """Get list of online user IDs."""
    from websocket_manager import manager
    return manager.get_online_user_ids()


def _generate_avatar_color(username: str) -> str:
    """Generate a consistent color based on username."""
    colors = [
        "#E13D56", "#C73AC4", "#7B68EE", "#3A76F0",
        "#00BFA5", "#FF6F00", "#2E7D32", "#D32F2F",
        "#6D4C41", "#546E7A", "#AB47BC", "#26A69A"
    ]
    hash_val = sum(ord(c) for c in username)
    return colors[hash_val % len(colors)]
