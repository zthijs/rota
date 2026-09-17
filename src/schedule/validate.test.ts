import { describe, expect, test } from "bun:test";
import { DEFAULT_DURATION, MAX_EVENTS } from "@/schedule/config";
import { validate } from "@/schedule/validate";

const VALID = {
  routines: ["Push|https://app.example/push", "Pull", "Legs"],
  slots: ["mon@18:00", "thu@19:30"],
  start: "2026-09-14",
  tz: "Europe/Amsterdam",
};

const config = (raw: Record<string, unknown>) => {
  const parsed = validate({ ...VALID, ...raw });
  if (!parsed.ok) throw new Error(`expected a valid schedule: ${parsed.errors.join("; ")}`);

  return parsed.config;
};

const errors = (raw: Record<string, unknown>) => {
  const parsed = validate({ ...VALID, ...raw });
  if (parsed.ok) throw new Error("expected the schedule to be rejected");

  return parsed.errors;
};

describe("a valid schedule", () => {
  test("parses routines and slots into their structured form", () => {
    const parsed = config({});

    expect(parsed.routines).toEqual([
      { name: "Push", url: "https://app.example/push" },
      { name: "Pull", url: undefined },
      { name: "Legs", url: undefined },
    ]);
    expect(parsed.slots).toEqual([
      { weekday: "mon", hour: 18, minute: 0 },
      { weekday: "thu", hour: 19, minute: 30 },
    ]);
  });

  test("defaults the duration", () => {
    expect(config({}).duration).toBe(DEFAULT_DURATION);
  });

  test("coerces a numeric string duration", () => {
    expect(config({ duration: "90" }).duration).toBe(90);
  });

  test("trims the optional text and drops it when blank", () => {
    expect(config({ name: "  Gym  ", location: "  Sportlaan 12  " })).toMatchObject({
      name: "Gym",
      location: "Sportlaan 12",
    });
    expect(config({ name: "   ", location: "" })).toMatchObject({
      name: undefined,
      location: undefined,
    });
  });

  test("allows until on the same day as start", () => {
    expect(config({ until: VALID.start }).until).toBe(VALID.start);
  });
});

describe("a rejected schedule", () => {
  test("names the field that failed", () => {
    expect(errors({ routines: [""] })).toEqual(["routines.0: routine name is empty"]);
  });

  test("rejects an empty rotation", () => {
    expect(errors({ routines: [] }).join(" ")).toContain("routines");
    expect(errors({ slots: [] }).join(" ")).toContain("slots");
  });

  test("rejects a duplicate slot, quoting the slot", () => {
    expect(errors({ slots: ["mon@18:00", "mon@18:00"] })).toEqual([
      "slots: duplicate slot mon@18:00",
    ]);
  });

  test("rejects until before start", () => {
    expect(errors({ until: "2026-09-13" })).toEqual(["until: until must not precede start"]);
  });

  test("rejects a start date that is not a real day", () => {
    expect(errors({ start: "2026-02-30" }).join(" ")).toContain("real YYYY-MM-DD date");
  });

  test("rejects an unknown timezone", () => {
    expect(errors({ tz: "Europe/Atlantis" }).join(" ")).toContain("known IANA timezone");
    expect(errors({ tz: "" }).join(" ")).toContain("known IANA timezone");
  });

  test("rejects a duration outside the allowed range", () => {
    expect(errors({ duration: 0 }).length).toBeGreaterThan(0);
    expect(errors({ duration: 1441 }).length).toBeGreaterThan(0);
  });

  test("rejects a cycle too long to express, and says how long it would be", () => {
    const rejection = errors({
      routines: Array.from({ length: 23 }, (_, index) => `R${index}`),
      slots: Array.from({ length: 22 }, (_, index) => `mon@${index}:00`),
    }).join(" ");

    expect(rejection).toContain("506 events");
    expect(rejection).toContain(String(MAX_EVENTS));
  });
});
