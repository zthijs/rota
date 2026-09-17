import { describe, expect, test } from "bun:test";
import { describeRotation, feedPath, feedUrls } from "@/schedule/feed";
import { buildRotation } from "@/schedule/rotate";
import { validate } from "@/schedule/validate";

describe("feedPath", () => {
  test("ends in .ics so calendar clients recognise it", () => {
    expect(feedPath("a.token.here")).toBe("/c/a.token.here/rota.ics");
  });
});

describe("feedUrls", () => {
  test("offers the same feed over https and webcal", () => {
    expect(feedUrls("tok", "https://rota.example")).toEqual({
      feedUrl: "https://rota.example/c/tok/rota.ics",
      webcalUrl: "webcal://rota.example/c/tok/rota.ics",
    });
  });

  test("swaps an http origin too, for local development", () => {
    expect(feedUrls("tok", "http://localhost:3000").webcalUrl).toBe(
      "webcal://localhost:3000/c/tok/rota.ics",
    );
  });
});

describe("describeRotation", () => {
  test("flattens the rotation into the shape the API returns", () => {
    const parsed = validate({
      routines: ["Push|https://app.example/push", "Pull"],
      slots: ["mon@18:00"],
      start: "2026-09-14",
      tz: "Europe/Amsterdam",
    });
    if (!parsed.ok) throw new Error(`fixture is invalid: ${parsed.errors.join("; ")}`);

    expect(describeRotation(buildRotation(parsed.config))).toEqual([
      {
        index: 0,
        week: 0,
        weekday: "mon",
        time: "18:00",
        routine: "Push",
        url: "https://app.example/push",
        firstDate: "2026-09-14",
      },
      {
        index: 1,
        week: 1,
        weekday: "mon",
        time: "18:00",
        routine: "Pull",
        url: undefined,
        firstDate: "2026-09-21",
      },
    ]);
  });
});
