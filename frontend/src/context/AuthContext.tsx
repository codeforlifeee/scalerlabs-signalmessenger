'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authAPI, usersAPI, setToken, getToken, clearToken, type User, type AuthResponse } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = getToken();
      if (token) {
        try {
          const userData = await usersAPI.getMe();
          setUser(userData);
        } catch {
          clearToken();
        }
      }
      setIsLoading(false);
    };
    restoreSession();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response: AuthResponse = await authAPI.login({ username, password });
    setToken(response.access_token);
    setUser(response.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('signal_user', JSON.stringify(response.user));
    }
  }, []);

  const register = useCallback(async (username: string, displayName: string, password: string, phone?: string) => {
    const response: AuthResponse = await authAPI.register({
      username,
      display_name: displayName,
      password,
      phone,
    });
    setToken(response.access_token);
    setUser(response.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('signal_user', JSON.stringify(response.user));
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (data: Partial<User>) => {
    const updated = await usersAPI.updateMe(data);
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
