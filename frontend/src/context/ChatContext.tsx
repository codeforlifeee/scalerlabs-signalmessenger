'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  conversationsAPI,
  contactsAPI,
  type Conversation,
  type Message,
  type Contact,
  type User,
} from '@/lib/api';
import wsClient from '@/lib/websocket';
import { useAuth } from './AuthContext';

interface TypingUser {
  userId: number;
  conversationId: number;
}

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  contacts: Contact[];
  typingUsers: TypingUser[];
  onlineUsers: Set<number>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  setActiveConversation: (conv: Conversation | null) => void;
  sendMessage: (content: string, replyToId?: number) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: number) => Promise<void>;
  loadContacts: () => Promise<void>;
  createDirectConversation: (userId: number) => Promise<Conversation>;
  createGroupConversation: (name: string, memberIds: number[]) => Promise<Conversation>;
  addContact: (username: string) => Promise<Contact>;
  removeContact: (id: number) => Promise<void>;
  startTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
  markAsRead: (conversationId: number) => void;
  addGroupMember: (convId: number, userId: number) => Promise<void>;
  removeGroupMember: (convId: number, userId: number) => Promise<void>;
  updateGroupInfo: (convId: number, data: { name?: string; avatar_color?: string }) => Promise<void>;
  toasts: ToastMessage[];
  addToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversationState] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const activeConvRef = useRef<Conversation | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Toast Management ────────────────────────────────────
  const addToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Data Loading ────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingConversations(true);
    try {
      const data = await conversationsAPI.list();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [isAuthenticated]);

  const loadMessages = useCallback(async (conversationId: number) => {
    setIsLoadingMessages(true);
    try {
      const data = await conversationsAPI.getMessages(conversationId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await contactsAPI.list();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }, [isAuthenticated]);

  // ─── Active Conversation ─────────────────────────────────
  const setActiveConversation = useCallback((conv: Conversation | null) => {
    setActiveConversationState(conv);
    activeConvRef.current = conv;
    if (conv) {
      loadMessages(conv.id);
      // Mark as read
      conversationsAPI.markRead(conv.id).catch(console.error);
      // Update unread count locally
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    } else {
      setMessages([]);
    }
  }, [loadMessages]);

  // ─── Message Sending ─────────────────────────────────────
  const sendMessage = useCallback((content: string, replyToId?: number) => {
    if (!activeConvRef.current || !content.trim()) return;

    wsClient.send('message_sent', {
      conversation_id: activeConvRef.current.id,
      content: content.trim(),
      reply_to_id: replyToId || null,
      message_type: 'text',
    });
  }, []);

  // ─── Typing Indicators ──────────────────────────────────
  const startTyping = useCallback((conversationId: number) => {
    wsClient.send('typing_start', { conversation_id: conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: number) => {
    wsClient.send('typing_stop', { conversation_id: conversationId });
  }, []);

  // ─── Read Receipts ───────────────────────────────────────
  const markAsRead = useCallback((conversationId: number) => {
    wsClient.send('message_read', { conversation_id: conversationId });
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
    );
  }, []);

  // ─── Conversation Creation ───────────────────────────────
  const createDirectConversation = useCallback(async (userId: number) => {
    const conv = await conversationsAPI.create({
      type: 'direct',
      member_ids: [userId],
    });
    await loadConversations();
    return conv;
  }, [loadConversations]);

  const createGroupConversation = useCallback(async (name: string, memberIds: number[]) => {
    const conv = await conversationsAPI.create({
      type: 'group',
      name,
      member_ids: memberIds,
    });
    await loadConversations();
    addToast(`Group "${name}" created!`, 'success');
    return conv;
  }, [loadConversations, addToast]);

  // ─── Contact Management ──────────────────────────────────
  const addContact = useCallback(async (username: string) => {
    const contact = await contactsAPI.add(username);
    await loadContacts();
    addToast(`${contact.contact.display_name} added to contacts`, 'success');
    return contact;
  }, [loadContacts, addToast]);

  const removeContact = useCallback(async (id: number) => {
    await contactsAPI.remove(id);
    await loadContacts();
  }, [loadContacts]);

  // ─── Group Management ────────────────────────────────────
  const addGroupMember = useCallback(async (convId: number, userId: number) => {
    await conversationsAPI.addMember(convId, userId);
    await loadConversations();
    if (activeConvRef.current?.id === convId) {
      const updated = await conversationsAPI.get(convId);
      setActiveConversationState(updated);
      activeConvRef.current = updated;
    }
  }, [loadConversations]);

  const removeGroupMember = useCallback(async (convId: number, userId: number) => {
    await conversationsAPI.removeMember(convId, userId);
    await loadConversations();
    if (activeConvRef.current?.id === convId) {
      const updated = await conversationsAPI.get(convId);
      setActiveConversationState(updated);
      activeConvRef.current = updated;
    }
  }, [loadConversations]);

  const updateGroupInfo = useCallback(async (convId: number, data: { name?: string; avatar_color?: string }) => {
    await conversationsAPI.update(convId, data);
    await loadConversations();
    if (activeConvRef.current?.id === convId) {
      const updated = await conversationsAPI.get(convId);
      setActiveConversationState(updated);
      activeConvRef.current = updated;
    }
  }, [loadConversations]);

  // ─── WebSocket Events ────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Connect WebSocket
    wsClient.connect();

    const handleNewMessage = (data: Record<string, unknown>) => {
      const msg = data as unknown as Message;

      // Add to messages if viewing this conversation
      if (activeConvRef.current?.id === msg.conversation_id) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // Auto mark as read if we're viewing it
        if (msg.sender_id !== user.id) {
          conversationsAPI.markRead(msg.conversation_id).catch(console.error);
        }
      } else {
        // Increment unread count
        setConversations(prev =>
          prev.map(c =>
            c.id === msg.conversation_id
              ? { ...c, unread_count: c.unread_count + (msg.sender_id !== user.id ? 1 : 0), last_message: msg }
              : c
          )
        );
      }

      // Update conversation list with last message
      setConversations(prev => {
        const updated = prev.map(c =>
          c.id === msg.conversation_id ? { ...c, last_message: msg, updated_at: msg.created_at } : c
        );
        // Sort by most recent
        return updated.sort((a, b) => {
          const aTime = a.last_message?.created_at || a.updated_at || '';
          const bTime = b.last_message?.created_at || b.updated_at || '';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
      });
    };

    const handleMessageStatus = (data: Record<string, unknown>) => {
      const { message_id, status } = data as { message_id: number; status: string; conversation_id: number };
      setMessages(prev =>
        prev.map(m => m.id === message_id ? { ...m, status } : m)
      );
    };

    const handleTypingStart = (data: Record<string, unknown>) => {
      const { user_id, conversation_id } = data as { user_id: number; conversation_id: number };
      setTypingUsers(prev => {
        if (prev.some(t => t.userId === user_id && t.conversationId === conversation_id)) return prev;
        return [...prev, { userId: user_id, conversationId: conversation_id }];
      });

      // Auto-clear after 5 seconds
      setTimeout(() => {
        setTypingUsers(prev =>
          prev.filter(t => !(t.userId === user_id && t.conversationId === conversation_id))
        );
      }, 5000);
    };

    const handleTypingStop = (data: Record<string, unknown>) => {
      const { user_id, conversation_id } = data as { user_id: number; conversation_id: number };
      setTypingUsers(prev =>
        prev.filter(t => !(t.userId === user_id && t.conversationId === conversation_id))
      );
    };

    const handleUserOnline = (data: Record<string, unknown>) => {
      const { user_id } = data as { user_id: number };
      setOnlineUsers(prev => new Set([...prev, user_id]));
    };

    const handleUserOffline = (data: Record<string, unknown>) => {
      const { user_id } = data as { user_id: number };
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(user_id);
        return next;
      });
    };

    wsClient.on('new_message', handleNewMessage);
    wsClient.on('message_status', handleMessageStatus);
    wsClient.on('typing_start', handleTypingStart);
    wsClient.on('typing_stop', handleTypingStop);
    wsClient.on('user_online', handleUserOnline);
    wsClient.on('user_offline', handleUserOffline);

    // Initial data load
    loadConversations();
    loadContacts();

    return () => {
      wsClient.off('new_message', handleNewMessage);
      wsClient.off('message_status', handleMessageStatus);
      wsClient.off('typing_start', handleTypingStart);
      wsClient.off('typing_stop', handleTypingStop);
      wsClient.off('user_online', handleUserOnline);
      wsClient.off('user_offline', handleUserOffline);
      wsClient.disconnect();
    };
  }, [isAuthenticated, user, loadConversations, loadContacts]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        messages,
        contacts,
        typingUsers,
        onlineUsers,
        isLoadingConversations,
        isLoadingMessages,
        setActiveConversation,
        sendMessage,
        loadConversations,
        loadMessages,
        loadContacts,
        createDirectConversation,
        createGroupConversation,
        addContact,
        removeContact,
        startTyping,
        stopTyping,
        markAsRead,
        addGroupMember,
        removeGroupMember,
        updateGroupInfo,
        toasts,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
