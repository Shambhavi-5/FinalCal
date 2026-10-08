import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../lib/validate.js";
import { schedule } from "../scheduler/engine.js";
import type {
  SchedulerInput,
  SchedulerTask,
  FixedBlock as SchedulerFixedBlock,
} from "../scheduler/types.js";

const router = Router();

router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function dayBoundaries(isoDate: string): { dayStart: Date; dayEnd: Date } {
  const d = new Date(isoDate);
  const dayStart = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd };
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const generateSchema = z.object({
  date: z.string().datetime(),
  currentEnergy: z.number().int().min(1).max(10),
});

// ── POST /api/schedule/generate ──────────────────────────────────────────────

router.post("/generate", async (req, res) => {
  const userId = req.user!.sub;

  const body = validate(generateSchema, req.body, res);
  if (!body) return;

  try {
    const { dayStart, dayEnd } = dayBoundaries(body.date);

    // 1. Fetch PENDING tasks for user on that date
    const dbTasks = await prisma.task.findMany({
      where: {
        userId,
        status: "PENDING",
        date: { gte: dayStart, lt: dayEnd },
      },
    });

    // 2. Fetch fixed events overlapping the day
    const dbFixedEvents = await prisma.fixedEvent.findMany({
      where: {
        userId,
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
    });

    // 3. Build 24-element energy curve (default 5.0 for missing hours)
    const dbCurvePoints = await prisma.energyCurvePoint.findMany({
      where: { userId },
    });
    const energyCurve: number[] = Array(24).fill(5.0);
    for (const point of dbCurvePoints) {
      if (point.hour >= 0 && point.hour < 24) {
        energyCurve[point.hour] = point.average;
      }
    }

    // 4. Fetch TaskTypeStats and build correction factor map
    const dbStats = await prisma.taskTypeStat.findMany({
      where: { userId },
    });
    const statMap = new Map<string, number>();
    for (const stat of dbStats) {
      statMap.set(stat.taskType, stat.correctionFactor);
    }

    // 5. Map DB tasks → SchedulerTask[]
    const schedulerTasks: SchedulerTask[] = dbTasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      durationMinutes: task.durationMinutes,
      energyCost: clamp(
        task.estimatedEnergy * (statMap.get(task.type) ?? 1.0),
        1,
        10
      ),
      priority: task.priority,
      deadline: task.deadline ? new Date(task.deadline) : undefined,
      status: task.status,
    }));

    // 6. Map DB fixed events → FixedBlock[]
    const schedulerFixed: SchedulerFixedBlock[] = dbFixedEvents.map((fe) => ({
      id: fe.id,
      title: fe.title,
      startTime: new Date(fe.startTime),
      endTime: new Date(fe.endTime),
    }));

    // 7. Build SchedulerInput
    const schedulerInput: SchedulerInput = {
      date: dayStart,
      currentEnergy: body.currentEnergy,
      currentTime: new Date(),
      tasks: schedulerTasks,
      fixedBlocks: schedulerFixed,
      energyCurve,
      workStart: 8,
      workEnd: 22,
      breakMinsBetweenTasks: 5,
    };

    // 8. Run scheduler
    const result = schedule(schedulerInput);

    // 9. Delete existing non-FIXED schedule blocks for user on that date
    await prisma.scheduleBlock.deleteMany({
      where: {
        userId,
        date: { gte: dayStart, lt: dayEnd },
        kind: { not: "FIXED" },
      },
    });

    // 10. Persist FIXED blocks for fixed events (upsert to avoid duplicates)
    for (const fe of dbFixedEvents) {
      await prisma.scheduleBlock.upsert({
        where: {
          // We need a unique identifier — use a compound approach via findFirst + create
          // Since there's no @@unique on (userId, fixedEventId, date), we use id-based upsert
          // by creating a deterministic id approach. Instead, use deleteMany + create.
          id: `fixed-${fe.id}-${dayStart.toISOString()}`,
        },
        create: {
          id: `fixed-${fe.id}-${dayStart.toISOString()}`,
          userId,
          fixedEventId: fe.id,
          date: dayStart,
          startTime: new Date(fe.startTime),
          endTime: new Date(fe.endTime),
          kind: "FIXED",
          status: "SCHEDULED",
        },
        update: {
          startTime: new Date(fe.startTime),
          endTime: new Date(fe.endTime),
          status: "SCHEDULED",
        },
      });
    }

    // 11. Persist result.blocks (non-FIXED) as ScheduleBlock records
    const nonFixedBlocks = result.blocks.filter((b) => b.kind !== "fixed");

    if (nonFixedBlocks.length > 0) {
      await prisma.scheduleBlock.createMany({
        data: nonFixedBlocks.map((block) => ({
          userId,
          taskId: block.kind === "task" ? block.id : null,
          date: dayStart,
          startTime: block.startTime,
          endTime: block.endTime,
          kind: block.kind === "task" ? "TASK" : "BREAK",
          breakType: block.kind === "break" ? "rest" : null,
          status: "SCHEDULED",
        })),
      });
    }

    // 12. Fetch all created blocks with relations ordered by startTime
    const persistedBlocks = await prisma.scheduleBlock.findMany({
      where: {
        userId,
        date: { gte: dayStart, lt: dayEnd },
      },
      include: { task: true, fixedEvent: true },
      orderBy: { startTime: "asc" },
    });

    res.status(200).json({
      blocks: persistedBlocks,
      warnings: result.warnings,
      unscheduled: result.unscheduled,
    });
  } catch (err) {
    console.error("POST /api/schedule/generate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/schedule/:date ──────────────────────────────────────────────────

router.get("/:date", async (req, res) => {
  const userId = req.user!.sub;

  try {
    const { dayStart, dayEnd } = dayBoundaries(req.params.date);

    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        userId,
        date: { gte: dayStart, lt: dayEnd },
      },
      include: { task: true, fixedEvent: true },
      orderBy: { startTime: "asc" },
    });

    res.status(200).json({ blocks });
  } catch (err) {
    console.error("GET /api/schedule/:date error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
