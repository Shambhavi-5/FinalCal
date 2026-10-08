import { apiFetch } from './client';
import type { EnergyCheckin } from '../types/index';

export interface CreateCheckinInput {
  level: number;
  context: 'DAILY_START' | 'POST_TASK' | 'MANUAL';
  taskId?: string;
  hardnessRating?: number;
}

export const createCheckinApi = (data: CreateCheckinInput) =>
  apiFetch<{ checkin: EnergyCheckin }>('/checkins', {
    method: 'POST',
    body: JSON.stringify(data),
  });
