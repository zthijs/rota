import { DEFAULT_DURATION, type ScheduleConfig } from "@/schedule/config";
import { type EncodedRoutine, encodeRoutine } from "@/schedule/routine";
import { formatSlot } from "@/schedule/slot";

export type ScheduleClaims = {
  r: EncodedRoutine[];
  s: string[];
  b: string;
  z: string;
  d?: number;
  l?: string;
  n?: string;
  u?: string;
};

export const encodeClaims = (config: ScheduleConfig): ScheduleClaims => ({
  r: config.routines.map(encodeRoutine),
  s: config.slots.map(formatSlot),
  b: config.start,
  z: config.tz,
  ...(config.duration === DEFAULT_DURATION ? {} : { d: config.duration }),
  ...(config.location ? { l: config.location } : {}),
  ...(config.name ? { n: config.name } : {}),
  ...(config.until ? { u: config.until } : {}),
});

export const decodeClaims = (payload: Record<string, unknown>): unknown => ({
  routines: payload.r,
  slots: payload.s,
  start: payload.b,
  duration: payload.d,
  tz: payload.z,
  location: payload.l,
  name: payload.n,
  until: payload.u,
});
