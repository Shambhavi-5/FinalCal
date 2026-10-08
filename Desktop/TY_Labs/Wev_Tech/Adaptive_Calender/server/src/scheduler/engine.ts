/**
 * EnergyCal Scheduling Engine
 *
 * Pure module — zero imports from Prisma, Express, or any DB/HTTP library.
 * All exported functions are unit-testable in isolation.
 */

import { Priority, TaskStatus } from "../lib/enums.js";
import type {
  EnergyCurve,
  ScheduledBlock,
  SchedulerInput,
  SchedulerOutput,
  SchedulerTask,
  SchedulerWarning,
} from "./types.js";

// ---------------------------------------------------------------------------
// Module-level break counter — reset to 0 at the start of each schedule() call
// ---------------------------------------------------------------------------
let _breakCounter = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hhmm(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Round a Date up to the next 5-minute boundary. */
function roundUpTo5Min(d: Date): Date {
  const ms = d.getTime();
  const fiveMin = 5 * 60 * 1000;
  const remainder = ms % fiveMin;
  if (remainder === 0) return new Date(ms);
  return new Date(ms + (fiveMin - remainder));
}

/** Return true when two [start, end) intervals overlap. */
function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// ---------------------------------------------------------------------------
// Exported: predictEnergy
// ---------------------------------------------------------------------------

/**
 * Predict the user's energy level at `hour` given their currently reported
 * energy (`currentEnergy`) at `currentHour`, blended with the learned curve.
 *
 * @returns A value clamped to [1, 10].
 */
export function predictEnergy(
  hour: number,
  currentEnergy: number,
  currentHour: number,
  energyCurve: EnergyCurve
): number {
  if (hour === currentHour) return currentEnergy;

  const hoursAway = Math.abs(hour - currentHour);
  const weight = Math.max(0.1, 0.4 - 0.05 * hoursAway);
  const curveValue = energyCurve[hour] ?? 5; // default 5 if curve missing
  const result = weight * currentEnergy + (1 - weight) * curveValue;
  return clamp(result, 1, 10);
}

// ---------------------------------------------------------------------------
// Exported: scoreSlot
// ---------------------------------------------------------------------------

/**
 * Score a candidate slot for a task (0-100).
 *
 * Higher = better fit.
 */
export function scoreSlot(
  task: SchedulerTask,
  slotStart: Date,
  effectiveEnergy: number
): number {
  // Energy match: 1 when energy exactly matches cost, 0 when 9 apart
  const energyMatch = 1 - Math.abs(effectiveEnergy - task.energyCost) / 9;

  // Priority bonus
  let priorityBonus: number;
  if (task.priority === Priority.HIGH) {
    priorityBonus = 1.0;
  } else if (task.priority === Priority.MEDIUM) {
    priorityBonus = 0.6;
  } else {
    priorityBonus = 0.2; // LOW
  }

  // Deadline urgency: tasks with deadlines are placed as early as feasible to
  // leave buffer. Slots that still have plenty of time before the deadline
  // score higher — this pulls tight-deadline tasks toward earlier slots
  // rather than placing them just-in-time and risking a miss.
  let deadlineUrgency: number;
  if (task.deadline === undefined) {
    deadlineUrgency = 0.5;
  } else {
    const hoursUntilDeadline =
      (task.deadline.getTime() - slotStart.getTime()) / 3_600_000;
    // Higher when there's more time left (early slot preferred).
    // Clamp to [0, 1]: 0 when slot is at/past deadline, 1 when 24+ h away.
    deadlineUrgency = Math.max(
      0,
      Math.min(1, hoursUntilDeadline / 24)
    );
  }

  return energyMatch * 50 + priorityBonus * 30 + deadlineUrgency * 20;
}

// ---------------------------------------------------------------------------
// Exported: schedule
// ---------------------------------------------------------------------------

export function schedule(input: SchedulerInput): SchedulerOutput {
  // Reset break counter for determinism within this call
  _breakCounter = 0;

  const warnings: SchedulerWarning[] = [];
  const unscheduled: SchedulerTask[] = [];
  const placed: ScheduledBlock[] = [];

  const {
    date,
    currentEnergy,
    currentTime,
    tasks,
    fixedBlocks,
    energyCurve,
    workStart,
    workEnd,
    breakMinsBetweenTasks = 5,
  } = input;

  // ------------------------------------------------------------------
  // 1. Place fixed blocks first
  // ------------------------------------------------------------------
  for (const fb of fixedBlocks) {
    placed.push({
      id: fb.id,
      kind: "fixed",
      title: fb.title,
      startTime: fb.startTime,
      endTime: fb.endTime,
      reason: "Fixed event — cannot be moved",
    });
  }

  // ------------------------------------------------------------------
  // 2. Pre-checks on fixed block density
  // ------------------------------------------------------------------
  const workStartMs = new Date(date).setHours(workStart, 0, 0, 0);
  const workEndMs = new Date(date).setHours(workEnd, 0, 0, 0);
  const totalWorkMs = workEndMs - workStartMs;

  const totalFixedMs = fixedBlocks.reduce(
    (sum, fb) => sum + (fb.endTime.getTime() - fb.startTime.getTime()),
    0
  );

  if (totalWorkMs > 0 && totalFixedMs / totalWorkMs > 0.8) {
    warnings.push({
      type: "DAY_TOO_FULL",
      message:
        "Fixed events occupy more than 80 % of the working day — little room to schedule tasks.",
    });
  }

  // ------------------------------------------------------------------
  // 3. Filter + sort pending tasks
  // ------------------------------------------------------------------
  const now = currentTime.getTime();

  const pendingTasks: SchedulerTask[] = [];
  for (const task of tasks) {
    if (task.status !== TaskStatus.PENDING) continue;

    // Past-deadline tasks → warning + unscheduled
    if (task.deadline !== undefined && task.deadline.getTime() < now) {
      warnings.push({
        type: "DEADLINE_CONFLICT",
        taskId: task.id,
        message: `Task "${task.title}" has a deadline in the past and cannot be scheduled.`,
      });
      unscheduled.push(task);
      continue;
    }

    pendingTasks.push(task);
  }

  // ENERGY_TOO_LOW check (warn but continue)
  if (pendingTasks.length > 0) {
    const minCost = Math.min(...pendingTasks.map((t) => t.energyCost));
    if (currentEnergy < minCost) {
      warnings.push({
        type: "ENERGY_TOO_LOW",
        message: `Current energy (${currentEnergy}) is below the lowest task energy cost (${minCost}). Schedule may be suboptimal.`,
      });
    }
  }

  // Sort: HIGH first, then earliest deadline (no-deadline last), then energyCost desc
  pendingTasks.sort((a, b) => {
    const priorityOrder: Record<string, number> = {
      [Priority.HIGH]: 0,
      [Priority.MEDIUM]: 1,
      [Priority.LOW]: 2,
    };
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    // Earliest deadline first; no-deadline → treat as very far future
    const da = a.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = b.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;

    // Energy cost descending
    return b.energyCost - a.energyCost;
  });

  // ------------------------------------------------------------------
  // 4. Per-task greedy placement
  // ------------------------------------------------------------------
  const deadlineWarnedTasks = new Set<string>();

  for (const task of pendingTasks) {
    const taskDurationMs = task.durationMinutes * 60 * 1000;

    // Earliest start: max(workStart on date, currentTime rounded up to 5 min)
    const workStartDate = new Date(date);
    workStartDate.setHours(workStart, 0, 0, 0);

    const earliest = new Date(
      Math.max(workStartDate.getTime(), roundUpTo5Min(currentTime).getTime())
    );

    // Latest start: workEnd minus task duration
    const latestStart = new Date(workEndMs - taskDurationMs);

    let bestScore = -Infinity;
    let bestSlot: Date | null = null;
    let bestEffectiveEnergy = currentEnergy;
    let deadlineViolationFound = false;

    // Iterate candidate slots every 5 minutes
    const fiveMin = 5 * 60 * 1000;
    let candidateMs = earliest.getTime();

    // Snap to 5-min boundary
    const remainder = candidateMs % fiveMin;
    if (remainder !== 0) {
      candidateMs += fiveMin - remainder;
    }

    while (candidateMs <= latestStart.getTime()) {
      const slotStart = new Date(candidateMs);
      const slotEnd = new Date(candidateMs + taskDurationMs);

      // Check overlap with placed blocks
      let hasOverlap = false;
      for (const block of placed) {
        if (overlaps(slotStart, slotEnd, block.startTime, block.endTime)) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        // Deadline check: slotEnd must be before deadline
        if (
          task.deadline !== undefined &&
          slotEnd.getTime() > task.deadline.getTime()
        ) {
          // All subsequent slots will be even later, so stop scanning.
          // Only warn if no valid slot has been found yet — if bestSlot is
          // already set the task CAN be placed, just not in this late slot.
          if (bestSlot === null && !deadlineWarnedTasks.has(task.id)) {
            deadlineWarnedTasks.add(task.id);
            deadlineViolationFound = true;
            warnings.push({
              type: "DEADLINE_CONFLICT",
              taskId: task.id,
              message: `Task "${task.title}" cannot finish before its deadline at ${hhmm(task.deadline)} — all remaining slots miss the deadline.`,
            });
          }
          // All subsequent slots will be even later, so break
          break;
        }

        // Cumulative drain from already-placed TASK blocks starting before this slot
        const cumulativeDrain = placed
          .filter(
            (b) =>
              b.kind === "task" && b.startTime.getTime() <= slotStart.getTime()
          )
          .reduce((sum, b) => sum + (b.energyCostEstimate ?? 0), 0);

        const rawEnergy = predictEnergy(
          slotStart.getHours(),
          currentEnergy,
          currentTime.getHours(),
          energyCurve
        );
        const effectiveEnergy = clamp(rawEnergy - cumulativeDrain, 1, 10);

        const score = scoreSlot(task, slotStart, effectiveEnergy);

        if (score > bestScore) {
          bestScore = score;
          bestSlot = slotStart;
          bestEffectiveEnergy = effectiveEnergy;
        }
      }

      candidateMs += fiveMin;
    }

    if (bestSlot !== null) {
      // A valid slot was found (possibly before the deadline boundary was hit)
      const slotStart = bestSlot;
      const slotEnd = new Date(slotStart.getTime() + taskDurationMs);

      const reason = `Placed at ${hhmm(slotStart)} — predicted energy ${bestEffectiveEnergy.toFixed(1)} matches required ${task.energyCost} (priority: ${task.priority})`;

      // Check whether to insert a recovery break before this task.
      // Find the latest task block placed so far.
      const prevTaskBlocks = placed.filter((b) => b.kind === "task");
      const prevBlock =
        prevTaskBlocks.length > 0
          ? prevTaskBlocks.reduce((latest, b) =>
              b.endTime > latest.endTime ? b : latest
            )
          : null;

      // Use currentEnergy (reported now) for the break threshold, not the
      // predicted slot energy. A user who reports energy 3 needs a recovery
      // break before a 7-cost task regardless of what the curve predicts later.
      if (currentEnergy < task.energyCost - 1) {
        if (prevBlock !== null) {
          const gapMs = slotStart.getTime() - prevBlock.endTime.getTime();
          const gapMins = gapMs / 60_000;

          if (gapMins >= 5 && gapMins <= 30) {
            // Fill the natural gap with a recovery break
            const breakId = `break-${_breakCounter++}`;
            placed.push({
              id: breakId,
              kind: "break",
              title: "Recovery break",
              startTime: prevBlock.endTime,
              endTime: slotStart,
              reason: `Inserted recovery break before '${task.title}' — energy was ${bestEffectiveEnergy.toFixed(1)}, task needs ${task.energyCost}`,
            });
          } else if (gapMins > 30) {
            // Gap is large — insert a short recovery break (15 min) immediately
            // before this task so the user gets a prompt to recharge
            const breakDurationMs = 15 * 60_000;
            const breakStart = new Date(slotStart.getTime() - breakDurationMs);
            // Only insert if the break start is after the previous block's end
            if (breakStart.getTime() >= prevBlock.endTime.getTime()) {
              const breakId = `break-${_breakCounter++}`;
              placed.push({
                id: breakId,
                kind: "break",
                title: "Recovery break",
                startTime: breakStart,
                endTime: slotStart,
                reason: `Inserted recovery break before '${task.title}' — energy was ${bestEffectiveEnergy.toFixed(1)}, task needs ${task.energyCost}`,
              });
            }
          }
        } else {
          // No previous task — insert a short recovery break before the very
          // first high-cost task when current energy is too low to handle it
          const breakDurationMs = 15 * 60_000;
          const breakStart = new Date(slotStart.getTime() - breakDurationMs);
          const workStartDate2 = new Date(date);
          workStartDate2.setHours(workStart, 0, 0, 0);
          if (breakStart.getTime() >= Math.max(workStartDate2.getTime(), currentTime.getTime())) {
            const breakId = `break-${_breakCounter++}`;
            placed.push({
              id: breakId,
              kind: "break",
              title: "Recovery break",
              startTime: breakStart,
              endTime: slotStart,
              reason: `Inserted recovery break before '${task.title}' — energy was ${bestEffectiveEnergy.toFixed(1)}, task needs ${task.energyCost}`,
            });
          }
        }
      }

      placed.push({
        id: task.id,
        kind: "task",
        title: task.title,
        startTime: slotStart,
        endTime: slotEnd,
        energyCostEstimate: task.energyCost,
        reason,
      });
    } else if (!deadlineViolationFound) {
      // No slot found and no deadline conflict — truly unschedulable
      warnings.push({
        type: "NO_SLOT",
        taskId: task.id,
        message: `No available slot found for task "${task.title}" within working hours.`,
      });
      unscheduled.push(task);
    } else {
      // Deadline conflict and no valid slot found — already warned
      unscheduled.push(task);
    }
  }

  // ------------------------------------------------------------------
  // 5. Sort all blocks by startTime and return
  // ------------------------------------------------------------------
  placed.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return { blocks: placed, warnings, unscheduled };
}

// ---------------------------------------------------------------------------
// Exported: reschedule
// ---------------------------------------------------------------------------

export function reschedule(
  input: SchedulerInput,
  completedTaskId: string,
  remainingEnergy: number,
  existingBlocks: ScheduledBlock[]
): SchedulerOutput {
  // Build a map of old placements: taskId → old ScheduledBlock
  const oldPlacementByTaskId = new Map<string, ScheduledBlock>();
  for (const block of existingBlocks) {
    if (block.kind === "task") {
      oldPlacementByTaskId.set(block.id, block);
    }
  }

  // Build a new input excluding completed/skipped tasks and the just-completed one
  const remainingTasks = input.tasks.filter(
    (t) =>
      t.id !== completedTaskId &&
      t.status !== TaskStatus.COMPLETED &&
      t.status !== TaskStatus.SKIPPED
  );

  const newInput: SchedulerInput = {
    ...input,
    currentEnergy: remainingEnergy,
    // Use the caller-supplied currentTime (from input) so the function remains
    // pure and deterministic in tests. Callers that want "right now" should
    // update input.currentTime before calling reschedule().
    tasks: remainingTasks,
  };

  const result = schedule(newInput);

  // Annotate blocks that moved from their old time slot
  for (const block of result.blocks) {
    if (block.kind !== "task") continue;

    const oldBlock = oldPlacementByTaskId.get(block.id);
    if (oldBlock === undefined) continue; // new or previously unscheduled

    const oldStartMs = oldBlock.startTime.getTime();
    const newStartMs = block.startTime.getTime();

    if (oldStartMs !== newStartMs) {
      // Find the task to get its energyCost
      const task = input.tasks.find((t) => t.id === block.id);
      const taskEnergyCost = task?.energyCost ?? block.energyCostEstimate ?? 0;

      block.reason = `Rescheduled from ${hhmm(oldBlock.startTime)} to ${hhmm(block.startTime)} because energy dropped to ${remainingEnergy} (task needs ${taskEnergyCost})`;
    }
  }

  return result;
}
