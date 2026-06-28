"""
Signal Clone — FastAPI Backend Entry Point
Registers all routes, WebSocket endpoint, CORS, and database initialization.
"""

import json
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import init_db, get_db, async_session
from models import User, ConversationMember, Message, MessageStatus, Conversation
from auth import decode_token
from websocket_manager import manager
from routes.users import router as users_router, auth_router
from routes.contacts import router as contacts_router
from routes.conversations import router as conversations_router
from routes.messages import router as messages_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    await init_db()
    print("[OK] Database initialized")
    yield
    print("[STOP] Shutting down")


app = FastAPI(
    title="Signal Clone API",
    description="Backend API for the Signal messaging clone",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000", 
        "https://scalerlabs-signalmessenger.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(contacts_router)
app.include_router(conversations_router)
app.include_router(messages_router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "Signal Clone API"}


@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    WebSocket endpoint for real-time messaging.
    Authenticates via JWT token in URL path.
    """
    # Authenticate
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Connect
    await manager.connect(websocket, user_id)

    # Update online status
    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            user.is_online = True
            db.add(user)
            await db.commit()

            # Notify contacts about online status
            contact_ids = await _get_peer_user_ids(user_id, db)
            await manager.broadcast_online_status(user_id, True, contact_ids)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            event = message.get("event")
            event_data = message.get("data", {})

            await _handle_ws_event(user_id, event, event_data)

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        await _handle_disconnect(user_id)
    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)
        await _handle_disconnect(user_id)


async def _handle_ws_event(user_id: int, event: str, data: dict):
    """Route WebSocket events to appropriate handlers."""
    if event == "message_sent":
        await _handle_message_sent(user_id, data)
    elif event == "typing_start":
        await _handle_typing(user_id, data, True)
    elif event == "typing_stop":
        await _handle_typing(user_id, data, False)
    elif event == "message_read":
        await _handle_message_read(user_id, data)


async def _handle_message_sent(user_id: int, data: dict):
    """Handle a new message sent via WebSocket."""
    async with async_session() as db:
        conversation_id = data.get("conversation_id")
        content = data.get("content", "")
        reply_to_id = data.get("reply_to_id")

        if not conversation_id or not content:
            return

        # Create message
        msg = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            content=content,
            message_type=data.get("message_type", "text"),
            status=MessageStatus.SENT.value,
            reply_to_id=reply_to_id
        )
        db.add(msg)

        # Update conversation timestamp
        conv_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = conv_result.scalar_one_or_none()
        if conv:
            conv.updated_at = datetime.utcnow()
            db.add(conv)

        await db.flush()
        await db.refresh(msg)

        # Get sender info
        sender_result = await db.execute(select(User).where(User.id == user_id))
        sender = sender_result.scalar_one()

        # Get conversation members
        member_result = await db.execute(
            select(ConversationMember.user_id)
            .where(ConversationMember.conversation_id == conversation_id)
        )
        member_ids = [row[0] for row in member_result.all()]

        # Build message data
        msg_data = {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "sender": {
                "id": sender.id,
                "username": sender.username,
                "display_name": sender.display_name,
                "avatar_url": sender.avatar_url,
                "avatar_color": sender.avatar_color,
                "is_online": sender.is_online
            },
            "content": msg.content,
            "message_type": msg.message_type,
            "status": msg.status,
            "reply_to_id": msg.reply_to_id,
            "created_at": msg.created_at.isoformat()
        }

        # Broadcast to all members (including sender for confirmation)
        await manager.broadcast_to_conversation(member_ids, "new_message", msg_data)

        # Check delivery status
        any_online = any(
            manager.is_user_online(uid) for uid in member_ids if uid != user_id
        )
        if any_online:
            msg.status = MessageStatus.DELIVERED.value
            db.add(msg)
            await manager.send_to_user(user_id, "message_status", {
                "message_id": msg.id,
                "status": MessageStatus.DELIVERED.value,
                "conversation_id": conversation_id
            })

        await db.commit()


async def _handle_typing(user_id: int, data: dict, is_typing: bool):
    """Handle typing indicator events."""
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return

    async with async_session() as db:
        member_result = await db.execute(
            select(ConversationMember.user_id)
            .where(ConversationMember.conversation_id == conversation_id)
        )
        member_ids = [row[0] for row in member_result.all()]

    await manager.handle_typing(user_id, conversation_id, is_typing, member_ids)


async def _handle_message_read(user_id: int, data: dict):
    """Handle message read receipts."""
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return

    async with async_session() as db:
        # Update last_read_at
        member_result = await db.execute(
            select(ConversationMember).where(
                and_(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id == user_id
                )
            )
        )
        member = member_result.scalar_one_or_none()
        if member:
            member.last_read_at = datetime.utcnow()
            db.add(member)

        # Update message statuses
        unread_result = await db.execute(
            select(Message).where(
                and_(
                    Message.conversation_id == conversation_id,
                    Message.sender_id != user_id,
                    Message.status != MessageStatus.READ.value
                )
            )
        )
        unread_msgs = unread_result.scalars().all()

        for msg in unread_msgs:
            msg.status = MessageStatus.READ.value
            db.add(msg)
            # Notify sender
            await manager.send_to_user(msg.sender_id, "message_status", {
                "message_id": msg.id,
                "status": MessageStatus.READ.value,
                "conversation_id": conversation_id
            })

        await db.commit()


async def _get_peer_user_ids(user_id: int, db) -> list:
    """Get all user IDs that share a conversation with the given user."""
    # Step 1: Get all conversation IDs the user is in
    conv_result = await db.execute(
        select(ConversationMember.conversation_id)
        .where(ConversationMember.user_id == user_id)
    )
    conv_ids = [row[0] for row in conv_result.all()]
    if not conv_ids:
        return []

    # Step 2: Get all other user IDs in those conversations
    peer_result = await db.execute(
        select(ConversationMember.user_id)
        .where(
            ConversationMember.conversation_id.in_(conv_ids),
            ConversationMember.user_id != user_id
        )
    )
    return list(set(row[0] for row in peer_result.all()))


async def _handle_disconnect(user_id: int):
    """Handle user disconnect — update online status."""
    if not manager.is_user_online(user_id):
        async with async_session() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                db.add(user)
                await db.commit()

                # Notify contacts
                contact_ids = await _get_peer_user_ids(user_id, db)
                await manager.broadcast_online_status(user_id, False, contact_ids)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
