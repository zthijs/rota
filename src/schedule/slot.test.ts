import { describe, expect, test } from "bun:test";
import { duplicateSlotKeys, formatSlot, parseSlot, parseSlotString } from "@/schedule/slot";

const value = (raw: unknown) => {
  const parsed = parseSlot(raw);
  if (!parsed.ok) throw new Error(`expected ${JSON.stringify(raw)} to parse: ${parsed.message}`);

  return parsed.value;
};

const message = (raw: unknown) => {
  const parsed = parseSlot(raw);
  if (parsed.ok) throw new Error(`expected ${JSON.stringify(raw)} to be rejected`);

  return parsed.message;
};

describe("parseSlot from a string", () => {
  test("reads weekday@time", () => {
    expect(value("mon@18:00")).toEqual({ weekday: "mon", hour: 18, minute: 0 });
  });

  test("tolerates surrounding space and any casing", () => {
    expect(value("  THU@8:05 ")).toEqual({ weekday: "thu", hour: 8, minute: 5 });
  });

  test("rejects an unknown weekday", () => {
    expect(message("xyz@18:00")).toContain("is not a valid slot");
  });

  test("rejects an out-of-range time", () => {
    expect(message("mon@24:00")).toContain("is not a valid slot");
  });

  test("rejects a missing separator", () => {
    expect(message("mon 18:00")).toContain("is not a valid slot");
  });

  test("truncates a long value in the message rather than echoing all of it", () => {
    expect(message("x".repeat(200))).toContain("…");
  });
});

describe("parseSlot from an object", () => {
  test("reads { weekday, time }", () => {
    expect(value({ weekday: "tue", time: "7:15" })).toEqual({
      weekday: "tue",
      hour: 7,
      minute: 15,
    });
  });

  test("names the allowed weekdays when the weekday is wrong", () => {
    expect(message({ weekday: "funday", time: "7:15" })).toContain("sun, mon, tue");
  });

  test("rejects a bad time with the time message", () => {
    expect(message({ weekday: "tue", time: "25:00" })).toContain("24h HH:MM");
  });

  test("rejects a non-string time", () => {
    expect(message({ weekday: "tue", time: 1815 })).toBe("slot time must be a string");
  });
});

test("parseSlot rejects values that are neither shape", () => {
  expect(message(42)).toContain('expected "mon@18:00"');
  expect(message(null)).toContain('expected "mon@18:00"');
  expect(message({ weekday: "mon" })).toContain('expected "mon@18:00"');
});

test("parseSlotString returns null instead of a message", () => {
  expect(parseSlotString("mon@18:00")).toEqual({ weekday: "mon", hour: 18, minute: 0 });
  expect(parseSlotString("nope")).toBeNull();
});

test("formatSlot round-trips through parseSlotString", () => {
  const slot = { weekday: "wed", hour: 9, minute: 5 } as const;

  expect(formatSlot(slot)).toBe("wed@09:05");
  expect(parseSlotString(formatSlot(slot))).toEqual(slot);
});

describe("duplicateSlotKeys", () => {
  test("reports nothing when every slot is distinct", () => {
    expect(duplicateSlotKeys([{ weekday: "mon", hour: 18, minute: 0 }])).toEqual([]);
  });

  test("reports each repeat once, keyed the way a slot is written", () => {
    const slots = [
      { weekday: "mon", hour: 18, minute: 0 },
      { weekday: "thu", hour: 19, minute: 30 },
      { weekday: "mon", hour: 18, minute: 0 },
    ] as const;

    expect(duplicateSlotKeys(slots)).toEqual(["mon@18:00"]);
  });

  test("does not treat the same weekday at a different time as a duplicate", () => {
    const slots = [
      { weekday: "mon", hour: 18, minute: 0 },
      { weekday: "mon", hour: 20, minute: 0 },
    ] as const;

    expect(duplicateSlotKeys(slots)).toEqual([]);
  });
});
