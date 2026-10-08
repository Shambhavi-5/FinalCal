import { create } from 'zustand';
import type { User } from '../types/index';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('ec_token', token);
    localStorage.setItem('ec_user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('ec_token');
    localStorage.removeItem('ec_user');
    set({ user: null, token: null });
  },
  hydrate: () => {
    const token = localStorage.getItem('ec_token');
    const userStr = localStorage.getItem('ec_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, token });
      } catch {
        localStorage.removeItem('ec_token');
        localStorage.removeItem('ec_user');
      }
    }
  },
}));
