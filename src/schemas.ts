import { z } from "zod";
import {
  DEFAULT_DURATION,
  MAX_DURATION,
  MAX_EVENTS,
  MAX_LOCATION_CHARS,
  MAX_NAME_CHARS,
} from "@/schedule/config";
import { MAX_ROUTINE_NAME_CHARS, MAX_ROUTINE_URL_CHARS } from "@/schedule/routine";
import { WEEKDAYS } from "@/schedule/weekday";

const RoutineInput = z
  .union([
    z.string().max(MAX_ROUTINE_NAME_CHARS + MAX_ROUTINE_URL_CHARS + 1),
    z.object({
      name: z.string().max(MAX_ROUTINE_NAME_CHARS),
      url: z.string().max(MAX_ROUTINE_URL_CHARS).optional(),
    }),
  ])
  .describe("One thing that comes round, as Push, Push|url, or { name, url }.")
  .openapi({ example: "Push|https://app.example/push" });

const SlotInput = z
  .union([z.string(), z.object({ weekday: z.enum(WEEKDAYS), time: z.string() })])
  .describe("One time of the week, as mon@18:00 or { weekday, time }.")
  .openapi({ example: "mon@18:00" });

const civilDate = (what: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(what)
    .openapi({ example: "2026-09-14" });

export const EXAMPLE = {
  routines: ["Push|https://app.example/push", "Pull", "Legs"],
  slots: ["mon@18:00", "thu@19:30"],
  start: "2026-09-14",
  duration: 75,
  tz: "Europe/Amsterdam",
  location: "Sportlaan 12, Amsterdam",
  name: "Gym",
};

export const ScheduleInput = z
  .object({
    routines: z
      .array(RoutineInput)
      .min(1)
      .max(MAX_EVENTS)
      .describe("Cycled through in order, one per slot."),
    slots: z
      .array(SlotInput)
      .min(1)
      .max(MAX_EVENTS)
      .describe("The times of the week routines land on, repeated every week."),
    start: civilDate("First week of the rotation; slots land on or after this date."),
    duration: z
      .number()
      .int()
      .min(1)
      .max(MAX_DURATION)
      .optional()
      .describe(`Minutes each event lasts, defaulting to ${DEFAULT_DURATION}.`)
      .openapi({ example: 75 }),
    tz: z
      .string()
      .describe("IANA timezone the slot times are written in.")
      .openapi({ example: "Europe/Amsterdam" }),
    location: z
      .string()
      .max(MAX_LOCATION_CHARS)
      .optional()
      .describe("Put on every event.")
      .openapi({ example: "Sportlaan 12, Amsterdam" }),
    name: z
      .string()
      .max(MAX_NAME_CHARS)
      .optional()
      .describe("What the calendar is called once subscribed.")
      .openapi({ example: "Gym" }),
    until: civilDate("Last day the rotation runs; open-ended when omitted.").optional(),
  })
  .openapi({ example: EXAMPLE });

const RoutineOut = z.object({ name: z.string(), url: z.string().optional() });

const SlotOut = z.object({
  weekday: z.enum(WEEKDAYS),
  hour: z.number().int(),
  minute: z.number().int(),
});

const ScheduleConfigOut = z.object({
  routines: z.array(RoutineOut),
  slots: z.array(SlotOut),
  start: z.string(),
  duration: z.number().int(),
  tz: z.string(),
  location: z.string().optional(),
  name: z.string().optional(),
  until: z.string().optional(),
});

const RotationEntry = z.object({
  index: z.number().int().describe("Position in the cycle, from 0."),
  week: z.number().int().describe("Which week of the cycle, from 0."),
  weekday: z.enum(WEEKDAYS),
  time: z.string().openapi({ example: "18:00" }),
  routine: z.string().describe("The routine that lands here."),
  url: z.string().optional(),
  firstDate: z
    .string()
    .describe("First date this entry occurs.")
    .openapi({ example: "2026-09-14" }),
});

const feedLinks = {
  feedUrl: z.url().describe("Subscribe to this from any app that reads iCalendar."),
  webcalUrl: z.string().describe("The same URL as webcal:, which most calendar apps open."),
};

const rotationSummary = {
  eventCount: z.number().int().describe("Recurring events needed to express the cycle."),
  periodWeeks: z.number().int().describe("Weeks before the rotation repeats."),
  rotation: z.array(RotationEntry).describe("The cycle, in order."),
};

export const CreatedFeed = z.object({
  ...feedLinks,
  token: z.string().describe("The signed schedule the feed URL carries."),
  jti: z.uuid().describe("This link's identity, used as the event UIDs and ETag."),
  location: z.string().optional(),
  ...rotationSummary,
});

export const InspectedFeed = z.object({
  ...feedLinks,
  jti: z.uuid(),
  issuedAt: z.iso.datetime().describe("When the link was minted."),
  config: ScheduleConfigOut.describe("The schedule read back out of the token."),
  ...rotationSummary,
});

export const Rejected = z.object({
  error: z.string().describe("What went wrong.").openapi({ example: "Invalid schedule" }),
  issues: z
    .array(z.string())
    .optional()
    .describe("One line per rejected field.")
    .openapi({ example: ["tz: must be a known IANA timezone, e.g. Europe/Amsterdam"] }),
});
