import { fromZonedTime } from "date-fns-tz";
import { formatClock } from "@/schedule/civil";
import type { ScheduleConfig } from "@/schedule/config";
import {
  escapeText,
  formatIcsDuration,
  formatIcsLocal,
  formatIcsUtc,
  serializeLines,
} from "@/schedule/ics";
import type { Rotation, RotationEntry } from "@/schedule/rotate";

const PRODID = "-//rota//rotating schedule//EN";
const REFRESH = "PT12H";

export type FeedIdentity = { jti: string; iat: number };

type EventTemplate = {
  uidPrefix: string;
  dtstamp: string;
  lastModified: string;
  dtstart: string;
  duration: string;
  rrule: string;
  location: string | null;
};

const recurrence = (config: ScheduleConfig, rotation: Rotation): string => {
  const weekly = `FREQ=WEEKLY;INTERVAL=${rotation.periodWeeks}`;
  if (!config.until) return weekly;

  const lastMoment = fromZonedTime(`${config.until}T23:59:59`, config.tz);

  return `${weekly};UNTIL=${formatIcsUtc(lastMoment)}`;
};

const describeEntry = (entry: RotationEntry, rotation: Rotation): string => {
  const detail =
    `Slot ${entry.index + 1} of ${rotation.eventCount} in the rotation ` +
    `(week ${entry.week + 1} of ${rotation.periodWeeks}, ${entry.weekday} ` +
    `${formatClock(entry.start)}).`;

  return entry.routine.url ? `${entry.routine.url}\n\n${detail}` : detail;
};

const templateFor = (
  config: ScheduleConfig,
  rotation: Rotation,
  identity: FeedIdentity,
): EventTemplate => {
  const stamp = formatIcsUtc(new Date(identity.iat * 1000));

  return {
    uidPrefix: identity.jti,
    dtstamp: `DTSTAMP:${stamp}`,
    lastModified: `LAST-MODIFIED:${stamp}`,
    dtstart: `DTSTART;TZID=${config.tz}:`,
    duration: `DURATION:${formatIcsDuration(config.duration)}`,
    rrule: `RRULE:${recurrence(config, rotation)}`,
    location: config.location ? `LOCATION:${escapeText(config.location)}` : null,
  };
};

const headerLines = (config: ScheduleConfig, rotation: Rotation): string[] => {
  const weeks = `${rotation.periodWeeks} week${rotation.periodWeeks === 1 ? "" : "s"}`;
  const description =
    `${config.routines.length} routines rotating across ${rotation.slots.length} slots per week, ` +
    `repeating every ${weeks}.`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(config.name ?? "Rota")}`,
    `X-WR-TIMEZONE:${config.tz}`,
    `X-WR-CALDESC:${escapeText(description)}`,
    `X-PUBLISHED-TTL:${REFRESH}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH}`,
  ];
};

const eventLines = (
  entry: RotationEntry,
  rotation: Rotation,
  template: EventTemplate,
): string[] => [
  "BEGIN:VEVENT",
  `UID:${template.uidPrefix}-${entry.index}@rota`,
  template.dtstamp,
  template.lastModified,
  "SEQUENCE:0",
  `${template.dtstart}${formatIcsLocal(entry.start)}`,
  template.duration,
  template.rrule,
  `SUMMARY:${escapeText(entry.routine.name)}`,
  ...(template.location ? [template.location] : []),
  ...(entry.routine.url ? [`URL;VALUE=URI:${entry.routine.url}`] : []),
  `DESCRIPTION:${escapeText(describeEntry(entry, rotation))}`,
  "TRANSP:OPAQUE",
  "END:VEVENT",
];

export const buildCalendar = (
  config: ScheduleConfig,
  rotation: Rotation,
  identity: FeedIdentity,
): string => {
  const template = templateFor(config, rotation, identity);

  return serializeLines([
    ...headerLines(config, rotation),
    ...rotation.entries.flatMap((entry) => eventLines(entry, rotation, template)),
    "END:VCALENDAR",
  ]);
};
