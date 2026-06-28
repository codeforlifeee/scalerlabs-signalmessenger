'use client';

import React from 'react';
import type { User } from '@/lib/api';

interface AvatarProps {
  user?: User | null;
  name?: string;
  color?: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
}

export default function Avatar({ user, name, color, size = 48, showOnline = false, isOnline = false }: AvatarProps) {
  const displayName = user?.display_name || name || '?';
  const avatarColor = user?.avatar_color || color || '#3A76F0';
  const initials = getInitials(displayName);

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        minWidth: size,
        backgroundColor: avatarColor,
        fontSize: size * 0.38,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        color: 'white',
        position: 'relative',
      }}
    >
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={displayName}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        initials
      )}
      {showOnline && isOnline && (
        <div className="online-indicator" style={{
          width: Math.max(10, size * 0.25),
          height: Math.max(10, size * 0.25),
        }} />
      )}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
