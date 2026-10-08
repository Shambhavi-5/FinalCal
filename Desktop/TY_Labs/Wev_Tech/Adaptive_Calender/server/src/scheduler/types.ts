export interface SchedulerTask {
  id: string;
  title: string;
  type: string;           // TaskType value
  durationMinutes: number;
  energyCost: number;     // adjusted estimate (1-10); use this for scheduling
  priority: string;       // Priority value
  deadline?: Date;
  status: string;         // TaskStatus value — only PENDING tasks are scheduled
}

export interface FixedBlock {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
}

// 24-element array indexed by hour 0-23; each value is the user's average energy at that hour
export type EnergyCurve = number[];  // length 24, values 1-10

export interface SchedulerInput {
  date: Date;                        // the calendar day being scheduled (midnight UTC)
  currentEnergy: number;             // user's reported energy at scheduling time (1-10)
  currentTime: Date;                 // when scheduling is happening (for "from now" constraint)
  tasks: SchedulerTask[];            // tasks to schedule (PENDING status)
  fixedBlocks: FixedBlock[];         // fixed events that cannot move
  energyCurve: EnergyCurve;         // learned per-hour energy
  workStart: number;                 // hour of day work begins, e.g. 8
  workEnd: number;                   // hour of day work ends, e.g. 22
  breakMinsBetweenTasks?: number;    // default gap between task blocks, default 5
}

export type ScheduledBlockKind = "task" | "break" | "fixed";

export interface ScheduledBlock {
  id: string;                        // matches SchedulerTask.id or FixedBlock.id or generated break id
  kind: ScheduledBlockKind;
  title: string;
  startTime: Date;
  endTime: Date;
  energyCostEstimate?: number;       // for task blocks
  reason: string;                    // human-readable explanation of why placed here
}

export interface SchedulerWarning {
  type: "DEADLINE_CONFLICT" | "ENERGY_TOO_LOW" | "NO_SLOT" | "DAY_TOO_FULL";
  taskId?: string;
  message: string;
}

export interface SchedulerOutput {
  blocks: ScheduledBlock[];          // ordered by startTime
  warnings: SchedulerWarning[];      
  unscheduled: SchedulerTask[];      // tasks that could not be placed
}
