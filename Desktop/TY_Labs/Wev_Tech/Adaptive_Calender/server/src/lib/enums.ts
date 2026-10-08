/**
 * Application-level enum definitions.
 *
 * SQLite does not support native database enums, so Prisma stores these as TEXT.
 * These TypeScript enums mirror the allowed values and are used throughout the
 * application for type-safe access to those string columns.
 */

export enum TaskType {
  DEEP_WORK = "DEEP_WORK",
  STUDY = "STUDY",
  ADMIN = "ADMIN",
  CREATIVE = "CREATIVE",
  PHYSICAL = "PHYSICAL",
  MEETING = "MEETING",
  OTHER = "OTHER",
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  SKIPPED = "SKIPPED",
  DEFERRED = "DEFERRED",
}

export enum BlockKind {
  TASK = "TASK",
  BREAK = "BREAK",
  FIXED = "FIXED",
}

export enum BlockStatus {
  SCHEDULED = "SCHEDULED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  SKIPPED = "SKIPPED",
}

export enum CheckinContext {
  DAILY_START = "DAILY_START",
  POST_TASK = "POST_TASK",
  MANUAL = "MANUAL",
}
