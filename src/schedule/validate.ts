import type { z } from "zod";
import { type ScheduleConfig, ScheduleConfigSchema } from "@/schedule/config";

const MAX_ISSUES = 100;

export const formatIssues = (error: z.ZodError): string[] => {
  const lines = error.issues.map((issue) => {
    const path = issue.path.filter((segment) => typeof segment !== "symbol").join(".");

    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });

  if (lines.length <= MAX_ISSUES) return lines;

  return [...lines.slice(0, MAX_ISSUES), `...and ${lines.length - MAX_ISSUES} more problems`];
};

export type ParseResult = { ok: true; config: ScheduleConfig } | { ok: false; errors: string[] };

export const validate = (raw: unknown): ParseResult => {
  const result = ScheduleConfigSchema.safeParse(raw);

  return result.success
    ? { ok: true, config: result.data }
    : { ok: false, errors: formatIssues(result.error) };
};
