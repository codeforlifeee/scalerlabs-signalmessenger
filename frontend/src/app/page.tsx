'use client';

import { useAuth } from '@/context/AuthContext';
import AuthPage from '@/components/AuthPage';
import ChatApp from '@/components/ChatApp';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-page">
        <div style={{ textAlign: 'center' }}>
          <div className="auth-logo-icon" style={{ margin: '0 auto' }}>🔒</div>
          <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <ChatApp />;
}
