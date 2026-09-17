import { describe, expect, test } from "bun:test";
import { parseCivilDate } from "@/schedule/civil";
import { buildRotation, positionSlots } from "@/schedule/rotate";
import type { Slot } from "@/schedule/slot";
import { validate } from "@/schedule/validate";

const configOf = (raw: Record<string, unknown>) => {
  const parsed = validate({ tz: "Europe/Amsterdam", start: "2026-09-14", ...raw });
  if (!parsed.ok) throw new Error(`fixture is invalid: ${parsed.errors.join("; ")}`);

  return parsed.config;
};

const slot = (weekday: Slot["weekday"], hour: number, minute = 0): Slot => ({
  weekday,
  hour,
  minute,
});

describe("positionSlots", () => {
  const monday = parseCivilDate("2026-09-14")!;

  test("measures each slot as days after the anchor", () => {
    expect(positionSlots([slot("thu", 19, 30), slot("mon", 18)], monday)).toEqual([
      { weekday: "mon", hour: 18, minute: 0, dayOffset: 0 },
      { weekday: "thu", hour: 19, minute: 30, dayOffset: 3 },
    ]);
  });

  test("rolls a weekday that has already passed into the coming week", () => {
    const wednesday = parseCivilDate("2026-09-16")!;

    expect(positionSlots([slot("mon", 18)], wednesday)[0]?.dayOffset).toBe(5);
  });

  test("orders same-day slots by time", () => {
    const ordered = positionSlots([slot("mon", 20), slot("mon", 8, 30), slot("mon", 8)], monday);

    expect(ordered.map((entry) => [entry.hour, entry.minute])).toEqual([
      [8, 0],
      [8, 30],
      [20, 0],
    ]);
  });
});

describe("buildRotation", () => {
  test("deals routines into slots in order and wraps around", () => {
    const rotation = buildRotation(
      configOf({ routines: ["Push", "Pull", "Legs"], slots: ["mon@18:00", "thu@19:30"] }),
    );

    expect(rotation.eventCount).toBe(6);
    expect(rotation.periodWeeks).toBe(3);
    expect(rotation.entries.map((entry) => entry.routine.name)).toEqual([
      "Push",
      "Pull",
      "Legs",
      "Push",
      "Pull",
      "Legs",
    ]);
    expect(rotation.entries.map((entry) => entry.week)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(rotation.entries.map((entry) => entry.weekday)).toEqual([
      "mon",
      "thu",
      "mon",
      "thu",
      "mon",
      "thu",
    ]);
  });

  test("starts each entry on its first real date and time", () => {
    const rotation = buildRotation(
      configOf({ routines: ["Push", "Pull", "Legs"], slots: ["mon@18:00", "thu@19:30"] }),
    );

    expect(rotation.entries.map((entry) => entry.start.toISOString())).toEqual([
      "2026-09-14T18:00:00.000Z",
      "2026-09-17T19:30:00.000Z",
      "2026-09-21T18:00:00.000Z",
      "2026-09-24T19:30:00.000Z",
      "2026-09-28T18:00:00.000Z",
      "2026-10-01T19:30:00.000Z",
    ]);
  });

  test("collapses to a single week when the counts share a factor, pinning each routine", () => {
    const rotation = buildRotation(
      configOf({ routines: ["Push", "Pull"], slots: ["mon@18:00", "thu@19:30"] }),
    );

    expect(rotation.eventCount).toBe(2);
    expect(rotation.periodWeeks).toBe(1);
    expect(rotation.entries.map((entry) => [entry.routine.name, entry.weekday])).toEqual([
      ["Push", "mon"],
      ["Pull", "thu"],
    ]);
  });

  test("gives one routine across two slots a two-slot, one-week cycle", () => {
    const rotation = buildRotation(
      configOf({ routines: ["Push"], slots: ["mon@18:00", "thu@19:30"] }),
    );

    expect(rotation.eventCount).toBe(2);
    expect(rotation.periodWeeks).toBe(1);
  });

  test("spreads more routines than slots over as many weeks as it takes", () => {
    const rotation = buildRotation(configOf({ routines: ["A", "B", "C"], slots: ["mon@18:00"] }));

    expect(rotation.eventCount).toBe(3);
    expect(rotation.periodWeeks).toBe(3);
    expect(rotation.entries.map((entry) => entry.start.toISOString())).toEqual([
      "2026-09-14T18:00:00.000Z",
      "2026-09-21T18:00:00.000Z",
      "2026-09-28T18:00:00.000Z",
    ]);
  });

  test("throws rather than inventing an anchor when the start date is unusable", () => {
    const config = configOf({ routines: ["Push"], slots: ["mon@18:00"] });

    expect(() => buildRotation({ ...config, start: "2026-02-30" })).toThrow("invalid start date");
  });
});
