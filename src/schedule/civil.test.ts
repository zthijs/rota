import { describe, expect, test } from "bun:test";
import {
  addCivilDays,
  atCivilTime,
  civilWeekdayIndex,
  formatCivilDate,
  formatCivilTime,
  formatClock,
  parseCivilDate,
  parseCivilTime,
} from "@/schedule/civil";

describe("parseCivilDate", () => {
  test("reads a date as UTC midnight, so it carries no timezone of its own", () => {
    expect(parseCivilDate("2026-09-14")?.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  test("rejects dates that do not exist rather than rolling them over", () => {
    expect(parseCivilDate("2026-02-30")).toBeNull();
    expect(parseCivilDate("2026-13-01")).toBeNull();
  });

  test("keeps a real leap day", () => {
    expect(formatCivilDate(parseCivilDate("2028-02-29")!)).toBe("2028-02-29");
  });

  test("requires exactly YYYY-MM-DD", () => {
    expect(parseCivilDate("2026-9-14")).toBeNull();
    expect(parseCivilDate("14-09-2026")).toBeNull();
    expect(parseCivilDate("")).toBeNull();
  });
});

describe("parseCivilTime", () => {
  test("accepts a one or two digit hour", () => {
    expect(parseCivilTime("18:00")).toEqual({ hour: 18, minute: 0 });
    expect(parseCivilTime("8:05")).toEqual({ hour: 8, minute: 5 });
  });

  test("rejects times past the end of the clock", () => {
    expect(parseCivilTime("24:00")).toBeNull();
    expect(parseCivilTime("18:60")).toBeNull();
  });

  test("rejects anything that is not 24h HH:MM", () => {
    expect(parseCivilTime("6pm")).toBeNull();
    expect(parseCivilTime("18:0")).toBeNull();
  });
});

test("formatCivilTime pads to HH:MM", () => {
  expect(formatCivilTime({ hour: 8, minute: 5 })).toBe("08:05");
  expect(formatCivilTime({ hour: 0, minute: 0 })).toBe("00:00");
});

describe("civil arithmetic", () => {
  const monday = parseCivilDate("2026-09-14")!;

  test("2026-09-14 is a Monday", () => {
    expect(civilWeekdayIndex(monday)).toBe(1);
  });

  test("stays on the civil calendar across a DST boundary", () => {
    const later = addCivilDays(parseCivilDate("2026-10-24")!, 2);

    expect(formatCivilDate(later)).toBe("2026-10-26");
  });

  test("atCivilTime sets the wall clock and zeroes the rest", () => {
    const at = atCivilTime(monday, { hour: 19, minute: 30 });

    expect(at.toISOString()).toBe("2026-09-14T19:30:00.000Z");
    expect(formatClock(at)).toBe("19:30");
  });
});
