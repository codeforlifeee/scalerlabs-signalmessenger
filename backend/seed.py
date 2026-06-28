"""
Database seeder: Creates sample users, contacts, conversations, and messages
so the app is immediately usable and demonstrable.
"""

import asyncio
import sys
import io
from datetime import datetime, timedelta
from sqlalchemy import select

# Fix Windows console encoding for emoji
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from database import init_db, async_session
from models import (
    User, Contact, Conversation, ConversationMember, Message,
    ConversationType, MemberRole, MessageStatus, MessageType
)
from auth import hash_password


# Sample avatar colors from Signal's palette
COLORS = [
    "#E13D56", "#C73AC4", "#7B68EE", "#3A76F0",
    "#00BFA5", "#FF6F00", "#2E7D32", "#D32F2F"
]

# Sample users
USERS = [
    {"username": "alice", "display_name": "Alice Johnson", "phone": "+1234567001", "status_text": "Living my best life ✨", "color": COLORS[0]},
    {"username": "bob", "display_name": "Bob Smith", "phone": "+1234567002", "status_text": "Coffee and code ☕", "color": COLORS[1]},
    {"username": "charlie", "display_name": "Charlie Brown", "phone": "+1234567003", "status_text": "Always learning 📚", "color": COLORS[2]},
    {"username": "diana", "display_name": "Diana Prince", "phone": "+1234567004", "status_text": "Wonder what's next? 🌟", "color": COLORS[3]},
    {"username": "eve", "display_name": "Eve Wilson", "phone": "+1234567005", "status_text": "Crypto enthusiast 🔐", "color": COLORS[4]},
    {"username": "frank", "display_name": "Frank Miller", "phone": "+1234567006", "status_text": "Just vibing 🎵", "color": COLORS[5]},
    {"username": "grace", "display_name": "Grace Hopper", "phone": "+1234567007", "status_text": "Bug hunter 🐛", "color": COLORS[6]},
    {"username": "hank", "display_name": "Hank Green", "phone": "+1234567008", "status_text": "Science is cool 🔬", "color": COLORS[7]},
]


