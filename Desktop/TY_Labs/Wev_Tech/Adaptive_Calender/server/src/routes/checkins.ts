import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../lib/validate.js";

const router = Router();

router.use(authenticate);

// ── Zod schema ───────────────────────────────────────────────────────────────

const checkinSchema = z
  .object({
    level: z.number().int().min(1).max(10),
    context: z.enum(["DAILY_START", "POST_TASK", "MANUAL"]),
    taskId: z.string().optional(),
    hardnessRating: z.number().int().min(1).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.context === "POST_TASK" && !data.taskId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taskId"],
        message: "taskId is required when context is POST_TASK",
      });
    }
  });

// ── POST /api/checkins ───────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const userId = req.user!.sub;

  const body = validate(checkinSchema, req.body, res);
  if (!body) return;

  try {
    // 1. Create the check-in record
    const checkin = await prisma.energyCheckin.create({
      data: {
        userId,
        level: body.level,
        context: body.context,
        ...(body.taskId !== undefined && { taskId: body.taskId }),
        ...(body.hardnessRating !== undefined && {
          hardnessRating: body.hardnessRating,
        }),
      },
    });

    // 2. If DAILY_START, upsert EnergyCurvePoint for current hour
    if (body.context === "DAILY_START") {
      const hour = new Date().getHours();

      const existing = await prisma.energyCurvePoint.findUnique({
        where: { userId_hour: { userId, hour } },
      });

      if (existing) {
        const newAvg = 0.8 * existing.average + 0.2 * body.level;
        await prisma.energyCurvePoint.update({
          where: { userId_hour: { userId, hour } },
          data: {
            average: newAvg,
            sampleCount: existing.sampleCount + 1,
          },
        });
      } else {
        await prisma.energyCurvePoint.create({
          data: {
            userId,
            hour,
            average: body.level,
            sampleCount: 1,
          },
        });
      }
    }

    res.status(201).json({ checkin });
  } catch (err) {
    console.error("POST /api/checkins error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
