export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });

export const fail = (message: string): Parsed<never> => ({ ok: false, message });

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const truncate = (value: string, max = 64): string =>
  value.length <= max ? value : `${value.slice(0, max)}…`;
