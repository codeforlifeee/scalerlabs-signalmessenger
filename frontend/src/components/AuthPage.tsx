'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

type AuthMode = 'login' | 'register' | 'otp';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(username, displayName, password, phone || undefined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <div className="auth-logo-icon">🔒</div>
          <h1>Signal</h1>
          <p>Privacy is not optional</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                className="form-input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !username || !password}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="auth-switch">
              Don&apos;t have an account?{' '}
              <button type="button" className="btn-text" onClick={() => { setMode('register'); setError(''); }}>
                Create one
              </button>
            </div>
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              background: 'var(--bg-tertiary)', 
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-tertiary)'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>Demo Accounts</div>
              <div>Username: <strong>alice</strong>, <strong>bob</strong>, <strong>charlie</strong>, etc.</div>
              <div>Password: <strong>password123</strong></div>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="form-group">
              <label htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                className="form-input"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-display-name">Display Name</label>
              <input
                id="reg-display-name"
                type="text"
                className="form-input"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-phone">Phone (optional)</label>
              <input
                id="reg-phone"
                type="tel"
                className="form-input"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className="form-input"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !username || !displayName || !password}
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
            <div className="auth-switch">
              Already have an account?{' '}
              <button type="button" className="btn-text" onClick={() => { setMode('login'); setError(''); }}>
                Sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
