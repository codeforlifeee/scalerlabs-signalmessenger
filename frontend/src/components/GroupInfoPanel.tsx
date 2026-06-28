'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { usersAPI, type User } from '@/lib/api';
import Avatar from './Avatar';

interface Props {
  onClose: () => void;
}

export default function GroupInfoPanel({ onClose }: Props) {
  const { user } = useAuth();
  const { activeConversation, addGroupMember, removeGroupMember, updateGroupInfo, addToast } = useChat();
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(activeConversation?.name || '');

  if (!activeConversation || activeConversation.type !== 'group') return null;

  const isAdmin = activeConversation.members.some(
    m => m.user_id === user?.id && m.role === 'admin'
  );

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await usersAPI.search(q);
      // Filter out existing members
      const memberIds = new Set(activeConversation.members.map(m => m.user_id));
      setSearchResults(results.filter(u => !memberIds.has(u.id)));
    } catch {
      setSearchResults([]);
    }
  };

  const handleAddMember = async (userId: number) => {
    try {
      await addGroupMember(activeConversation.id, userId);
      setShowAddMember(false);
      setSearchQuery('');
      setSearchResults([]);
      addToast('Member added successfully', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to add member', 'error');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await removeGroupMember(activeConversation.id, userId);
      addToast('Member removed', 'info');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  const handleUpdateName = async () => {
    if (editName.trim() && editName.trim() !== activeConversation.name) {
      try {
        await updateGroupInfo(activeConversation.id, { name: editName.trim() });
        addToast('Group name updated', 'success');
      } catch {
        addToast('Failed to update group name', 'error');
      }
    }
    setIsEditing(false);
  };

  return (
    <div className="group-panel">
      {/* Header */}
      <div className="group-panel-header">
        <button className="icon-btn" onClick={onClose}>✕</button>
        <h2>Group Info</h2>
      </div>

      {/* Group Avatar & Name */}
      <div className="group-panel-info">
        <div
          className="group-panel-avatar"
          style={{ backgroundColor: activeConversation.avatar_color || '#3A76F0' }}
        >
          {(activeConversation.name || 'G')[0].toUpperCase()}
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <input
              type="text"
              className="form-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              autoFocus
              style={{ maxWidth: '200px', textAlign: 'center' }}
            />
            <button className="btn-primary" onClick={handleUpdateName} style={{ padding: '8px 12px' }}>✓</button>
          </div>
        ) : (
          <div
            className="group-panel-name"
            onClick={() => isAdmin && setIsEditing(true)}
            style={{ cursor: isAdmin ? 'pointer' : 'default' }}
            title={isAdmin ? 'Click to edit' : ''}
          >
            {activeConversation.name}
            {isAdmin && <span style={{ fontSize: '12px', marginLeft: '6px', opacity: 0.5 }}>✏️</span>}
          </div>
        )}
        <div className="group-panel-members-count">
          {activeConversation.members.length} members
        </div>
      </div>

      {/* Members */}
      <div className="group-panel-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Members</h3>
          {isAdmin && (
            <button
              className="btn-text"
              onClick={() => setShowAddMember(!showAddMember)}
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              + Add
            </button>
          )}
        </div>

        {/* Add member search */}
        {showAddMember && (
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search users to add..."
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
              autoFocus
              style={{ width: '100%', marginBottom: '8px', padding: '8px 12px', fontSize: 'var(--font-size-sm)' }}
            />
            {searchResults.map(u => (
              <div
                key={u.id}
                className="user-list-item"
                onClick={() => handleAddMember(u.id)}
              >
                <Avatar user={u} size={32} />
                <div className="user-info">
                  <div className="user-name" style={{ fontSize: 'var(--font-size-sm)' }}>{u.display_name}</div>
                  <div className="user-status">@{u.username}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Members list */}
        {activeConversation.members.map(member => (
          <div key={member.id} className="member-item">
            <Avatar user={member.user} size={36} />
            <div className="member-info">
              <div className="member-name">
                {member.user.display_name}
                {member.user_id === user?.id && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', marginLeft: '4px' }}>
                    (You)
                  </span>
                )}
              </div>
              <div className="member-role">
                {member.role === 'admin' ? 'Admin' : 'Member'}
              </div>
            </div>
            {isAdmin && member.user_id !== user?.id && (
              <button
                className="member-remove-btn"
                onClick={() => handleRemoveMember(member.user_id)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="group-panel-section">
        <h3>Shared Media</h3>
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          No shared media yet
        </div>
      </div>

      <div className="group-panel-section">
        <div className="settings-item" style={{ padding: '12px 0' }}>
          <span style={{ fontSize: '16px' }}>🔔</span>
          <div className="settings-item-text">
            <div className="settings-item-label">Notifications</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
        <div className="settings-item" style={{ padding: '12px 0' }}>
          <span style={{ fontSize: '16px' }}>⏱️</span>
          <div className="settings-item-text">
            <div className="settings-item-label">Disappearing Messages</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
      </div>

      {/* Leave group */}
      <div className="group-panel-section">
        <button
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--error-red)',
            fontSize: 'var(--font-size-base)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onClick={() => user && handleRemoveMember(user.id)}
        >
          🚪 Leave Group
        </button>
      </div>
    </div>
  );
}
