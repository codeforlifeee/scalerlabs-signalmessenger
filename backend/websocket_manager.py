"""
WebSocket connection manager for real-time messaging.
Handles per-user connections, broadcasting, typing indicators,
delivery receipts, and online status.
"""

import json
from typing import Dict, List, Set
from fastapi import WebSocket
from datetime import datetime


class ConnectionManager:
    """Manages active WebSocket connections mapped to user IDs."""

    def __init__(self):
        # user_id -> list of WebSocket connections (supports multiple tabs)
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # conversation_id -> set of user_ids currently typing
        self.typing_users: Dict[int, Set[int]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept and register a WebSocket connection for a user."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a specific WebSocket connection for a user."""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    def is_user_online(self, user_id: int) -> bool:
        """Check if a user has any active connections."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_online_user_ids(self) -> List[int]:
        """Get list of all currently connected user IDs."""
        return list(self.active_connections.keys())

    async def send_to_user(self, user_id: int, event: str, data: dict):
        """Send a message to all connections of a specific user."""
        message = json.dumps({"event": event, "data": data})
        if user_id in self.active_connections:
            dead_connections = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead_connections.append(ws)
            # Clean up dead connections
            for ws in dead_connections:
                self.active_connections[user_id].remove(ws)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_conversation(
        self,
        member_ids: List[int],
        event: str,
        data: dict,
        exclude_user_id: int = None
    ):
        """Broadcast a message to all members of a conversation."""
        for uid in member_ids:
            if exclude_user_id and uid == exclude_user_id:
                continue
            await self.send_to_user(uid, event, data)

    async def broadcast_online_status(self, user_id: int, is_online: bool, contact_ids: List[int]):
        """Notify relevant users about online/offline status change."""
        event = "user_online" if is_online else "user_offline"
        data = {
            "user_id": user_id,
            "is_online": is_online,
            "last_seen": datetime.utcnow().isoformat() if not is_online else None
        }
        for cid in contact_ids:
            await self.send_to_user(cid, event, data)

    async def handle_typing(self, user_id: int, conversation_id: int, is_typing: bool, member_ids: List[int]):
        """Handle typing indicator events."""
        if conversation_id not in self.typing_users:
            self.typing_users[conversation_id] = set()

        if is_typing:
            self.typing_users[conversation_id].add(user_id)
        else:
            self.typing_users[conversation_id].discard(user_id)

        event = "typing_start" if is_typing else "typing_stop"
        data = {
            "conversation_id": conversation_id,
            "user_id": user_id
        }
        await self.broadcast_to_conversation(member_ids, event, data, exclude_user_id=user_id)


# Singleton instance
manager = ConnectionManager()
