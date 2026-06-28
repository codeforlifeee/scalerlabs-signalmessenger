"""
Conversation routes: create, list, group management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from typing import List

from database import get_db
from models import (
    User, Conversation, ConversationMember, Message,
    ConversationType, MemberRole, MessageStatus
)
from schemas import (
    ConversationCreateRequest, ConversationUpdateRequest,
    ConversationResponse, ConversationMemberResponse,
    MemberAddRequest, UserResponse, MessageResponse
)
from auth import get_current_user

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


async def _build_conversation_response(
    conv: Conversation,
    current_user_id: int,
    db: AsyncSession
) -> ConversationResponse:
    """Build a full ConversationResponse with last_message and unread_count."""
    # Get last message
    last_msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(desc(Message.created_at))
        .limit(1)
    )
    last_msg = last_msg_result.scalar_one_or_none()

    # Get unread count
    member_result = await db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conv.id,
                ConversationMember.user_id == current_user_id
            )
        )
    )
    member = member_result.scalar_one_or_none()

    unread_count = 0
    if member and member.last_read_at:
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                and_(
                    Message.conversation_id == conv.id,
                    Message.created_at > member.last_read_at,
                    Message.sender_id != current_user_id
                )
            )
        )
        unread_count = unread_result.scalar() or 0
    elif member:
        # Never read — count all messages from others
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                and_(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user_id
                )
            )
        )
        unread_count = unread_result.scalar() or 0

    # Build member responses
    members_resp = []
    for m in conv.members:
        members_resp.append(ConversationMemberResponse(
            id=m.id,
            user_id=m.user_id,
            user=UserResponse.model_validate(m.user),
            role=m.role,
            joined_at=m.joined_at
        ))

    last_message_resp = None
    if last_msg:
        last_message_resp = MessageResponse(
            id=last_msg.id,
            conversation_id=last_msg.conversation_id,
            sender_id=last_msg.sender_id,
            sender=UserResponse.model_validate(last_msg.sender) if last_msg.sender else None,
            content=last_msg.content,
            message_type=last_msg.message_type,
            status=last_msg.status,
            reply_to_id=last_msg.reply_to_id,
            created_at=last_msg.created_at
        )

    return ConversationResponse(
        id=conv.id,
        type=conv.type,
        name=conv.name,
        avatar_url=conv.avatar_url,
        avatar_color=conv.avatar_color,
        created_by=conv.created_by,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        members=members_resp,
        last_message=last_message_resp,
        unread_count=unread_count
    )


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all conversations for the current user, sorted by most recent activity."""
    # Get conversation IDs where user is a member
    member_result = await db.execute(
        select(ConversationMember.conversation_id)
        .where(ConversationMember.user_id == current_user.id)
    )
    conv_ids = [row[0] for row in member_result.all()]

    if not conv_ids:
        return []

    # Get conversations with eager loading
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.id.in_(conv_ids))
        .order_by(desc(Conversation.updated_at))
    )
    conversations = conv_result.scalars().all()

    response = []
    for conv in conversations:
        resp = await _build_conversation_response(conv, current_user.id, db)
        response.append(resp)

    # Sort by last message time (most recent first)
    response.sort(
        key=lambda c: c.last_message.created_at if c.last_message else c.created_at,
        reverse=True
    )

    return response


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    req: ConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation (direct or group)."""
    if req.type == ConversationType.DIRECT.value:
        if len(req.member_ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Direct conversations require exactly one other member"
            )

        other_user_id = req.member_ids[0]

        # Check if direct conversation already exists between these users
        existing = await db.execute(
            select(Conversation)
            .join(ConversationMember, Conversation.id == ConversationMember.conversation_id)
            .where(
                Conversation.type == ConversationType.DIRECT.value,
                ConversationMember.user_id == current_user.id
            )
        )
        existing_convs = existing.scalars().all()

        for conv in existing_convs:
            member_ids = [m.user_id for m in conv.members]
            if other_user_id in member_ids and current_user.id in member_ids and len(member_ids) == 2:
                # Return existing conversation
                return await _build_conversation_response(conv, current_user.id, db)

    elif req.type == ConversationType.GROUP.value:
        if not req.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group conversations require a name"
            )

    # Create the conversation
    conv = Conversation(
        type=req.type,
        name=req.name,
        avatar_color=req.avatar_color or "#3A76F0",
        created_by=current_user.id
    )
    db.add(conv)
    await db.flush()

    # Add creator as admin
    creator_member = ConversationMember(
        conversation_id=conv.id,
        user_id=current_user.id,
        role=MemberRole.ADMIN.value
    )
    db.add(creator_member)

    # Add other members
    for uid in req.member_ids:
        member = ConversationMember(
            conversation_id=conv.id,
            user_id=uid,
            role=MemberRole.MEMBER.value
        )
        db.add(member)

    # Add system message for group creation
    if req.type == ConversationType.GROUP.value:
        from models import MessageType
        system_msg = Message(
            conversation_id=conv.id,
            sender_id=current_user.id,
            content=f"{current_user.display_name} created the group \"{req.name}\"",
            message_type=MessageType.SYSTEM.value,
            status=MessageStatus.READ.value
        )
        db.add(system_msg)

    await db.flush()
    await db.refresh(conv)

    return await _build_conversation_response(conv, current_user.id, db)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific conversation."""
    conv = await _get_conversation_as_member(conversation_id, current_user.id, db)
    return await _build_conversation_response(conv, current_user.id, db)


