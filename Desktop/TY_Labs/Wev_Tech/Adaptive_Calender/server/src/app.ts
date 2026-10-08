import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.js";
import tasksRouter from "./routes/tasks.js";
import fixedEventsRouter from "./routes/fixedEvents.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/fixed-events", fixedEventsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "EnergyCal", time: new Date().toISOString() });
});