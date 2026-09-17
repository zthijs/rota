import { formatCivilTime, parseCivilTime } from "@/schedule/civil";
import { fail, isRecord, ok, type Parsed, truncate } from "@/schedule/parse";
import { isWeekday, WEEKDAYS, type Weekday } from "@/schedule/weekday";

export type Slot = { weekday: Weekday; hour: number; minute: number };

const SLOT_RE = /^([a-zA-Z]{3})@(\d{1,2}:\d{2})$/;

export const formatSlot = (slot: Slot): string => `${slot.weekday}@${formatCivilTime(slot)}`;

export const parseSlotString = (value: string): Slot | null => {
  const match = SLOT_RE.exec(value.trim());
  if (!match) return null;

  const weekday = match[1]!.toLowerCase();
  if (!isWeekday(weekday)) return null;

  const time = parseCivilTime(match[2]!);

  return time ? { weekday, ...time } : null;
};

export const parseSlot = (raw: unknown): Parsed<Slot> => {
  if (typeof raw === "string") {
    const slot = parseSlotString(raw);

    return slot
      ? ok(slot)
      : fail(`"${truncate(raw)}" is not a valid slot; expected e.g. "mon@18:00"`);
  }

  if (isRecord(raw) && "weekday" in raw && "time" in raw) {
    const { weekday, time } = raw;

    if (typeof weekday !== "string" || !isWeekday(weekday)) {
      return fail(`weekday must be one of ${WEEKDAYS.join(", ")}`);
    }
    if (typeof time !== "string") return fail("slot time must be a string");

    const parsed = parseCivilTime(time);

    return parsed
      ? ok({ weekday, ...parsed })
      : fail(`"${truncate(time)}" is not a valid 24h HH:MM time`);
  }

  return fail('expected "mon@18:00" or { weekday, time }');
};

export const duplicateSlotKeys = (slots: readonly Slot[]): string[] => {
  const seen = new Set<string>();

  return slots.map(formatSlot).filter((key) => {
    const repeated = seen.has(key);
    seen.add(key);
    return repeated;
  });
};