@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: int,
    req: ConversationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update group conversation (name, avatar). Admin only."""
    conv = await _get_conversation_as_member(conversation_id, current_user.id, db)

    if conv.type != ConversationType.GROUP.value:
        raise HTTPException(status_code=400, detail="Can only update group conversations")

    await _require_admin(conversation_id, current_user.id, db)

    if req.name is not None:
        conv.name = req.name
    if req.avatar_url is not None:
        conv.avatar_url = req.avatar_url
    if req.avatar_color is not None:
        conv.avatar_color = req.avatar_color

    db.add(conv)
    await db.flush()
    await db.refresh(conv)

    return await _build_conversation_response(conv, current_user.id, db)


@router.post("/{conversation_id}/members", response_model=ConversationMemberResponse)
async def add_member(
    conversation_id: int,
    req: MemberAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a member to a group conversation. Admin only."""
    conv = await _get_conversation_as_member(conversation_id, current_user.id, db)

    if conv.type != ConversationType.GROUP.value:
        raise HTTPException(status_code=400, detail="Can only add members to group conversations")

    await _require_admin(conversation_id, current_user.id, db)

    # Check if user already a member
    existing = await db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == req.user_id
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member")

    # Get the new user's info for the system message
    user_result = await db.execute(select(User).where(User.id == req.user_id))
    new_user = user_result.scalar_one_or_none()
    if not new_user:
        raise HTTPException(status_code=404, detail="User not found")

    member = ConversationMember(
        conversation_id=conversation_id,
        user_id=req.user_id,
        role=MemberRole.MEMBER.value
    )
    db.add(member)

    # System message
    from models import MessageType
    sys_msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=f"{current_user.display_name} added {new_user.display_name}",
        message_type=MessageType.SYSTEM.value,
        status=MessageStatus.READ.value
    )
    db.add(sys_msg)

    await db.flush()
    await db.refresh(member)

    return ConversationMemberResponse(
        id=member.id,
        user_id=member.user_id,
        user=UserResponse.model_validate(new_user),
        role=member.role,
        joined_at=member.joined_at
    )


@router.delete("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    conversation_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a member from a group conversation. Admin only (or self-removal)."""
    conv = await _get_conversation_as_member(conversation_id, current_user.id, db)

    if conv.type != ConversationType.GROUP.value:
        raise HTTPException(status_code=400, detail="Can only remove members from group conversations")

    # Allow admin to remove others, or any user to remove themselves
    if user_id != current_user.id:
        await _require_admin(conversation_id, current_user.id, db)

    result = await db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Get the removed user's info for the system message
    user_result = await db.execute(select(User).where(User.id == user_id))
    removed_user = user_result.scalar_one_or_none()

    await db.delete(member)

    # System message
    from models import MessageType
    if user_id == current_user.id:
        content = f"{current_user.display_name} left the group"
    else:
        content = f"{current_user.display_name} removed {removed_user.display_name}"

    sys_msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=content,
        message_type=MessageType.SYSTEM.value,
        status=MessageStatus.READ.value
    )
    db.add(sys_msg)


# ─── Helpers ─────────────────────────────────────────────

async def _get_conversation_as_member(
    conversation_id: int, user_id: int, db: AsyncSession
) -> Conversation:
    """Get a conversation, ensuring the user is a member."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check membership
    member_check = await db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    return conv


async def _require_admin(conversation_id: int, user_id: int, db: AsyncSession):
    """Ensure the user is an admin of the conversation."""
    result = await db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
                ConversationMember.role == MemberRole.ADMIN.value
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Admin privileges required")
