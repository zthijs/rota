import { describe, expect, test } from "bun:test";
import { UTCDate } from "@date-fns/utc";
import {
  escapeText,
  foldLine,
  formatIcsDuration,
  formatIcsLocal,
  formatIcsUtc,
  serializeLines,
} from "@/schedule/ics";

const FOLD = "\r\n ";

const octets = (value: string) => new TextEncoder().encode(value).length;

const unfold = (line: string) => line.split(FOLD).join("");

describe("escapeText", () => {
  test("escapes the characters that would end or split a property", () => {
    expect(escapeText("Push, hard; really\\hard")).toBe("Push\\, hard\\; really\\\\hard");
  });

  test("turns real newlines into the literal ICS escape", () => {
    expect(escapeText("one\ntwo\r\nthree\rfour")).toBe("one\\ntwo\\nthree\\nfour");
  });

  test("leaves a colon alone, since only the first one is structural", () => {
    expect(escapeText("https://app.example/push")).toBe("https://app.example/push");
  });

  test("leaves ordinary text untouched", () => {
    expect(escapeText("Push")).toBe("Push");
  });
});

describe("foldLine", () => {
  test("leaves a short ASCII line alone", () => {
    expect(foldLine("SUMMARY:Push")).toBe("SUMMARY:Push");
  });

  test("keeps the first line within 75 octets and continuations within 74", () => {
    const folded = foldLine("A".repeat(300));
    const [first, ...rest] = folded.split(FOLD);

    expect(octets(first!)).toBe(75);
    for (const line of rest) expect(octets(line)).toBeLessThanOrEqual(74);
  });

  test("can be unfolded back to the original", () => {
    const line = `DESCRIPTION:${"long text ".repeat(30)}`;

    expect(unfold(foldLine(line))).toBe(line);
  });

  test("counts multi-byte characters as octets, not as characters", () => {
    const line = "é".repeat(40);
    const folded = foldLine(line);

    expect(folded).toContain(FOLD);
    expect(unfold(folded)).toBe(line);
    for (const part of folded.split(FOLD)) expect(octets(part)).toBeLessThanOrEqual(75);
  });

  test("never splits a character down the middle", () => {
    const line = "🏋".repeat(40);

    expect(unfold(foldLine(line))).toBe(line);
  });
});

describe("formatIcsDuration", () => {
  test("writes minutes, hours, or both", () => {
    expect(formatIcsDuration(45)).toBe("PT45M");
    expect(formatIcsDuration(60)).toBe("PT1H");
    expect(formatIcsDuration(90)).toBe("PT1H30M");
    expect(formatIcsDuration(1440)).toBe("PT24H");
  });
});

describe("timestamps", () => {
  test("formatIcsUtc writes an absolute instant with the Z suffix", () => {
    expect(formatIcsUtc(new Date(0))).toBe("19700101T000000Z");
    expect(formatIcsUtc(new Date(1789000000 * 1000))).toMatch(/^\d{8}T\d{6}Z$/);
  });

  test("formatIcsLocal writes a floating time with no suffix", () => {
    expect(formatIcsLocal(new UTCDate("2026-09-14T18:00:00Z"))).toBe("20260914T180000");
  });
});

describe("serializeLines", () => {
  test("joins with CRLF and ends with one", () => {
    expect(serializeLines(["BEGIN:VCALENDAR", "END:VCALENDAR"])).toBe(
      "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
    );
  });

  test("folds the lines it is given", () => {
    const serialized = serializeLines([`DESCRIPTION:${"x".repeat(200)}`]);

    expect(serialized).toContain(FOLD);
    expect(serialized.endsWith("\r\n")).toBe(true);
  });
});
