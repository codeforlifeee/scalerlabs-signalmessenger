# 🔒 Signal Clone — Secure Messaging Platform

A full-stack clone of the Signal messaging application built with **Next.js** (TypeScript) and **FastAPI** (Python), featuring real-time messaging, group chats, and a Signal-faithful dark UI.

![Signal Clone Screenshot](docs/screenshot.png)

---

## 🌐 Live Demo & Real-Time Testing Guide

You can test the real-time WebSocket messaging right now by opening two different browser windows side-by-side!

### How to test:
1. Open your live Vercel link in your main browser (e.g., Chrome).
2. Login with username **`alice`** and password **`password123`**.
3. Open a **Private/Incognito Window** (or a different browser like Firefox) and go to the same URL.
4. Login with username **`bob`** and password **`password123`**.
5. Select "Bob Smith" from Alice's sidebar, and "Alice Johnson" from Bob's sidebar.
6. Type a message and hit Enter! You will see the messages instantly appear on both screens with Signal's delivery receipts (✓✓).

**Live Chat Demo:**
*(Alice's View & Bob's View)*

![Alice Chat View](docs/alice_chat_demo.png)
![Bob Chat View](docs/bob_chat_demo.png)

---

## 🏗️ Architecture Overview

```
┌─────────────────────┐     WebSocket     ┌─────────────────────┐
│                     │◄────────────────► │                     │
│   Next.js Frontend  │                   │   FastAPI Backend   │
│   (TypeScript)      │◄── REST API ────► │   (Python)          │
│                     │                   │                     │
│   Port: 3000        │                   │   Port: 8000        │
└─────────────────────┘                   └──────────┬──────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │   SQLite Database   │
                                          │   (signal_clone.db) │
                                          └─────────────────────┘
```

### Tech Stack

| Layer        | Technology                                |
|:-------------|:------------------------------------------|
| Frontend     | Next.js 14 (App Router), TypeScript       |
| Styling      | Vanilla CSS (Signal design system)        |
| State        | React Context + Hooks                     |
| Real-time    | Native WebSocket API                      |
| Backend      | Python FastAPI                            |
| Database     | SQLite via SQLAlchemy (async + aiosqlite) |
| Auth         | JWT tokens (PyJWT) + bcrypt               |
| Server       | Uvicorn (ASGI)                            |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **npm**

### 1. Clone the Repository

```bash
git clone <repo-url>
cd secure-message-platform
```

### 2. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Seed the database with sample data
python seed.py

