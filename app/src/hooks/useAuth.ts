import { useEffect, useState } from 'react';
import { api, UNAUTHORIZED_EVENT } from '../api';
import type { User } from '../types';

type AuthState = { status: 'loading' } | { status: 'authed'; user: User } | { status: 'anon' };

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    api.me()
      .then(user => setAuth({ status: 'authed', user }))
      .catch(() => setAuth({ status: 'anon' }));
  }, []);

  // If any API call sees a 401, fall back to anon so the gate re-renders the
  // login screen instead of letting the user stare at stale data.
  useEffect(() => {
    const handler = () => setAuth({ status: 'anon' });
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  function login() {
    window.location.href = api.loginUrl();
  }

  async function logout() {
    try { await api.logout(); } catch (err) { console.warn('logout request failed', err); }
    setAuth({ status: 'anon' });
  }

  return { auth, login, logout };
}
