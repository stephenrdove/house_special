import { useEffect, useState } from 'react';
import { api } from '../api';
import type { User } from '../types';

type AuthState = { status: 'loading' } | { status: 'authed'; user: User } | { status: 'anon' };

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    api.me()
      .then(user => setAuth({ status: 'authed', user }))
      .catch(() => setAuth({ status: 'anon' }));
  }, []);

  function login() {
    window.location.href = api.loginUrl();
  }

  async function logout() {
    await api.logout().catch(() => {});
    setAuth({ status: 'anon' });
  }

  return { auth, login, logout };
}
