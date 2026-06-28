'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import Avatar from './Avatar';
import type { Message, User } from '@/lib/api';

interface Props {
  onGroupInfoToggle: () => void;
  showGroupPanel: boolean;
}

export default function ChatWindow({ onGroupInfoToggle, showGroupPanel }: Props) {
  const { user } = useAuth();
  const {
    activeConversation,
    messages,
    typingUsers,
    onlineUsers,
    isLoadingMessages,
    sendMessage,
    startTyping,
    stopTyping,
    setActiveConversation,
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMessagesLengthRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Focus input when conversation changes
  useEffect(() => {
    inputRef.current?.focus();
    setReplyTo(null);
    setInputText('');
  }, [activeConversation?.id]);

  // Get conversation info
  const otherUser = activeConversation?.type === 'direct'
    ? activeConversation.members.find(m => m.user_id !== user?.id)?.user
    : null;

  const convName = activeConversation?.type === 'group'
    ? activeConversation.name
    : otherUser?.display_name || 'Unknown';

  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const memberCount = activeConversation?.members.length || 0;

  // Typing in this conversation
  const conversationTypers = typingUsers
    .filter(t => t.conversationId === activeConversation?.id && t.userId !== user?.id);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim(), replyTo?.id);
    setInputText('');
    setReplyTo(null);
    inputRef.current?.focus();

    // Stop typing
    if (activeConversation) {
      stopTyping(activeConversation.id);
    }
  }, [inputText, replyTo, sendMessage, activeConversation, stopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    if (!activeConversation) return;

    // Typing indicator
    startTyping(activeConversation.id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConversation.id);
    }, 3000);
  };

  // Empty state
  if (!activeConversation) {
    return (
      <div className="chat-area">
        <div className="chat-empty">
          <div className="chat-empty-icon">💬</div>
          <h2>Signal Desktop</h2>
          <p>Select a conversation to start messaging, or create a new one.</p>
          <div className="encryption-banner">
            🔒 <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  const avatarColor = activeConversation.type === 'group'
    ? activeConversation.avatar_color
    : otherUser?.avatar_color;

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        {/* Back button for mobile */}
        <button
          className="icon-btn"
          onClick={() => setActiveConversation(null)}
          style={{ marginRight: '4px', display: 'none' }}
          id="chat-back-btn"
        >
          ←
        </button>

        <Avatar
          name={convName || ''}
          color={avatarColor || '#3A76F0'}
          size={36}
          showOnline={activeConversation.type === 'direct'}
          isOnline={isOnline}
          user={otherUser || undefined}
        />

        <div className="chat-header-info">
          <div className="chat-header-name">{convName}</div>
          <div className="chat-header-status">
            {activeConversation.type === 'direct'
              ? isOnline ? 'Online' : otherUser?.last_seen ? `Last seen ${formatLastSeen(otherUser.last_seen)}` : 'Offline'
              : `${memberCount} members`
            }
          </div>
        </div>

        <div className="chat-header-actions">
          <button className="icon-btn" title="Voice call (Coming Soon)">📞</button>
          <button className="icon-btn" title="Video call (Coming Soon)">📹</button>
          {activeConversation.type === 'group' && (
            <button
              className="icon-btn"
              onClick={onGroupInfoToggle}
              title="Group info"
              style={{ background: showGroupPanel ? 'var(--bg-hover)' : undefined }}
            >
              ℹ️
            </button>
          )}
        </div>
      </div>

      {/* Encryption banner */}
      <div className="encryption-banner">
        🔒 <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {isLoadingMessages ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No messages yet. Say hello! 👋
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showDate = !prevMsg || !isSameDay(msg.created_at || '', prevMsg.created_at || '');
              const showSender = activeConversation.type === 'group'
                && msg.sender_id !== user?.id
                && msg.message_type !== 'system'
                && (!prevMsg || prevMsg.sender_id !== msg.sender_id || prevMsg.message_type === 'system');

              return (
                <React.Fragment key={msg.id}>
                  {showDate && msg.created_at && (
                    <div className="date-separator">
                      <span>{formatDate(msg.created_at)}</span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.sender_id === user?.id}
                    showSenderName={showSender}
                    onReply={() => setReplyTo(msg)}
                  />
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* Typing indicator */}
        {conversationTypers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>
              {getTypingText(conversationTypers, activeConversation)}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply bar */}
      {replyTo && (
        <div className="reply-bar">
          <div className="reply-bar-content">
            <div className="reply-bar-name">
              {replyTo.sender?.display_name || 'Unknown'}
            </div>
            <div className="reply-bar-text">{replyTo.content}</div>
          </div>
          <button className="reply-bar-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* Input */}
      <div className="message-input-container">
        <button className="input-action-btn" title="Attach file (Coming Soon)">📎</button>
        <div className="message-input-wrapper">
          <textarea
            ref={inputRef}
            className="message-input"
            placeholder="Message"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            id="message-input"
          />
          <button className="input-action-btn" title="Emoji">😊</button>
        </div>
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputText.trim()}
          title="Send message"
          id="send-message-btn"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// ─── Message Bubble Component ─────────────────────────────

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSenderName: boolean;
  onReply: () => void;
}

function MessageBubble({ message, isOwn, showSenderName, onReply }: MessageBubbleProps) {
  if (message.message_type === 'system') {
    return (
      <div className="message-system">
        <span>{message.content}</span>
      </div>
    );
  }

  const statusIcon = getStatusIcon(message.status);

  return (
    <div className={`message-row ${isOwn ? 'outgoing' : 'incoming'}`} onDoubleClick={onReply}>
      <div className="message-bubble">
        {showSenderName && message.sender && (
          <div className="message-sender-name" style={{ color: message.sender.avatar_color }}>
            {message.sender.display_name}
          </div>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <div className="reply-preview">
            <div className="reply-preview-name">
              {message.reply_to.sender?.display_name || 'Unknown'}
            </div>
            <div className="reply-preview-text">{message.reply_to.content}</div>
          </div>
        )}

        <span className="message-text">{message.content}</span>

        <div className="message-meta">
          <span className="message-time">
            {message.created_at ? new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }) : ''}
          </span>
          {isOwn && (
            <span className={`message-status ${message.status}`}>
              {statusIcon}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function getStatusIcon(status: string): string {
  switch (status) {
    case 'sending': return '⏳';
    case 'sent': return '✓';
    case 'delivered': return '✓✓';
    case 'read': return '✓✓';
    default: return '✓';
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function isSameDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.toDateString() === d2.toDateString();
}

function formatLastSeen(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getTypingText(
  typers: { userId: number; conversationId: number }[],
  conversation: { members: { user_id: number; user: User }[] }
): string {
  const names = typers.map(t => {
    const member = conversation.members.find(m => m.user_id === t.userId);
    return member?.user.display_name || 'Someone';
  });

  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  return 'Several people are typing...';
}
