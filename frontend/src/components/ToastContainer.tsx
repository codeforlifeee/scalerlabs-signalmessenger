'use client';

import React from 'react';
import { useChat } from '@/context/ChatContext';

export default function ToastContainer() {
  const { toasts, dismissToast } = useChat();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span style={{ fontSize: '16px' }}>
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => dismissToast(toast.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
