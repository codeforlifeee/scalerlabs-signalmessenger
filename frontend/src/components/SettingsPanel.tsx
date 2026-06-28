'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import Avatar from './Avatar';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="settings-panel">
      {/* Header */}
      <div className="settings-header">
        <button className="icon-btn" onClick={onClose}>←</button>
        <h2>Settings</h2>
      </div>

      {/* Profile */}
      <div className="settings-profile">
        <Avatar user={user} size={80} />
        <div className="settings-name" style={{ marginTop: '12px' }}>{user.display_name}</div>
        <div className="settings-status">{user.status_text || 'Hey there! I am using Signal.'}</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
          @{user.username}
        </div>
      </div>

      {/* Settings sections */}
      <div className="settings-section">
        <div className="settings-item">
          <div className="settings-item-icon" style={{ background: 'var(--signal-blue-pale)' }}>👤</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Account</div>
            <div className="settings-item-desc">Phone number, profile</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon" style={{ background: 'rgba(76, 175, 80, 0.15)' }}>🔐</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Privacy</div>
            <div className="settings-item-desc">Blocked contacts, disappearing messages</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon" style={{ background: 'rgba(255, 167, 38, 0.15)' }}>🔔</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Notifications</div>
            <div className="settings-item-desc">Message, group & call tones</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon" style={{ background: 'rgba(123, 104, 238, 0.15)' }}>🎨</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Appearance</div>
            <div className="settings-item-desc">Theme, wallpaper, font size</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon" style={{ background: 'rgba(66, 165, 245, 0.15)' }}>💾</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Storage and data</div>
            <div className="settings-item-desc">Manage storage, network usage</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-item">
          <div className="settings-item-icon" style={{ background: 'rgba(0, 191, 165, 0.15)' }}>📱</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Linked devices</div>
            <div className="settings-item-desc">Manage linked devices</div>
          </div>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-item">
          <div className="settings-item-icon">❓</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Help</div>
            <div className="settings-item-desc">FAQ, contact us</div>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon">💡</div>
          <div className="settings-item-text">
            <div className="settings-item-label">Invite friends</div>
            <div className="settings-item-desc">Share Signal with friends</div>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="settings-section" style={{ marginTop: 'auto' }}>
        <div
          className="settings-item"
          onClick={logout}
          style={{ cursor: 'pointer' }}
          id="logout-btn"
        >
          <div className="settings-item-icon" style={{ background: 'rgba(239, 83, 80, 0.15)' }}>🚪</div>
          <div className="settings-item-text">
            <div className="settings-item-label" style={{ color: 'var(--error-red)' }}>Log out</div>
          </div>
        </div>
      </div>

      {/* Version */}
      <div style={{
        padding: 'var(--spacing-lg) var(--spacing-xl)',
        textAlign: 'center',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--text-muted)',
      }}>
        Signal Clone v1.0.0
      </div>
    </div>
  );
}
