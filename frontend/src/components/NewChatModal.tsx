'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { usersAPI, type User } from '@/lib/api';
import Avatar from './Avatar';

interface Props {
  onClose: () => void;
}

type Tab = 'direct' | 'group';

export default function NewChatModal({ onClose }: Props) {
  const { user } = useAuth();
  const { contacts, createDirectConversation, createGroupConversation, setActiveConversation, addContact, loadContacts } = useChat();
  const [tab, setTab] = useState<Tab>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactUsername, setAddContactUsername] = useState('');
  const [addContactError, setAddContactError] = useState('');

  // Search users
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await usersAPI.search(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStartDirectChat = async (otherUser: User) => {
    setIsCreating(true);
    try {
      const conv = await createDirectConversation(otherUser.id);
      setActiveConversation(conv);
      onClose();
    } catch (err) {
      console.error('Failed to create conversation:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setIsCreating(true);
    try {
      const conv = await createGroupConversation(
        groupName.trim(),
        selectedMembers.map(m => m.id)
      );
      setActiveConversation(conv);
      onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleMember = (u: User) => {
    setSelectedMembers(prev =>
      prev.some(m => m.id === u.id)
        ? prev.filter(m => m.id !== u.id)
        : [...prev, u]
    );
  };

  const handleAddContact = async () => {
    if (!addContactUsername.trim()) return;
    setAddContactError('');
    try {
      await addContact(addContactUsername.trim());
      setAddContactUsername('');
      setShowAddContact(false);
      await loadContacts();
    } catch (err: unknown) {
      setAddContactError(err instanceof Error ? err.message : 'Failed to add contact');
    }
  };

  const contactUsers = contacts.map(c => c.contact);

  // Determine what to show
  const displayUsers = searchQuery.length > 0 ? searchResults : contactUsers;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tab === 'direct' ? 'New Conversation' : 'New Group'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <button
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === 'direct' ? '2px solid var(--signal-blue)' : '2px solid transparent',
              color: tab === 'direct' ? 'var(--signal-blue)' : 'var(--text-tertiary)',
              fontWeight: 500,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
            onClick={() => setTab('direct')}
          >
            Direct Message
          </button>
          <button
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === 'group' ? '2px solid var(--signal-blue)' : '2px solid transparent',
              color: tab === 'group' ? 'var(--signal-blue)' : 'var(--text-tertiary)',
              fontWeight: 500,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
            onClick={() => setTab('group')}
          >
            New Group
          </button>
        </div>

        <div className="modal-body">
          {/* Group name input */}
          {tab === 'group' && (
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Group Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                id="group-name-input"
              />
              {selectedMembers.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginTop: '8px',
                }}>
                  {selectedMembers.map(m => (
                    <span
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: 'var(--signal-blue-pale)',
                        borderRadius: '12px',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--signal-blue)',
                      }}
                    >
                      {m.display_name}
                      <button
                        onClick={() => toggleMember(m)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--signal-blue)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '0 2px',
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search input */}
          <div className="search-input-wrapper" style={{ marginBottom: '12px' }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by username or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              id="new-chat-search"
            />
          </div>

          {/* Add Contact button */}
          {!showAddContact && (
            <button
              className="btn-text"
              onClick={() => setShowAddContact(true)}
              style={{ marginBottom: '12px', fontSize: 'var(--font-size-sm)' }}
            >
              + Add a new contact
            </button>
          )}

          {showAddContact && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              alignItems: 'flex-start',
            }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter username"
                  value={addContactUsername}
                  onChange={(e) => { setAddContactUsername(e.target.value); setAddContactError(''); }}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 'var(--font-size-sm)' }}
                  id="add-contact-input"
                />
                {addContactError && (
                  <div style={{ color: 'var(--error-red)', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                    {addContactError}
                  </div>
                )}
              </div>
              <button
                className="btn-primary"
                onClick={handleAddContact}
                style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)' }}
              >
                Add
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setShowAddContact(false); setAddContactError(''); }}
                style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* User list */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {isSearching && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                Searching...
              </div>
            )}

            {!isSearching && displayUsers.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '30px 20px',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
              }}>
                {searchQuery ? 'No users found' : 'No contacts yet. Add one above!'}
              </div>
            )}

            {displayUsers.map(u => {
              const isSelected = selectedMembers.some(m => m.id === u.id);
              return (
                <div
                  key={u.id}
                  className={`user-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => tab === 'direct' ? handleStartDirectChat(u) : toggleMember(u)}
                >
                  <Avatar user={u} size={40} />
                  <div className="user-info">
                    <div className="user-name">{u.display_name}</div>
                    <div className="user-status">@{u.username}</div>
                  </div>
                  {tab === 'group' && (
                    <div className={`checkbox-indicator ${isSelected ? 'checked' : ''}`}>
                      {isSelected && '✓'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {tab === 'group' && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleCreateGroup}
              disabled={isCreating || !groupName.trim() || selectedMembers.length === 0}
            >
              {isCreating ? 'Creating...' : `Create Group (${selectedMembers.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
