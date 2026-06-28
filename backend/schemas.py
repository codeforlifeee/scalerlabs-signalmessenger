"""
Pydantic schemas for API request/response validation.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ─── Auth Schemas ───────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    phone: Optional[str] = None
    display_name: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class OTPVerifyRequest(BaseModel):
    username: str
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


# ─── User Schemas ───────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    username: str
    phone: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    avatar_color: str = "#3A76F0"
    status_text: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_color: Optional[str] = None
    status_text: Optional[str] = None
    phone: Optional[str] = None


# ─── Contact Schemas ───────────────────────────────────────

class ContactAddRequest(BaseModel):
    username: str

class ContactResponse(BaseModel):
    id: int
    contact: UserResponse
    nickname: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Conversation Schemas ──────────────────────────────────

class ConversationCreateRequest(BaseModel):
    type: str = "direct"  # "direct" or "group"
    name: Optional[str] = None  # Required for group
    member_ids: List[int] = []
    avatar_color: Optional[str] = None

class ConversationUpdateRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_color: Optional[str] = None

class MemberAddRequest(BaseModel):
    user_id: int

class ConversationMemberResponse(BaseModel):
    id: int
    user_id: int
    user: UserResponse
    role: str
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: int
    type: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_color: Optional[str] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    members: List[ConversationMemberResponse] = []
    last_message: Optional["MessageResponse"] = None
    unread_count: int = 0

    class Config:
        from_attributes = True


# ─── Message Schemas ───────────────────────────────────────

class MessageSendRequest(BaseModel):
    content: str
    message_type: str = "text"
    reply_to_id: Optional[int] = None

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender: Optional[UserResponse] = None
    content: str
    message_type: str = "text"
    status: str = "sent"
    reply_to_id: Optional[int] = None
    reply_to: Optional["MessageResponse"] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── WebSocket Event Schemas ──────────────────────────────

class WSMessage(BaseModel):
    event: str
    data: dict


# Rebuild models for forward references
TokenResponse.model_rebuild()
ConversationResponse.model_rebuild()
MessageResponse.model_rebuild()
