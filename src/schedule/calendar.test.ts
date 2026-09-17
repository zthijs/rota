import { beforeAll, describe, expect, test } from "bun:test";
import { buildCalendar, type FeedIdentity } from "@/schedule/calendar";
import { buildRotation } from "@/schedule/rotate";
import { validate } from "@/schedule/validate";

const IDENTITY: FeedIdentity = { jti: "11111111-1111-4111-8111-111111111111", iat: 1789000000 };

const BASE = {
  routines: ["Push, hard|https://app.example/push", "Pull", "Legs"],
  slots: ["mon@18:00", "thu@19:30"],
  start: "2026-09-14",
  tz: "Europe/Amsterdam",
};

const icsLines = (raw: Record<string, unknown> = {}) => {
  const parsed = validate({ ...BASE, ...raw });
  if (!parsed.ok) throw new Error(`fixture is invalid: ${parsed.errors.join("; ")}`);

  const document = buildCalendar(parsed.config, buildRotation(parsed.config), IDENTITY);

  return { document, lines: document.split("\r\n ").join("").split("\r\n") };
};

describe("the document as a whole", () => {
  let document: string;
  let lines: string[];

  beforeAll(() => {
    ({ document, lines } = icsLines());
  });

  test("uses CRLF everywhere, including a trailing one", () => {
    expect(document.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const line of document.split("\n").slice(0, -1)) expect(line.endsWith("\r")).toBe(true);
  });

  test("opens and closes the calendar", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("END:VCALENDAR");
  });

  test("pairs every event's BEGIN with an END", () => {
    const begins = lines.filter((line) => line === "BEGIN:VEVENT");
    const ends = lines.filter((line) => line === "END:VEVENT");

    expect(begins).toHaveLength(6);
    expect(ends).toHaveLength(6);
  });

  test("gives each event a unique UID built from the link's identity", () => {
    const uids = lines.filter((line) => line.startsWith("UID:"));

    expect(new Set(uids).size).toBe(6);
    expect(uids[0]).toBe(`UID:${IDENTITY.jti}-0@rota`);
  });

  test("stamps every event with the moment the link was minted", () => {
    expect(lines).toContain("DTSTAMP:20260910T002640Z");
  });
});

describe("recurrence", () => {
  test("repeats each event at the length of the cycle", () => {
    expect(icsLines().lines).toContain("RRULE:FREQ=WEEKLY;INTERVAL=3");
  });

  test("runs forever when there is no end date", () => {
    expect(icsLines().document).not.toContain("UNTIL=");
  });

  test("ends at the last moment of the until day, in the schedule's timezone", () => {
    // 2026-12-31T23:59:59 in Europe/Amsterdam (UTC+1 in winter) is 22:59:59Z.
    expect(icsLines({ until: "2026-12-31" }).lines).toContain(
      "RRULE:FREQ=WEEKLY;INTERVAL=3;UNTIL=20261231T225959Z",
    );
  });
});

describe("each event", () => {
  test("starts at a floating local time tagged with the timezone", () => {
    expect(icsLines().lines).toContain("DTSTART;TZID=Europe/Amsterdam:20260914T180000");
  });

  test("carries the duration rather than an end time", () => {
    expect(icsLines().lines).toContain("DURATION:PT1H");
    expect(icsLines({ duration: 75 }).lines).toContain("DURATION:PT1H15M");
    expect(icsLines().document).not.toContain("DTEND");
  });

  test("escapes the routine name in the summary", () => {
    expect(icsLines().lines).toContain("SUMMARY:Push\\, hard");
  });

  test("includes the routine's reference as a URL, only where there is one", () => {
    const urls = icsLines().lines.filter((line) => line.startsWith("URL;VALUE=URI:"));

    expect(urls).toEqual([
      "URL;VALUE=URI:https://app.example/push",
      "URL;VALUE=URI:https://app.example/push",
    ]);
  });

  test("says where the routine sits in the cycle", () => {
    expect(icsLines().lines).toContain(
      "DESCRIPTION:https://app.example/push\\n\\nSlot 1 of 6 in the rotation (week 1 of 3\\, mon 18:00).",
    );
  });

  test("adds the location to every event when one is given", () => {
    const { lines } = icsLines({ location: "Sportlaan 12; Amsterdam" });

    expect(lines.filter((line) => line === "LOCATION:Sportlaan 12\\; Amsterdam")).toHaveLength(6);
  });

  test("omits the location entirely when there is none", () => {
    expect(icsLines().document).not.toContain("LOCATION:");
  });
});

describe("calendar metadata", () => {
  test("names the calendar, falling back to Rota", () => {
    expect(icsLines({ name: "Gym" }).lines).toContain("X-WR-CALNAME:Gym");
    expect(icsLines().lines).toContain("X-WR-CALNAME:Rota");
  });

  test("summarises the rotation for the subscriber", () => {
    expect(icsLines().lines).toContain(
      "X-WR-CALDESC:3 routines rotating across 2 slots per week\\, repeating every 3 weeks.",
    );
  });

  test("uses the singular when the cycle is a single week", () => {
    const { lines } = icsLines({ routines: ["Push", "Pull"] });

    expect(lines).toContain(
      "X-WR-CALDESC:2 routines rotating across 2 slots per week\\, repeating every 1 week.",
    );
  });

  test("tells the client how often to refresh", () => {
    expect(icsLines().lines).toContain("X-PUBLISHED-TTL:PT12H");
    expect(icsLines().lines).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT12H");
  });
});
