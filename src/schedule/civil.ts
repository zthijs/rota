import { UTCDate } from "@date-fns/utc";
import { addDays, format, getDay, set } from "date-fns";

export type CivilTime = { hour: number; minute: number };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

const DATE_FORMAT = "yyyy-MM-dd";
const CLOCK_FORMAT = "HH:mm";

export const parseCivilDate = (value: string): Date | null => {
  const match = DATE_RE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new UTCDate(year, month - 1, day);

  const intact =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return intact ? date : null;
};

export const parseCivilTime = (value: string): CivilTime | null => {
  const match = TIME_RE.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour > 23 || minute > 59 ? null : { hour, minute };
};

export const addCivilDays = (date: Date, days: number): Date => addDays(date, days);

export const civilWeekdayIndex = (date: Date): number => getDay(date);

export const atCivilTime = (date: Date, { hour, minute }: CivilTime): Date =>
  set(date, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });

export const formatCivilDate = (date: Date): string => format(date, DATE_FORMAT);

export const formatCivilTime = ({ hour, minute }: CivilTime): string =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export const formatClock = (date: Date): string => format(date, CLOCK_FORMAT);
