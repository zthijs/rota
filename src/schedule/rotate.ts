import { addCivilDays, atCivilTime, civilWeekdayIndex, parseCivilDate } from "@/schedule/civil";
import type { ScheduleConfig } from "@/schedule/config";
import { lcm } from "@/schedule/cycle";
import type { Routine } from "@/schedule/routine";
import type { Slot } from "@/schedule/slot";
import { type Weekday, weekdayIndex } from "@/schedule/weekday";

export type PositionedSlot = Slot & { dayOffset: number };

export type RotationEntry = {
  index: number;
  routine: Routine;
  weekday: Weekday;
  week: number;
  start: Date;
};

export type Rotation = {
  entries: RotationEntry[];
  periodWeeks: number;
  eventCount: number;
  slots: PositionedSlot[];
};

export const positionSlots = (slots: readonly Slot[], anchor: Date): PositionedSlot[] => {
  const anchorIndex = civilWeekdayIndex(anchor);

  return slots
    .map((slot) => ({ ...slot, dayOffset: (weekdayIndex(slot.weekday) - anchorIndex + 7) % 7 }))
    .sort((a, b) => a.dayOffset - b.dayOffset || a.hour - b.hour || a.minute - b.minute);
};

const entryAt = (
  index: number,
  routines: readonly Routine[],
  slots: readonly PositionedSlot[],
  anchor: Date,
): RotationEntry => {
  const week = Math.floor(index / slots.length);
  const slot = slots[index % slots.length]!;

  return {
    index,
    routine: routines[index % routines.length]!,
    weekday: slot.weekday,
    week,
    start: atCivilTime(addCivilDays(anchor, week * 7 + slot.dayOffset), slot),
  };
};

export const buildRotation = (config: ScheduleConfig): Rotation => {
  const anchor = parseCivilDate(config.start);
  if (!anchor) throw new Error(`invalid start date: ${config.start}`);

  const slots = positionSlots(config.slots, anchor);
  const eventCount = lcm(config.routines.length, slots.length);

  return {
    entries: Array.from({ length: eventCount }, (_, index) =>
      entryAt(index, config.routines, slots, anchor),
    ),
    periodWeeks: eventCount / slots.length,
    eventCount,
    slots,
  };
};
