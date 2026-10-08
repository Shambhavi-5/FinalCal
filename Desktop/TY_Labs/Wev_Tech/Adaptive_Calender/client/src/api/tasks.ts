import { apiFetch } from './client';
import type { Task } from '../types/index';

export interface CreateTaskInput {
  title: string;
  type: string;
  durationMinutes: number;
  estimatedEnergy: number;
  priority: string;
  deadline?: string;
  date: string;
}

export const createTaskApi = (data: CreateTaskInput) =>
  apiFetch<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getTasksApi = (date?: string) =>
  apiFetch<{ tasks: Task[] }>('/tasks' + (date ? `?date=${date}` : ''));

export const deleteTaskApi = (id: string) =>
  apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
