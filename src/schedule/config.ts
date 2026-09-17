import { isBefore } from "date-fns";
import { z } from "zod";
import { parseCivilDate } from "@/schedule/civil";
import { lcm } from "@/schedule/cycle";
import type { Parsed } from "@/schedule/parse";
import { parseRoutine } from "@/schedule/routine";
import { duplicateSlotKeys, parseSlot } from "@/schedule/slot";
import { isValidTimeZone } from "@/schedule/timezone";

export const MAX_EVENTS = 500;
export const DEFAULT_DURATION = 60;
export const MAX_DURATION = 1440;
export const MAX_LOCATION_CHARS = 500;
export const MAX_NAME_CHARS = 200;

const parsedBy = <T>(parse: (raw: unknown) => Parsed<T>) =>
  z.unknown().transform((raw, ctx): T => {
    const result = parse(raw);
    if (result.ok) return result.value;

    ctx.addIssue({ code: "custom", message: result.message });
    return z.NEVER;
  });

export const RoutineSchema = parsedBy(parseRoutine);

export const SlotSchema = parsedBy(parseSlot);

const blankableText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim() || undefined)
    .optional();

const civilDate = (label: string, required: string) =>
  z
    .string(required)
    .refine((value) => parseCivilDate(value) !== null, `${label} must be a real YYYY-MM-DD date`);

const timeZone = z
  .string("tz is required, e.g. tz=Europe/Amsterdam")
  .refine(isValidTimeZone, "must be a known IANA timezone, e.g. Europe/Amsterdam");

export const ScheduleConfigSchema = z
  .object({
    routines: z.array(RoutineSchema).min(1).max(MAX_EVENTS),
    slots: z.array(SlotSchema).min(1).max(MAX_EVENTS),
    start: civilDate("start", "start is required, e.g. start=2026-09-15"),
    duration: z.coerce
      .number("duration must be a whole number of minutes")
      .int()
      .min(1)
      .max(MAX_DURATION)
      .default(DEFAULT_DURATION),
    tz: timeZone,
    location: blankableText(MAX_LOCATION_CHARS),
    name: blankableText(MAX_NAME_CHARS),
    until: civilDate("until", "until must be a YYYY-MM-DD date").optional(),
  })
  .superRefine((config, ctx) => {
    for (const key of duplicateSlotKeys(config.slots)) {
      ctx.addIssue({ code: "custom", path: ["slots"], message: `duplicate slot ${key}` });
    }

    const start = parseCivilDate(config.start);
    const until = config.until ? parseCivilDate(config.until) : null;

    if (start && until && isBefore(until, start)) {
      ctx.addIssue({ code: "custom", path: ["until"], message: "until must not precede start" });
    }

    const events = lcm(config.routines.length, config.slots.length);

    if (events > MAX_EVENTS) {
      ctx.addIssue({
        code: "custom",
        message:
          `${config.routines.length} routines across ${config.slots.length} slots/week needs ` +
          `${events} events to express the full cycle (max ${MAX_EVENTS}). ` +
          "Fewer routines, fewer slots, or counts that share a factor will fit — though a shared " +
          "factor also keeps each routine to a fixed part of the week.",
      });
    }
  });

export type ScheduleConfig = z.output<typeof ScheduleConfigSchema>;
