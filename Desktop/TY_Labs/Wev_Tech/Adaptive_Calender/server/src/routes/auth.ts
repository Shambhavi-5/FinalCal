import { Router } from "express";
import bcrypt from "bcrypt";
import { z, ZodError } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Rate limiter: max 10 requests per 15 minutes per IP, for register + login only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Cookie options shared between register and login
const COOKIE_OPTIONS = {
  httpOnly: true as const,
  sameSite: "strict" as const,
  secure: false,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// ── POST /api/auth/register ─────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

router.post("/register", authLimiter, async (req, res) => {
  // Validate body
  let body: z.infer<typeof registerSchema>;
  try {
    body = registerSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    throw err;
  }

  const { email, name, password } = body;

  // Check uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  // Sign token and set cookie
  const token = signToken({ sub: user.id, email: user.email });
  res.cookie("accessToken", token, COOKIE_OPTIONS);

  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", authLimiter, async (req, res) => {
  // Validate body
  let body: z.infer<typeof loginSchema>;
  try {
    body = loginSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    throw err;
  }

  const { email, password } = body;

  // Find user — do not reveal which field is wrong
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Compare password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Sign token and set cookie
  const token = signToken({ sub: user.id, email: user.email });
  res.cookie("accessToken", token, COOKIE_OPTIONS);

  res.status(200).json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
  });
  res.status(200).json({ message: "Logged out" });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ user });
});

export default router;
