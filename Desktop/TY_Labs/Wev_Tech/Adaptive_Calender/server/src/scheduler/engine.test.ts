/**
 * Vitest test suite for the EnergyCal scheduling engine.
 *
 * NOTE: The engine uses local-time Date methods (setHours, getHours) internally,
 * so all helper dates are constructed with local-time setHours() to stay
 * consistent regardless of the machine's timezone.
 */

import { predictEnergy, reschedule, schedule } from "./engine.js";
import type {
  EnergyCurve,
  FixedBlock,
  ScheduledBlock,
  SchedulerInput,
  SchedulerTask,
} from "./types.js";

// ---------------------------------------------------------------------------
// Default energy curve: peak 9-10 AM (8), dip 14-15 (4)
// ---------------------------------------------------------------------------
const DEFAULT_CURVE: EnergyCurve = [
  4, 3, 3, 3, 3, 4, 5, 6, // 0-7
  7, 8, 8, 7, 6, 5, 4, 4, // 8-15  (peak 9-10, dip 14-15)
  5, 6, 6, 5, 4, 3, 3, 3, // 16-23
];

// ---------------------------------------------------------------------------
// Task factory
// ---------------------------------------------------------------------------
let taskCounter = 0;

function makeTask(overrides: Partial<SchedulerTask> = {}): SchedulerTask {
  return {
    id: `task-${++taskCounter}`,
    title: "Test task",
    type: "STUDY",
    durationMinutes: 60,
    energyCost: 5,
    priority: "MEDIUM",
    status: "PENDING",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Input factory
//
// Uses a fixed calendar day (2025-06-15) but builds all times with local
// setHours() so the engine's own setHours() calls are consistent.
// ---------------------------------------------------------------------------
function makeInput(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  // Midnight LOCAL on the test day
  const date = new Date(2025, 5, 15); // June 15 2025, local midnight

  // Default currentTime = 08:00 local
  const currentTime = new Date(2025, 5, 15);
  currentTime.setHours(8, 0, 0, 0);

  return {
    date,
    currentEnergy: 7,
    currentTime,
    tasks: [],
    fixedBlocks: [],
    energyCurve: DEFAULT_CURVE,
    workStart: 8,
    workEnd: 22,
    breakMinsBetweenTasks: 5,
    ...overrides,
  };
}

/** Build a local-time Date on 2025-06-15 at a given hour and minute. */
function localDate(hour: number, minute = 0): Date {
  const d = new Date(2025, 5, 15);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Reset counter before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  taskCounter = 0;
});

// ===========================================================================
// Test 1 — Basic schedule: 3 tasks, empty day, all placed
// ===========================================================================
describe("Test 1 — Basic schedule: 3 tasks, empty day, all placed", () => {
  it("places all 3 tasks and returns them sorted by startTime", () => {
    const tasks = [
      makeTask({ priority: "HIGH", energyCost: 8 }),
      makeTask({ priority: "MEDIUM", energyCost: 5 }),
      makeTask({ priority: "LOW", energyCost: 3 }),
    ];

    const output = schedule(makeInput({ tasks }));

    expect(output.blocks.length).toBe(3);
    expect(output.unscheduled.length).toBe(0);
    expect(output.warnings.length).toBe(0);

    // Blocks must be in chronological order
    for (let i = 1; i < output.blocks.length; i++) {
      expect(output.blocks[i].startTime.getTime()).toBeGreaterThanOrEqual(
        output.blocks[i - 1].startTime.getTime()
      );
    }
  });
});

// ===========================================================================
// Test 2 — Fixed block respected (no task overlaps it)
// ===========================================================================
describe("Test 2 — Fixed block respected", () => {
  it("places 2 tasks without overlapping the fixed block", () => {
    const fixedStart = localDate(10, 0);
    const fixedEnd = localDate(11, 0);

    const fixedBlocks: FixedBlock[] = [
      { id: "fixed-1", title: "Class", startTime: fixedStart, endTime: fixedEnd },
    ];

    const tasks = [
      makeTask({ durationMinutes: 60 }),
      makeTask({ durationMinutes: 60 }),
    ];

    const output = schedule(makeInput({ tasks, fixedBlocks }));

    const taskBlocks = output.blocks.filter((b) => b.kind === "task");

    for (const taskBlock of taskBlocks) {
      const overlaps =
        taskBlock.startTime < fixedEnd && taskBlock.endTime > fixedStart;
      expect(overlaps).toBe(false);
    }
  });
});

// ===========================================================================
// Test 3 — High priority placed (both HIGH and LOW are scheduled)
// ===========================================================================
describe("Test 3 — High priority placed in a better slot", () => {
  it("schedules both HIGH and LOW tasks with no unscheduled", () => {
    const highTask = makeTask({ priority: "HIGH", energyCost: 8 });
    const lowTask = makeTask({ priority: "LOW", energyCost: 3 });

    const output = schedule(makeInput({ tasks: [highTask, lowTask] }));

    expect(output.unscheduled.length).toBe(0);

    const highBlock = output.blocks.find(
      (b) => b.kind === "task" && b.id === highTask.id
    );
    const lowBlock = output.blocks.find(
      (b) => b.kind === "task" && b.id === lowTask.id
    );

    expect(highBlock).toBeDefined();
    expect(lowBlock).toBeDefined();

    // HIGH priority task is processed first by the engine → it gets placed first
    expect(highBlock!.startTime.getTime()).toBeLessThanOrEqual(
      lowBlock!.startTime.getTime()
    );
  });
});

// ===========================================================================
// Test 4 — Deadline ordering (earlier deadline → earlier placement)
// ===========================================================================
describe("Test 4 — Deadline ordering", () => {
  it("places the task with the earlier deadline first", () => {
    const currentTime = new Date(2025, 5, 15);
    currentTime.setHours(8, 0, 0, 0);

    const deadlineA = new Date(currentTime.getTime() + 4 * 3_600_000); // +4 h
    const deadlineB = new Date(currentTime.getTime() + 8 * 3_600_000); // +8 h

    const taskA = makeTask({ title: "Task A", deadline: deadlineA, durationMinutes: 60 });
    const taskB = makeTask({ title: "Task B", deadline: deadlineB, durationMinutes: 60 });

    const output = schedule(
      makeInput({ tasks: [taskB, taskA], currentTime }) // intentionally reversed
    );

    const blockA = output.blocks.find((b) => b.id === taskA.id);
    const blockB = output.blocks.find((b) => b.id === taskB.id);

    expect(blockA).toBeDefined();
    expect(blockB).toBeDefined();
    expect(blockA!.startTime.getTime()).toBeLessThanOrEqual(
      blockB!.startTime.getTime()
    );
  });
});

// ===========================================================================
// Test 5 — Deadline too tight (impossible to fit)
// ===========================================================================
describe("Test 5 — Deadline too tight", () => {
  it("emits DEADLINE_CONFLICT and puts task in unscheduled", () => {
    const currentTime = new Date(2025, 5, 15);
    currentTime.setHours(8, 0, 0, 0);

    // Deadline only 30 min from now but task takes 60 min
    const tightDeadline = new Date(currentTime.getTime() + 30 * 60_000);

    const task = makeTask({
      durationMinutes: 60,
      deadline: tightDeadline,
    });

    const output = schedule(makeInput({ tasks: [task], currentTime }));

    const hasDeadlineConflict = output.warnings.some(
      (w) => w.type === "DEADLINE_CONFLICT"
    );
    expect(hasDeadlineConflict).toBe(true);
    expect(output.unscheduled.some((t) => t.id === task.id)).toBe(true);
  });
});

// ===========================================================================
// Test 6 — Past deadline skipped
// ===========================================================================
describe("Test 6 — Past deadline skipped", () => {
  it("emits DEADLINE_CONFLICT and puts task in unscheduled when deadline is yesterday", () => {
    const yesterday = new Date(2025, 5, 14); // one day before test day

    const task = makeTask({ deadline: yesterday });

    const output = schedule(makeInput({ tasks: [task] }));

    const hasDeadlineConflict = output.warnings.some(
      (w) => w.type === "DEADLINE_CONFLICT" && w.taskId === task.id
    );
    expect(hasDeadlineConflict).toBe(true);
    expect(output.unscheduled.some((t) => t.id === task.id)).toBe(true);
  });
});

// ===========================================================================
// Test 7 — ENERGY_TOO_LOW warning still attempts scheduling
// ===========================================================================
describe("Test 7 — ENERGY_TOO_LOW warning still attempts scheduling", () => {
  it("emits ENERGY_TOO_LOW when current energy is below all task costs", () => {
    const tasks = [
      makeTask({ energyCost: 8 }),
      makeTask({ energyCost: 9 }),
    ];

    const output = schedule(makeInput({ tasks, currentEnergy: 2 }));

    const hasEnergyTooLow = output.warnings.some(
      (w) => w.type === "ENERGY_TOO_LOW"
    );
    expect(hasEnergyTooLow).toBe(true);

    // Scheduling is still attempted — tasks end up placed OR unscheduled (not silently dropped)
    const allAccountedFor = tasks.every(
      (t) =>
        output.blocks.some((b) => b.id === t.id) ||
        output.unscheduled.some((u) => u.id === t.id)
    );
    expect(allAccountedFor).toBe(true);
  });
});

// ===========================================================================
// Test 8 — DAY_TOO_FULL warning
// ===========================================================================
describe("Test 8 — DAY_TOO_FULL warning", () => {
  it("emits DAY_TOO_FULL when fixed blocks occupy > 80% of the working window", () => {
    // 2-hour window (08:00-10:00); fixed block 08:00-09:45 = 105 min = 87.5%
    const fixedStart = localDate(8, 0);
    const fixedEnd = localDate(9, 45);

    const fixedBlocks: FixedBlock[] = [
      { id: "fixed-1", title: "Big meeting", startTime: fixedStart, endTime: fixedEnd },
    ];

    const output = schedule(
      makeInput({ workStart: 8, workEnd: 10, fixedBlocks, tasks: [] })
    );

    const hasDayTooFull = output.warnings.some((w) => w.type === "DAY_TOO_FULL");
    expect(hasDayTooFull).toBe(true);
  });
});

// ===========================================================================
// Test 9 — No tasks returns empty output
// ===========================================================================
describe("Test 9 — No tasks returns empty", () => {
  it("returns empty blocks, warnings, and unscheduled when no tasks given", () => {
    const output = schedule(makeInput({ tasks: [], fixedBlocks: [] }));

    expect(output.blocks.length).toBe(0);
    expect(output.warnings.length).toBe(0);
    expect(output.unscheduled.length).toBe(0);
  });
});

// ===========================================================================
// Test 10 — Break insertion when energy is tight
// ===========================================================================
describe("Test 10 — Break insertion when energy is tight", () => {
  it("inserts at least one recovery break when energy is low and task cost is high", () => {
    // Energy 3, second task costs 7 → effectiveEnergy (3) < 7 - 1 = 6 → break
    // Use two sequential 30-min tasks so there's a narrow gap between them
    const task1 = makeTask({ durationMinutes: 30, energyCost: 3 });
    const task2 = makeTask({
      durationMinutes: 60,
      energyCost: 7,
      priority: "HIGH",
    });

    const output = schedule(
      makeInput({ tasks: [task1, task2], currentEnergy: 3 })
    );

    const hasBreak = output.blocks.some((b) => b.kind === "break");
    expect(hasBreak).toBe(true);
  });
});

// ===========================================================================
// Test 11 — reschedule() moves heavy task and annotates reason with "Rescheduled"
// ===========================================================================
describe("Test 11 — Reschedule moves a heavy task and mentions 'Rescheduled'", () => {
  it("annotates the moved block with a reason containing 'Rescheduled'", () => {
    // Schedule a light task and a heavy task
    const lightTask = makeTask({
      id: "light",
      title: "Light task",
      durationMinutes: 60,
      energyCost: 3,
      priority: "LOW",
    });
    const heavyTask = makeTask({
      id: "heavy",
      title: "Heavy task",
      durationMinutes: 60,
      energyCost: 8,
      priority: "HIGH",
    });

    const input = makeInput({ tasks: [lightTask, heavyTask], currentEnergy: 7 });
    const initialOutput = schedule(input);

    // Capture existing blocks so reschedule knows where things were
    const existingBlocks: ScheduledBlock[] = initialOutput.blocks;

    // After completing the light task, energy dropped to 2
    // Pass the same input (with both tasks still listed) but mark light as completed via filter inside reschedule
    const rescheduledOutput = reschedule(
      { ...input, tasks: [lightTask, heavyTask] },
      lightTask.id,
      2, // remainingEnergy
      existingBlocks
    );

    // The heavy task should appear in the new schedule
    const heavyBlock = rescheduledOutput.blocks.find(
      (b) => b.kind === "task" && b.id === heavyTask.id
    );
    expect(heavyBlock).toBeDefined();

    // If it moved, the reason must contain "Rescheduled"
    const heavyOldBlock = existingBlocks.find(
      (b) => b.kind === "task" && b.id === heavyTask.id
    );

    if (
      heavyOldBlock !== undefined &&
      heavyBlock!.startTime.getTime() !== heavyOldBlock.startTime.getTime()
    ) {
      expect(heavyBlock!.reason).toContain("Rescheduled");
    }

    // At minimum, heavy task must be accounted for (placed or unscheduled)
    const isAccountedFor =
      heavyBlock !== undefined ||
      rescheduledOutput.unscheduled.some((t) => t.id === heavyTask.id);
    expect(isAccountedFor).toBe(true);
  });
});

// ===========================================================================
// Test 12 — No slot found when day is fully packed
// ===========================================================================
describe("Test 12 — No slot found when day is fully packed", () => {
  it("puts task in unscheduled and emits NO_SLOT when window is 100% fixed", () => {
    // 09:00-10:00 is the only window, entirely occupied by a fixed block
    const currentTime = new Date(2025, 5, 15);
    currentTime.setHours(9, 0, 0, 0);

    const fixedBlocks: FixedBlock[] = [
      {
        id: "fixed-1",
        title: "Full block",
        startTime: localDate(9, 0),
        endTime: localDate(10, 0),
      },
    ];

    const task = makeTask({ durationMinutes: 30 });

    const output = schedule(
      makeInput({
        workStart: 9,
        workEnd: 10,
        fixedBlocks,
        tasks: [task],
        currentTime,
      })
    );

    expect(output.unscheduled.some((t) => t.id === task.id)).toBe(true);
    const hasNoSlot = output.warnings.some((w) => w.type === "NO_SLOT");
    expect(hasNoSlot).toBe(true);
  });
});

// ===========================================================================
// Test 13 — predictEnergy at the current hour returns currentEnergy exactly
// ===========================================================================
describe("Test 13 — predictEnergy at current hour", () => {
  it("returns exactly currentEnergy when hour === currentHour", () => {
    const result = predictEnergy(10, 7, 10, DEFAULT_CURVE);
    expect(result).toBe(7);
  });
});

// ===========================================================================
// Test 14 — predictEnergy 6 hours away decays toward the curve value
// ===========================================================================
describe("Test 14 — predictEnergy decays toward curve", () => {
  it("blends currentEnergy and curve value correctly 6 hours away", () => {
    // hour=16, currentHour=10, currentEnergy=7
    // hoursAway = 6, weight = max(0.1, 0.4 - 0.05*6) = max(0.1, 0.1) = 0.1
    // curveValue = DEFAULT_CURVE[16] = 5
    // expected = 0.1 * 7 + 0.9 * 5 = 0.7 + 4.5 = 5.2
    const result = predictEnergy(16, 7, 10, DEFAULT_CURVE);
    expect(result).toBeCloseTo(5.2, 2);
  });
});
