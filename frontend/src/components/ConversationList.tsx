'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import Avatar from './Avatar';
import NewChatModal from './NewChatModal';
import type { Conversation } from '@/lib/api';

interface Props {
  onSettingsClick: () => void;
}

export default function ConversationList({ onSettingsClick }: Props) {
  const { user } = useAuth();
  const { conversations, activeConversation, setActiveConversation, onlineUsers } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      const name = getConversationName(conv, user?.id || 0);
      return name.toLowerCase().includes(q) ||
        conv.last_message?.content.toLowerCase().includes(q);
    });
  }, [conversations, searchQuery, user?.id]);

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1>Signal</h1>
        <div className="sidebar-header-actions">
          <button
            className="icon-btn"
            onClick={() => setShowNewChat(true)}
            title="New conversation"
            id="new-chat-btn"
          >
            ✏️
          </button>
          <button
            className="icon-btn"
            onClick={onSettingsClick}
            title="Settings"
            id="settings-btn"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="search-conversations"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="conversation-list">
        {filteredConversations.length === 0 && (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {searchQuery ? 'No conversations found' : 'No conversations yet. Start chatting!'}
          </div>
        )}
        {filteredConversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={activeConversation?.id === conv.id}
            currentUserId={user?.id || 0}
            onlineUsers={onlineUsers}
            onClick={() => setActiveConversation(conv)}
          />
        ))}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} />
      )}
    </div>
  );
}

// ─── Conversation Item ──────────────────────────────────────

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  currentUserId: number;
  onlineUsers: Set<number>;
  onClick: () => void;
}

function ConversationItem({ conversation, isActive, currentUserId, onlineUsers, onClick }: ConversationItemProps) {
  const name = getConversationName(conversation, currentUserId);
  const otherUser = getOtherUser(conversation, currentUserId);
  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const avatarColor = conversation.type === 'group'
    ? conversation.avatar_color || '#3A76F0'
    : otherUser?.avatar_color || '#3A76F0';

  const lastMessage = conversation.last_message;
  const preview = lastMessage
    ? lastMessage.message_type === 'system'
      ? lastMessage.content
      : `${lastMessage.sender_id === currentUserId ? 'You: ' : ''}${lastMessage.content}`
    : 'No messages yet';

  const timeStr = lastMessage?.created_at ? formatTime(lastMessage.created_at) : '';

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      id={`conversation-${conversation.id}`}
    >
      <Avatar
        name={name}
        color={avatarColor}
        size={48}
        showOnline={conversation.type === 'direct'}
        isOnline={isOnline}
        user={otherUser || undefined}
      />
      <div className="conversation-info">
        <div className="conversation-top-row">
          <span className="conversation-name">{name}</span>
          <span className="conversation-time">{timeStr}</span>
        </div>
        <div className="conversation-bottom-row">
          <span className="conversation-preview">{preview}</span>
          {conversation.unread_count > 0 && (
            <span className="unread-badge">{conversation.unread_count}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function getConversationName(conv: Conversation, currentUserId: number): string {
  if (conv.type === 'group') return conv.name || 'Group Chat';
  const other = conv.members.find(m => m.user_id !== currentUserId);
  return other?.user.display_name || 'Unknown User';
}

function getOtherUser(conv: Conversation, currentUserId: number) {
  if (conv.type !== 'direct') return null;
  const other = conv.members.find(m => m.user_id !== currentUserId);
  return other?.user || null;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