async def seed():
    """Main seeding function."""
    await init_db()

    async with async_session() as db:
        # Check if already seeded
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("⚠️  Database already seeded. Skipping.")
            return

        print("🌱 Seeding database...")

        # ─── Create Users ────────────────────────────────────
        users = []
        for u in USERS:
            user = User(
                username=u["username"],
                phone=u["phone"],
                display_name=u["display_name"],
                password_hash=hash_password("password123"),
                avatar_color=u["color"],
                status_text=u["status_text"],
                is_online=False,
                last_seen=datetime.utcnow() - timedelta(hours=1)
            )
            db.add(user)
            users.append(user)

        await db.flush()
        for u in users:
            await db.refresh(u)

        alice, bob, charlie, diana, eve, frank, grace, hank = users
        print(f"   ✅ Created {len(users)} users")

        # ─── Create Contacts (bidirectional) ─────────────────
        contact_pairs = [
            (alice, bob), (alice, charlie), (alice, diana), (alice, eve),
            (bob, charlie), (bob, diana), (bob, frank),
            (charlie, diana), (charlie, eve), (charlie, grace),
            (diana, eve), (diana, frank),
            (eve, frank), (eve, grace), (eve, hank),
            (frank, grace), (frank, hank),
            (grace, hank),
        ]

        for u1, u2 in contact_pairs:
            db.add(Contact(user_id=u1.id, contact_id=u2.id))
            db.add(Contact(user_id=u2.id, contact_id=u1.id))

        await db.flush()
        print(f"   ✅ Created {len(contact_pairs) * 2} contacts")

        # ─── Create Direct Conversations ─────────────────────
        now = datetime.utcnow()

        # Alice <-> Bob
        conv1 = Conversation(type=ConversationType.DIRECT.value, created_by=alice.id, updated_at=now - timedelta(minutes=5))
        db.add(conv1)
        await db.flush()
        await db.refresh(conv1)
        db.add(ConversationMember(conversation_id=conv1.id, user_id=alice.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=conv1.id, user_id=bob.id, role=MemberRole.MEMBER.value, last_read_at=now - timedelta(hours=1)))

        # Alice <-> Charlie
        conv2 = Conversation(type=ConversationType.DIRECT.value, created_by=alice.id, updated_at=now - timedelta(hours=2))
        db.add(conv2)
        await db.flush()
        await db.refresh(conv2)
        db.add(ConversationMember(conversation_id=conv2.id, user_id=alice.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=conv2.id, user_id=charlie.id, role=MemberRole.MEMBER.value, last_read_at=now))

        # Alice <-> Diana
        conv3 = Conversation(type=ConversationType.DIRECT.value, created_by=diana.id, updated_at=now - timedelta(hours=5))
        db.add(conv3)
        await db.flush()
        await db.refresh(conv3)
        db.add(ConversationMember(conversation_id=conv3.id, user_id=alice.id, role=MemberRole.MEMBER.value, last_read_at=now - timedelta(hours=6)))
        db.add(ConversationMember(conversation_id=conv3.id, user_id=diana.id, role=MemberRole.MEMBER.value, last_read_at=now))

        # Bob <-> Charlie
        conv4 = Conversation(type=ConversationType.DIRECT.value, created_by=bob.id, updated_at=now - timedelta(hours=1))
        db.add(conv4)
        await db.flush()
        await db.refresh(conv4)
        db.add(ConversationMember(conversation_id=conv4.id, user_id=bob.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=conv4.id, user_id=charlie.id, role=MemberRole.MEMBER.value, last_read_at=now))

        # Eve <-> Frank
        conv5 = Conversation(type=ConversationType.DIRECT.value, created_by=eve.id, updated_at=now - timedelta(days=1))
        db.add(conv5)
        await db.flush()
        await db.refresh(conv5)
        db.add(ConversationMember(conversation_id=conv5.id, user_id=eve.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=conv5.id, user_id=frank.id, role=MemberRole.MEMBER.value, last_read_at=now))

        await db.flush()
        print("   ✅ Created 5 direct conversations")

        # ─── Create Group Conversations ──────────────────────

        # Group: "Project Alpha"
        group1 = Conversation(
            type=ConversationType.GROUP.value,
            name="Project Alpha 🚀",
            avatar_color="#3A76F0",
            created_by=alice.id,
            updated_at=now - timedelta(minutes=30)
        )
        db.add(group1)
        await db.flush()
        await db.refresh(group1)
        db.add(ConversationMember(conversation_id=group1.id, user_id=alice.id, role=MemberRole.ADMIN.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group1.id, user_id=bob.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group1.id, user_id=charlie.id, role=MemberRole.MEMBER.value, last_read_at=now - timedelta(hours=2)))
        db.add(ConversationMember(conversation_id=group1.id, user_id=diana.id, role=MemberRole.MEMBER.value, last_read_at=now))

        # Group: "Weekend Hangout"
        group2 = Conversation(
            type=ConversationType.GROUP.value,
            name="Weekend Hangout 🎉",
            avatar_color="#00BFA5",
            created_by=bob.id,
            updated_at=now - timedelta(hours=3)
        )
        db.add(group2)
        await db.flush()
        await db.refresh(group2)
        db.add(ConversationMember(conversation_id=group2.id, user_id=bob.id, role=MemberRole.ADMIN.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group2.id, user_id=alice.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group2.id, user_id=eve.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group2.id, user_id=frank.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group2.id, user_id=grace.id, role=MemberRole.MEMBER.value, last_read_at=now))

        # Group: "Study Group"
        group3 = Conversation(
            type=ConversationType.GROUP.value,
            name="Study Group 📖",
            avatar_color="#7B68EE",
            created_by=charlie.id,
            updated_at=now - timedelta(days=2)
        )
        db.add(group3)
        await db.flush()
        await db.refresh(group3)
        db.add(ConversationMember(conversation_id=group3.id, user_id=charlie.id, role=MemberRole.ADMIN.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group3.id, user_id=alice.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group3.id, user_id=diana.id, role=MemberRole.MEMBER.value, last_read_at=now))
        db.add(ConversationMember(conversation_id=group3.id, user_id=hank.id, role=MemberRole.MEMBER.value, last_read_at=now))

        await db.flush()
        print("   ✅ Created 3 group conversations")

        # ─── Seed Messages ───────────────────────────────────
        messages_data = [
            # Alice <-> Bob conversation
            (conv1.id, alice.id, "Hey Bob! How's the new project going?", now - timedelta(hours=2), MessageStatus.READ.value),
            (conv1.id, bob.id, "Hey Alice! It's going great, just finished the API design", now - timedelta(hours=1, minutes=55), MessageStatus.READ.value),
            (conv1.id, alice.id, "That's awesome! Can you share the docs?", now - timedelta(hours=1, minutes=50), MessageStatus.READ.value),
            (conv1.id, bob.id, "Sure! I'll send them over in a bit. Working on some edge cases right now 🔧", now - timedelta(hours=1, minutes=45), MessageStatus.READ.value),
            (conv1.id, alice.id, "No rush! Take your time", now - timedelta(hours=1, minutes=40), MessageStatus.READ.value),
            (conv1.id, bob.id, "Thanks! BTW, are you coming to the team sync tomorrow?", now - timedelta(hours=1, minutes=30), MessageStatus.READ.value),
            (conv1.id, alice.id, "Yes, I'll be there! 10am right?", now - timedelta(hours=1, minutes=25), MessageStatus.READ.value),
            (conv1.id, bob.id, "Yep, 10am sharp. See you there! 👋", now - timedelta(minutes=10), MessageStatus.DELIVERED.value),
            (conv1.id, alice.id, "Perfect, see you!", now - timedelta(minutes=5), MessageStatus.SENT.value),

            # Alice <-> Charlie conversation
            (conv2.id, charlie.id, "Alice, did you see the new ML paper?", now - timedelta(hours=3), MessageStatus.READ.value),
            (conv2.id, alice.id, "Not yet! Which one?", now - timedelta(hours=2, minutes=50), MessageStatus.READ.value),
            (conv2.id, charlie.id, "The one about transformer architectures. Really interesting stuff!", now - timedelta(hours=2, minutes=45), MessageStatus.READ.value),
            (conv2.id, alice.id, "Oh I'll check it out! Thanks for sharing 🙏", now - timedelta(hours=2, minutes=30), MessageStatus.READ.value),
            (conv2.id, charlie.id, "Let me know your thoughts when you read it", now - timedelta(hours=2), MessageStatus.READ.value),

            # Alice <-> Diana
            (conv3.id, diana.id, "Hey Alice! Want to grab coffee this weekend?", now - timedelta(hours=6), MessageStatus.READ.value),
            (conv3.id, alice.id, "That sounds great! Saturday works for me", now - timedelta(hours=5, minutes=50), MessageStatus.READ.value),
            (conv3.id, diana.id, "Perfect! Let's meet at the usual spot at 2pm ☕", now - timedelta(hours=5, minutes=40), MessageStatus.READ.value),
            (conv3.id, diana.id, "I have some exciting news to share!", now - timedelta(hours=5), MessageStatus.DELIVERED.value),

            # Bob <-> Charlie
            (conv4.id, bob.id, "Hey Charlie, got a minute?", now - timedelta(hours=1, minutes=30), MessageStatus.READ.value),
            (conv4.id, charlie.id, "Sure, what's up?", now - timedelta(hours=1, minutes=25), MessageStatus.READ.value),
            (conv4.id, bob.id, "Need help with the database schema for the new feature", now - timedelta(hours=1, minutes=20), MessageStatus.READ.value),
            (conv4.id, charlie.id, "Happy to help! Let's pair on it after lunch", now - timedelta(hours=1), MessageStatus.READ.value),

            # Eve <-> Frank
            (conv5.id, eve.id, "Frank, the deployment went smoothly!", now - timedelta(days=1, hours=2), MessageStatus.READ.value),
            (conv5.id, frank.id, "Great news! Any issues we should watch for?", now - timedelta(days=1, hours=1), MessageStatus.READ.value),
            (conv5.id, eve.id, "Nope, all metrics look good. Monitoring dashboard is clean 📊", now - timedelta(days=1), MessageStatus.READ.value),

            # Project Alpha group messages
            (group1.id, alice.id, "Team, let's discuss the Q3 roadmap 📋", now - timedelta(hours=4), MessageStatus.READ.value),
            (group1.id, bob.id, "I've drafted the feature priorities", now - timedelta(hours=3, minutes=50), MessageStatus.READ.value),
            (group1.id, charlie.id, "Looks solid! I have a few suggestions though", now - timedelta(hours=3, minutes=40), MessageStatus.READ.value),
            (group1.id, diana.id, "Can we also discuss the timeline? I think we need more buffer", now - timedelta(hours=3, minutes=30), MessageStatus.READ.value),
            (group1.id, alice.id, "Good point Diana. Let's add 2 weeks buffer for each milestone", now - timedelta(hours=3, minutes=20), MessageStatus.READ.value),
            (group1.id, bob.id, "Agreed! I'll update the plan and share it by EOD", now - timedelta(hours=3), MessageStatus.READ.value),
            (group1.id, charlie.id, "Sounds good 👍", now - timedelta(minutes=30), MessageStatus.DELIVERED.value),

            # Weekend Hangout group messages
            (group2.id, bob.id, "Who's free this Saturday? 🎉", now - timedelta(hours=8), MessageStatus.READ.value),
            (group2.id, alice.id, "I'm in! Where are we going?", now - timedelta(hours=7, minutes=50), MessageStatus.READ.value),
            (group2.id, eve.id, "Count me in! Let's try that new restaurant downtown", now - timedelta(hours=7, minutes=30), MessageStatus.READ.value),
            (group2.id, frank.id, "Sounds like a plan! What time?", now - timedelta(hours=7), MessageStatus.READ.value),
            (group2.id, grace.id, "I might be a bit late but I'll join!", now - timedelta(hours=6), MessageStatus.READ.value),
            (group2.id, bob.id, "Let's meet at 7pm. I'll make a reservation 🍽️", now - timedelta(hours=3), MessageStatus.READ.value),

            # Study Group messages
            (group3.id, charlie.id, "Next study session: Wednesday at 6pm", now - timedelta(days=2, hours=5), MessageStatus.READ.value),
            (group3.id, diana.id, "Perfect! I'll bring the textbook", now - timedelta(days=2, hours=4), MessageStatus.READ.value),
            (group3.id, hank.id, "Can we focus on chapter 5 this time?", now - timedelta(days=2, hours=3), MessageStatus.READ.value),
            (group3.id, alice.id, "Works for me! I need help with the exercises too", now - timedelta(days=2, hours=2), MessageStatus.READ.value),
            (group3.id, charlie.id, "Sure thing! Let's plan for 2 hours", now - timedelta(days=2), MessageStatus.READ.value),
        ]

        for conv_id, sender_id, content, created_at, msg_status in messages_data:
            msg = Message(
                conversation_id=conv_id,
                sender_id=sender_id,
                content=content,
                message_type=MessageType.TEXT.value,
                status=msg_status,
                created_at=created_at,
                updated_at=created_at
            )
            db.add(msg)

        await db.flush()
        print(f"   ✅ Created {len(messages_data)} messages")

        await db.commit()
        print("✅ Database seeded successfully!")
        print("\n📋 Seeded accounts (all use password: password123):")
        for u in USERS:
            print(f"   • {u['username']} — {u['display_name']}")


if __name__ == "__main__":
    asyncio.run(seed())
