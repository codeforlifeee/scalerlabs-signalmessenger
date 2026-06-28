"""
Message routes: send, fetch (paginated), mark as read.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from typing import List
from datetime import datetime

from database import get_db
from models import (
    User, Conversation, ConversationMember, Message,
    MessageRead, MessageStatus, MessageType
)
from schemas import MessageSendRequest, MessageResponse, UserResponse
from auth import get_current_user

router = APIRouter(prefix="/api/conversations", tags=["messages"])


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: int,
    limit: int = Query(50, ge=1, le=100),
    before_id: int = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get messages for a conversation with cursor-based pagination."""
    # Verify membership
    await _verify_membership(conversation_id, current_user.id, db)

    query = select(Message).where(Message.conversation_id == conversation_id)

    if before_id:
        query = query.where(Message.id < before_id)

    query = query.order_by(desc(Message.created_at)).limit(limit)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Reverse to get chronological order
    messages = list(reversed(messages))

    response = []
    for msg in messages:
        reply_to_resp = None
        if msg.reply_to:
            reply_to_resp = MessageResponse(
                id=msg.reply_to.id,
                conversation_id=msg.reply_to.conversation_id,
                sender_id=msg.reply_to.sender_id,
                sender=UserResponse.model_validate(msg.reply_to.sender) if msg.reply_to.sender else None,
                content=msg.reply_to.content,
                message_type=msg.reply_to.message_type,
                status=msg.reply_to.status,
                created_at=msg.reply_to.created_at
            )

        response.append(MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            sender=UserResponse.model_validate(msg.sender) if msg.sender else None,
            content=msg.content,
            message_type=msg.message_type,
            status=msg.status,
            reply_to_id=msg.reply_to_id,
            reply_to=reply_to_resp,
            created_at=msg.created_at
        ))

    return response


@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: int,
    req: MessageSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message to a conversation (REST fallback)."""
    await _verify_membership(conversation_id, current_user.id, db)

    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=req.content,
        message_type=req.message_type,
        status=MessageStatus.SENT.value,
        reply_to_id=req.reply_to_id
    )
    db.add(msg)

    # Update conversation's updated_at
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = conv_result.scalar_one()
    conv.updated_at = datetime.utcnow()
    db.add(conv)

    await db.flush()
    await db.refresh(msg)

    # Broadcast via WebSocket
    from websocket_manager import manager
    member_result = await db.execute(
        select(ConversationMember.user_id)
        .where(ConversationMember.conversation_id == conversation_id)
    )
    member_ids = [row[0] for row in member_result.all()]

    msg_data = {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender": {
            "id": current_user.id,
            "username": current_user.username,
            "display_name": current_user.display_name,
            "avatar_url": current_user.avatar_url,
            "avatar_color": current_user.avatar_color,
            "is_online": current_user.is_online
        },
        "content": msg.content,
        "message_type": msg.message_type,
        "status": msg.status,
        "reply_to_id": msg.reply_to_id,
        "created_at": msg.created_at.isoformat()
    }

    await manager.broadcast_to_conversation(member_ids, "new_message", msg_data)

    # Send delivery receipt to sender
    for uid in member_ids:
        if uid != current_user.id and manager.is_user_online(uid):
            msg.status = MessageStatus.DELIVERED.value
            db.add(msg)
            await manager.send_to_user(current_user.id, "message_status", {
                "message_id": msg.id,
                "status": MessageStatus.DELIVERED.value
            })
            break

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender=UserResponse.model_validate(current_user),
        content=msg.content,
        message_type=msg.message_type,
        status=msg.status,
        reply_to_id=msg.reply_to_id,
        created_at=msg.created_at
    )


@router.put("/{conversation_id}/read", status_code=status.HTTP_200_OK)
async def mark_conversation_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in a conversation as read for the current user."""
    await _verify_membership(conversation_id, current_user.id, db)

    # Update the member's last_read_at
    member_result = await db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == current_user.id
            )
        )
    )
    member = member_result.scalar_one()
    member.last_read_at = datetime.utcnow()
    db.add(member)

    # Get unread messages from others and mark them as read
    unread_result = await db.execute(
        select(Message).where(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != current_user.id,
                Message.status != MessageStatus.READ.value
            )
        )
    )
    unread_messages = unread_result.scalars().all()

    from websocket_manager import manager

    for msg in unread_messages:
        msg.status = MessageStatus.READ.value
        db.add(msg)

        # Create read receipt
        read_receipt = MessageRead(
            message_id=msg.id,
            user_id=current_user.id
        )
        db.add(read_receipt)

        # Notify the sender
        await manager.send_to_user(msg.sender_id, "message_status", {
            "message_id": msg.id,
            "status": MessageStatus.READ.value,
            "conversation_id": conversation_id
        })

    return {"read_count": len(unread_messages)}


# ─── Helpers ─────────────────────────────────────────────

async def _verify_membership(conversation_id: int, user_id: int, db: AsyncSession):
    """Verify user is a member of the conversation."""
    result = await db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
