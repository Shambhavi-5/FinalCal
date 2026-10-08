import { Router, Response } from "express";
import { z } from "zod";
import type { FixedEvent } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../lib/validate.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Zod schemas ─────────────────────────────────────────────────────────────

const createFixedEventSchema = z.object({
  title: z.string().min(1).max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  recurrence: z.string().max(50).optional(),
});

const updateFixedEventSchema = createFixedEventSchema.partial();

// ── Ownership helper ─────────────────────────────────────────────────────────

async function getFixedEventOrFail(
  id: string,
  userId: string,
  res: Response
): Promise<FixedEvent | null> {
  const event = await prisma.fixedEvent.findUnique({ where: { id } });
  if (!event) {
    res.status(404).json({ error: "Fixed event not found" });
    return null;
  }
  if (event.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return event;
}

// ── GET /api/fixed-events ────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const userId = req.user!.sub;
  const { date } = req.query;

  const where: Record<string, unknown> = { userId };

  if (typeof date === "string" && date) {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    // Events that overlap with the calendar day:
    // startTime < end of day AND endTime > start of day
    where.startTime = { lt: dayEnd };
    where.endTime = { gt: dayStart };
  }

  const fixedEvents = await prisma.fixedEvent.findMany({
    where,
    orderBy: { startTime: "asc" },
  });

  res.status(200).json({ fixedEvents });
});

// ── POST /api/fixed-events ───────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const userId = req.user!.sub;

  const body = validate(createFixedEventSchema, req.body, res);
  if (!body) return;

  const start = new Date(body.startTime);
  const end = new Date(body.endTime);

  if (end <= start) {
    res.status(400).json({ error: "endTime must be after startTime" });
    return;
  }

  const fixedEvent = await prisma.fixedEvent.create({
    data: {
      userId,
      title: body.title,
      startTime: start,
      endTime: end,
      recurrence: body.recurrence ?? null,
    },
  });

  res.status(201).json({ fixedEvent });
});

// ── GET /api/fixed-events/:id ────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const event = await getFixedEventOrFail(req.params.id, req.user!.sub, res);
  if (!event) return;
  res.status(200).json({ fixedEvent: event });
});

// ── PATCH /api/fixed-events/:id ──────────────────────────────────────────────

router.patch("/:id", async (req, res) => {
  const userId = req.user!.sub;

  const existing = await getFixedEventOrFail(req.params.id, userId, res);
  if (!existing) return;

  const body = validate(updateFixedEventSchema, req.body, res);
  if (!body) return;

  // Validate time range when both are supplied
  if (body.startTime !== undefined && body.endTime !== undefined) {
    const start = new Date(body.startTime);
    const end = new Date(body.endTime);
    if (end <= start) {
      res.status(400).json({ error: "endTime must be after startTime" });
      return;
    }
  }

  const fixedEvent = await prisma.fixedEvent.update({
    where: { id: req.params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.startTime !== undefined && {
        startTime: new Date(body.startTime),
      }),
      ...(body.endTime !== undefined && { endTime: new Date(body.endTime) }),
      ...(body.recurrence !== undefined && { recurrence: body.recurrence }),
    },
  });

  res.status(200).json({ fixedEvent });
});

// ── DELETE /api/fixed-events/:id ─────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const existing = await getFixedEventOrFail(req.params.id, req.user!.sub, res);
  if (!existing) return;

  await prisma.fixedEvent.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Fixed event deleted" });
});

export default router;
