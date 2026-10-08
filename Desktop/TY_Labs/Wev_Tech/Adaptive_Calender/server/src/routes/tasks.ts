import { Router, Response } from "express";
import { z } from "zod";
import type { Task } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../lib/validate.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Zod schemas ─────────────────────────────────────────────────────────────

const taskTypeValues = [
  "DEEP_WORK",
  "STUDY",
  "ADMIN",
  "CREATIVE",
  "PHYSICAL",
  "MEETING",
  "OTHER",
] as const;

const priorityValues = ["LOW", "MEDIUM", "HIGH"] as const;
const statusValues = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
  "DEFERRED",
] as const;

const createTaskSchema = z.object({
  title: z.string().min(1).max(100),
  type: z.enum(taskTypeValues),
  durationMinutes: z.number().int().min(5).max(480),
  estimatedEnergy: z.number().int().min(1).max(10),
  priority: z.enum(priorityValues),
  deadline: z.string().datetime().optional(),
  date: z.string().datetime(),
  status: z.enum(statusValues).optional().default("PENDING"),
});

const updateTaskSchema = createTaskSchema.partial();

// ── Ownership helper ─────────────────────────────────────────────────────────

async function getTaskOrFail(
  id: string,
  userId: string,
  res: Response
): Promise<Task | null> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return null;
  }
  if (task.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return task;
}

// ── GET /api/tasks ───────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const userId = req.user!.sub;
  const { date, status } = req.query;

  // Build filter
  const where: Record<string, unknown> = { userId };

  if (typeof date === "string" && date) {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    where.date = { gte: dayStart, lt: dayEnd };
  }

  if (typeof status === "string" && status) {
    where.status = status;
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({ tasks });
});

// ── POST /api/tasks ──────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const userId = req.user!.sub;

  const body = validate(createTaskSchema, req.body, res);
  if (!body) return;

  const task = await prisma.task.create({
    data: {
      userId,
      title: body.title,
      type: body.type,
      durationMinutes: body.durationMinutes,
      estimatedEnergy: body.estimatedEnergy,
      priority: body.priority,
      deadline: body.deadline ? new Date(body.deadline) : null,
      date: new Date(body.date),
      status: body.status,
    },
  });

  res.status(201).json({ task });
});

// ── GET /api/tasks/:id ───────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const task = await getTaskOrFail(req.params.id, req.user!.sub, res);
  if (!task) return;
  res.status(200).json({ task });
});

// ── PATCH /api/tasks/:id ─────────────────────────────────────────────────────

router.patch("/:id", async (req, res) => {
  const userId = req.user!.sub;

  const existing = await getTaskOrFail(req.params.id, userId, res);
  if (!existing) return;

  const body = validate(updateTaskSchema, req.body, res);
  if (!body) return;

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.durationMinutes !== undefined && {
        durationMinutes: body.durationMinutes,
      }),
      ...(body.estimatedEnergy !== undefined && {
        estimatedEnergy: body.estimatedEnergy,
      }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.deadline !== undefined && {
        deadline: body.deadline ? new Date(body.deadline) : null,
      }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  res.status(200).json({ task });
});

// ── DELETE /api/tasks/:id ────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const existing = await getTaskOrFail(req.params.id, req.user!.sub, res);
  if (!existing) return;

  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Task deleted" });
});

export default router;
