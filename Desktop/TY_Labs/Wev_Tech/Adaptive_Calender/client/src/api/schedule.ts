import { apiFetch } from './client';
import type { ScheduleBlock, ScheduleGenerateResponse } from '../types/index';

export const generateScheduleApi = (date: string, currentEnergy: number) =>
  apiFetch<ScheduleGenerateResponse>('/schedule/generate', {
    method: 'POST',
    body: JSON.stringify({ date, currentEnergy }),
  });

export const getScheduleApi = (date: string) =>
  apiFetch<{ blocks: ScheduleBlock[] }>(`/schedule/${date}`);
