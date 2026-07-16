/**
 * AuthContext — manages Bearer token + user, works on Expo Go, iOS, Android, Web.
 *
 * Google flow uses Emergent's /auth/v1/env/oauth/session-data hosted UI.
 * The backend upserts the user, persists the session, and returns the same
 * `session_token` as the Bearer.
 *
 * Email/password login returns a JWT; both tokens are accepted by the backend.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { AuthApi, TOKEN_KEY } from '@/src/api/client';
import { storage } from '@/src/utils/storage';

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: 'email' | 'google';
  language: string;
  theme: 'dark' | 'amoled' | 'light';
  onboarding_completed: boolean;
}

interface AuthContextValue {
  loading: boolean;
  user: AuthUser | null;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  markOnboardingDone: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMERGENT_AUTH_URL = 'https://auth.emergentagent.com/';

async function persistToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

function getWebRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin + '/';
}

function parseSessionIdFromUrl(url: string): string | null {
  try {
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const hash = url.slice(hashIndex + 1);
      const params = new URLSearchParams(hash);
      const s = params.get('session_id');
      if (s) return s;
    }
    const qIndex = url.indexOf('?');
    if (qIndex !== -1) {
      const q = url.slice(qIndex + 1).split('#')[0];
      const params = new URLSearchParams(q);
      const s = params.get('session_id');
      if (s) return s;
    }
  } catch {}
  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const applyLogin = useCallback(async (token: string) => {
    await persistToken(token);
    const me = await AuthApi.me();
    setUser(me as AuthUser);
  }, []);

  const bootstrapFromWebSessionIfNeeded = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    const sessionId = parseSessionIdFromUrl(window.location.href);
    if (!sessionId) return false;
    try {
      const res = await fetch(
        'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
        { headers: { 'X-Session-ID': sessionId } },
      );
      if (!res.ok) return false;
      const data = await res.json();
      const exchanged = await AuthApi.googleSession(data.session_token);
      await applyLogin(exchanged.token);
      window.history.replaceState(null, '', window.location.pathname);
      return true;
    } catch {
      return false;
    }
  }, [applyLogin]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await AuthApi.me();
      setUser(me as AuthUser);
    } catch {
      setUser(null);
      await clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const consumed = await bootstrapFromWebSessionIfNeeded();
        if (!consumed) {
          const token = await storage.secureGet<string>(TOKEN_KEY, '' as string);
          if (token) {
            try {
              const me = await AuthApi.me();
              setUser(me as AuthUser);
            } catch {
              await clearToken();
              setUser(null);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [bootstrapFromWebSessionIfNeeded]);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const res = await AuthApi.login(email, password);
    await applyLogin(res.token);
  }, [applyLogin]);

  const registerEmail = useCallback(async (email: string, password: string, name: string) => {
    const res = await AuthApi.register(email, password, name);
    await applyLogin(res.token);
  }, [applyLogin]);

  const loginWithGoogle = useCallback(async () => {
    const redirectUrl = Platform.OS === 'web' ? getWebRedirectUrl() : Linking.createURL('');
    const authUrl = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== 'success' || !result.url) return;
    const sessionId = parseSessionIdFromUrl(result.url);
    if (!sessionId) return;

    const dataRes = await fetch(
      'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
      { headers: { 'X-Session-ID': sessionId } },
    );
    if (!dataRes.ok) throw { status: dataRes.status, detail: 'Google session lookup failed' };
    const data = await dataRes.json();
    const exchanged = await AuthApi.googleSession(data.session_token);
    await applyLogin(exchanged.token);
  }, [applyLogin]);

  const logout = useCallback(async () => {
    try { await AuthApi.logout(); } catch {}
    await clearToken();
    setUser(null);
  }, []);

  const markOnboardingDone = useCallback(async () => {
    try {
      const updated = await import('@/src/api/client').then(m => m.ProfileApi.update({ onboarding_completed: true }));
      setUser(updated as AuthUser);
    } catch {}
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loading, user, loginEmail, registerEmail, loginWithGoogle, refreshUser, logout, markOnboardingDone,
  }), [loading, user, loginEmail, registerEmail, loginWithGoogle, refreshUser, logout, markOnboardingDone]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
