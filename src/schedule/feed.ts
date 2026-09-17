import { formatCivilDate, formatClock } from "@/schedule/civil";
import type { Rotation } from "@/schedule/rotate";

export const feedPath = (token: string): string => `/c/${token}/rota.ics`;

export const feedUrls = (token: string, origin: string): { feedUrl: string; webcalUrl: string } => {
  const feedUrl = `${origin}${feedPath(token)}`;

  return { feedUrl, webcalUrl: feedUrl.replace(/^https?:/, "webcal:") };
};

export const describeRotation = (rotation: Rotation) =>
  rotation.entries.map((entry) => ({
    index: entry.index,
    week: entry.week,
    weekday: entry.weekday,
    time: formatClock(entry.start),
    routine: entry.routine.name,
    url: entry.routine.url,
    firstDate: formatCivilDate(entry.start),
  }));
