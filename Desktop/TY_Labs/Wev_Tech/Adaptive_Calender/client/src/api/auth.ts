import { apiFetch } from './client';
import type { User } from '../types/index';

export interface LoginResponse { token: string; user: User; }
export interface RegisterResponse { token: string; user: User; }

export const loginApi = (email: string, password: string) =>
  apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const registerApi = (name: string, email: string, password: string) =>
  apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

export const getMeApi = () => apiFetch<{ user: User }>('/auth/me');
