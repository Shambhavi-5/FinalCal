export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  type: string;
  durationMinutes: number;
  estimatedEnergy: number;
  adjustedEnergy?: number;
  priority: string;
  deadline?: string;
  status: string;
  date: string;
}

export interface FixedEvent {
  id: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  recurrence?: string;
}

export interface ScheduleBlock {
  id: string;
  kind: 'TASK' | 'BREAK' | 'FIXED';
  status: string;
  startTime: string;
  endTime: string;
  breakType?: string;
  task?: Task;
  fixedEvent?: FixedEvent;
}

export interface EnergyCheckin {
  id: string;
  level: number;
  context: string;
  timestamp: string;
}

export type TaskType = 'DEEP_WORK' | 'STUDY' | 'ADMIN' | 'CREATIVE' | 'PHYSICAL' | 'MEETING' | 'OTHER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SchedulerWarning {
  type: 'DEADLINE_CONFLICT' | 'ENERGY_TOO_LOW' | 'NO_SLOT' | 'DAY_TOO_FULL';
  taskId?: string;
  message: string;
}

export interface ScheduleGenerateResponse {
  blocks: ScheduleBlock[];
  warnings: SchedulerWarning[];
  unscheduled: Task[];
}
