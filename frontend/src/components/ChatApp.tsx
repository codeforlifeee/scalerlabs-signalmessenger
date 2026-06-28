'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import GroupInfoPanel from './GroupInfoPanel';
import SettingsPanel from './SettingsPanel';
import ToastContainer from './ToastContainer';

export default function ChatApp() {
  const { user } = useAuth();
  const { activeConversation } = useChat();
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!user) return null;

  return (
    <div className={`app-container ${activeConversation ? 'chat-open' : ''}`}>
      {showSettings ? (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      ) : (
        <ConversationList onSettingsClick={() => setShowSettings(true)} />
      )}

      <ChatWindow
        onGroupInfoToggle={() => setShowGroupPanel(!showGroupPanel)}
        showGroupPanel={showGroupPanel}
      />

      {showGroupPanel && activeConversation?.type === 'group' && (
        <GroupInfoPanel onClose={() => setShowGroupPanel(false)} />
      )}

      <ToastContainer />
    </div>
  );
}