# Start the backend server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start the development server
npm run dev
```

### 4. Open the App

Navigate to **http://localhost:3000** in your browser.

### Demo Accounts

All seeded accounts use the password: `password123`

| Username  | Display Name    | Role                    |
|:----------|:----------------|:------------------------|
| alice     | Alice Johnson   | Has many conversations  |
| bob       | Bob Smith       | Active chatter          |
| charlie   | Charlie Brown   | Group admin             |
| diana     | Diana Prince    | Multiple conversations  |
| eve       | Eve Wilson      | Direct + group chats    |
| frank     | Frank Miller    | Active in groups        |
| grace     | Grace Hopper    | Group member            |
| hank      | Hank Green      | Study group member      |

---

## ✨ Features

### Core Features (Implemented)

#### 1. Authentication / Onboarding
- ✅ Register with username and optional phone number
- ✅ Login with username + password
- ✅ Mocked OTP verification (accepts `123456`)
- ✅ JWT session persistence across page reloads
- ✅ Profile with display name and colored avatar
- ✅ Logout functionality

#### 2. Contacts & Conversation List
- ✅ Left-hand conversation list sorted by most recent activity
- ✅ Search conversations and contacts
- ✅ Add new contacts by username
- ✅ Unread message count badges
- ✅ Last message preview with sender attribution
- ✅ Online / last-seen indicators
- ✅ Timestamps (relative: "Today", "Yesterday", weekday, date)

#### 3. One-on-One Messaging
- ✅ Real-time message delivery via WebSocket
- ✅ Message timestamps
- ✅ Delivery & read receipts (✓ sent, ✓✓ delivered, blue ✓✓ read)
- ✅ Typing indicators (animated dots)
- ✅ Message status tracking: sending → sent → delivered → read
- ✅ All messages persisted in SQLite database
- ✅ Cursor-based pagination for message history

#### 4. Group Messaging
- ✅ Create groups with name and members
- ✅ Send and receive messages in groups
- ✅ View group members in side panel
- ✅ Add / remove members (admin controls)
- ✅ Admin role management
- ✅ System messages for group events (created, member added/removed)
- ✅ Group info panel with member list
- ✅ Edit group name (admin only)
- ✅ Leave group functionality

#### 5. Signal Experience
- ✅ Signal-faithful dark mode design
- ✅ Two-pane layout (conversation list + chat window)
- ✅ Message bubbles (blue outgoing, gray incoming)
- ✅ Colored avatar initials (Signal-style)
- ✅ End-to-end encryption banner (simulated)
- ✅ Settings panel with placeholder sections
- ✅ Toast notifications
- ✅ Smooth animations and transitions
- ✅ Search functionality

### Bonus Features (Implemented)
- ✅ Reply-to / quoted messages (double-click to reply)
- ✅ Dark mode (default)
- ✅ Responsive design (mobile breakpoint)
- ✅ Keyboard shortcuts (Enter to send, Shift+Enter for newline)

### Placeholder Sections
- 📱 Voice / Video calls — "Coming Soon"
- 📖 Stories — Not shown
- 🔗 Linked devices — "Coming Soon" in settings
- 🔐 End-to-end encryption — Simulated with banner

---

## 🗄️ Database Schema

```
┌─────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   users      │     │ conversation_members │     │ conversations│
├─────────────┤     ├─────────────────────┤     ├──────────────┤
│ id (PK)     │◄───┤ user_id (FK)        │    ┌┤ id (PK)      │
│ username    │     │ conversation_id (FK)├───►│ │ type         │
│ phone       │     │ role (admin/member) │    │ │ name         │
│ display_name│     │ joined_at           │    │ │ avatar_color │
│ avatar_url  │     │ last_read_at        │    │ │ created_by   │
│ avatar_color│     └─────────────────────┘    │ │ created_at   │
│ password_hash│                                │ │ updated_at   │
│ status_text │     ┌─────────────────────┐    │ └──────────────┘
│ is_online   │     │    messages          │    │
│ last_seen   │     ├─────────────────────┤    │
│ created_at  │◄───┤ sender_id (FK)      │    │
└─────────────┘     │ conversation_id (FK)├───►┘
       ▲            │ content             │
       │            │ message_type        │
┌──────┴──────┐     │ status              │
│  contacts   │     │ reply_to_id (FK)───►│
├─────────────┤     │ created_at          │
│ id (PK)     │     └──────────┬──────────┘
│ user_id (FK)│                │
│ contact_id  │     ┌──────────┴──────────┐
│ nickname    │     │  message_reads      │
│ created_at  │     ├─────────────────────┤
└─────────────┘     │ id (PK)             │
                    │ message_id (FK)     │
                    │ user_id (FK)        │
                    │ read_at             │
                    └─────────────────────┘
