import { z, ZodError } from "zod";
import { Response } from "express";

/**
 * Parse `data` against `schema`.
 * On success, returns the parsed value.
 * On ZodError, writes a 400 response and returns null.
 * Any other error is re-thrown.
 */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  res: Response
): T | null {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return null;
    }
    throw err;
  }
}
