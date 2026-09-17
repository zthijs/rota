export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

const indexes: ReadonlyMap<string, number> = new Map(
  WEEKDAYS.map((weekday, index) => [weekday, index]),
);

export const isWeekday = (value: string): value is Weekday => indexes.has(value);

export const weekdayIndex = (weekday: Weekday): number => indexes.get(weekday)!;