```

### Tables

| Table                 | Purpose                                    |
|:----------------------|:-------------------------------------------|
| `users`               | User accounts with profiles                |
| `contacts`            | User-to-user contact relationships         |
| `conversations`       | Direct and group conversations             |
| `conversation_members`| Maps users to conversations with roles     |
| `messages`            | All chat messages with status tracking     |
| `message_reads`       | Individual read receipts per message       |

---

## 📡 API Overview

### Authentication
| Method | Endpoint               | Description           |
|:-------|:-----------------------|:----------------------|
| POST   | `/api/auth/register`   | Register new user     |
| POST   | `/api/auth/login`      | Login                 |
| POST   | `/api/auth/verify-otp` | Verify mocked OTP     |

### Users
| Method | Endpoint              | Description           |
|:-------|:----------------------|:----------------------|
| GET    | `/api/users/me`       | Get current profile   |
| PUT    | `/api/users/me`       | Update profile        |
| GET    | `/api/users/search`   | Search users          |
| GET    | `/api/users/online`   | Get online user IDs   |

### Contacts
| Method | Endpoint              | Description           |
|:-------|:----------------------|:----------------------|
| GET    | `/api/contacts`       | List contacts         |
| POST   | `/api/contacts`       | Add contact           |
| DELETE | `/api/contacts/{id}`  | Remove contact        |

### Conversations
| Method | Endpoint                               | Description           |
|:-------|:---------------------------------------|:----------------------|
| GET    | `/api/conversations`                   | List conversations    |
| POST   | `/api/conversations`                   | Create conversation   |
| GET    | `/api/conversations/{id}`              | Get conversation      |
| PUT    | `/api/conversations/{id}`              | Update group info     |
| POST   | `/api/conversations/{id}/members`      | Add group member      |
| DELETE | `/api/conversations/{id}/members/{uid}`| Remove member         |
| GET    | `/api/conversations/{id}/messages`     | Get messages (paginated)|
| POST   | `/api/conversations/{id}/messages`     | Send message          |
| PUT    | `/api/conversations/{id}/read`         | Mark as read          |

### WebSocket
| Event            | Direction          | Description              |
|:-----------------|:-------------------|:-------------------------|
| `new_message`    | Server → Client    | New message broadcast    |
| `message_sent`   | Client → Server    | Send message via WS      |
| `typing_start`   | Bidirectional      | User started typing      |
| `typing_stop`    | Bidirectional      | User stopped typing      |
| `message_status` | Server → Client    | Delivery/read receipt    |
| `user_online`    | Server → Client    | User came online         |
| `user_offline`   | Server → Client    | User went offline        |

---

## 📁 Project Structure

```
secure-message-platform/
├── backend/
│   ├── main.py                 # FastAPI app entry point + WebSocket handler
│   ├── database.py             # Async SQLAlchemy engine & sessions
│   ├── models.py               # ORM models (6 tables)
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── auth.py                 # JWT + bcrypt auth utilities
│   ├── websocket_manager.py    # WebSocket connection manager
│   ├── seed.py                 # Database seeder
│   ├── requirements.txt        # Python dependencies
│   └── routes/
│       ├── users.py            # Auth + user routes
│       ├── contacts.py         # Contact management routes
│       ├── conversations.py    # Conversation + group routes
│       └── messages.py         # Message CRUD routes
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout with providers
│   │   │   ├── page.tsx        # Entry point (auth/chat routing)
│   │   │   └── globals.css     # Signal design system (600+ lines)
│   │   ├── components/
│   │   │   ├── AuthPage.tsx    # Login/register UI
│   │   │   ├── ChatApp.tsx     # Main app layout
│   │   │   ├── ConversationList.tsx  # Sidebar with conversations
│   │   │   ├── ChatWindow.tsx  # Chat area + message bubbles
│   │   │   ├── Avatar.tsx      # Reusable avatar component
│   │   │   ├── NewChatModal.tsx    # Create conversation dialog
│   │   │   ├── GroupInfoPanel.tsx   # Group details sidebar
│   │   │   ├── SettingsPanel.tsx    # Settings with placeholders
│   │   │   └── ToastContainer.tsx   # Notification toasts
│   │   ├── context/
│   │   │   ├── AuthContext.tsx # Auth state management
│   │   │   └── ChatContext.tsx # Chat state + WebSocket events
│   │   └── lib/
│   │       ├── api.ts          # REST API client
│   │       └── websocket.ts    # WebSocket client singleton
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

---

## 🔧 Assumptions & Design Decisions

1. **Authentication**: Uses JWT tokens stored in localStorage. Not production-secure, but appropriate for a demo.
2. **OTP Verification**: Mocked — always accepts code `123456`.
3. **Encryption**: Simulated with UI banners. No actual E2E encryption implemented.
4. **Avatars**: Uses colored initial-based avatars (matching Signal's behavior for contacts without photos).
5. **WebSocket**: Direct connection from browser to FastAPI. Supports multiple tabs per user.
6. **Database**: SQLite for simplicity. Schema designed for easy migration to PostgreSQL.
7. **Message Delivery**: Messages are marked "delivered" when the recipient has an active WebSocket connection.
8. **Read Receipts**: Triggered when user opens a conversation, marking all unread messages as read.

---

## 🧪 Testing

### Run the Backend
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Run the Frontend
```bash
cd frontend
npm run dev
```

### Multi-User Testing
1. Open **http://localhost:3000** in one browser tab → Login as `alice`
2. Open **http://localhost:3000** in a private/incognito tab → Login as `bob`
3. Send messages between the two tabs to see real-time delivery

---

## 📄 License

This project is built as a coding assignment demonstration.
