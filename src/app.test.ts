import { describe, expect, test } from "bun:test";
import app from "@/app";
import { feedPath } from "@/schedule/feed";
import type { Secrets } from "@/schedule/token";

const ENV = { ROTA_SECRET: "test-secret-for-signing" } satisfies Secrets;

const SCHEDULE = {
  routines: ["Push|https://app.example/push", "Pull", "Legs"],
  slots: ["mon@18:00", "thu@19:30"],
  start: "2026-09-14",
  tz: "Europe/Amsterdam",
  name: "Gym",
};

const post = (body: unknown, env: Secrets = ENV) =>
  app.request(
    "/api/schedule",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
    env,
  );

const json = async (response: Response) => (await response.json()) as Record<string, unknown>;

type Created = { token: string; jti: string; feedUrl: string; webcalUrl: string };

const create = async (schedule: Record<string, unknown> = {}) => {
  const response = await post({ ...SCHEDULE, ...schedule });
  expect(response.status).toBe(200);

  return (await json(response)) as Created & Record<string, unknown>;
};

describe("POST /api/schedule", () => {
  test("mints a feed and describes the rotation it produces", async () => {
    const created = await create();

    expect(created.feedUrl).toBe(`http://localhost${feedPath(created.token)}`);
    expect(created.webcalUrl).toBe(`webcal://localhost${feedPath(created.token)}`);
    expect(created.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toMatchObject({ eventCount: 6, periodWeeks: 3 });
    expect(created.rotation).toHaveLength(6);
  });

  test("rejects a body that is not JSON", async () => {
    const response = await post("{not json");

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ error: "Body is not valid JSON" });
  });

  test("rejects an invalid schedule and says which field failed", async () => {
    const response = await post({ ...SCHEDULE, tz: "Europe/Atlantis" });

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      error: "Invalid schedule",
      issues: ["tz: must be a known IANA timezone, e.g. Europe/Amsterdam"],
    });
  });

  test("refuses a body larger than the limit before parsing it", async () => {
    const response = await post({ ...SCHEDULE, name: "x".repeat(70 * 1024) });

    expect(response.status).toBe(413);
  });

  test("reports a missing signing secret as a server problem", async () => {
    const response = await post(SCHEDULE, {});

    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({
      error: "ROTA_SECRET is not set; feed links cannot be signed or verified",
    });
  });
});

describe("GET the feed", () => {
  test("serves a calendar a client can subscribe to", async () => {
    const created = await create();
    const response = await app.request(feedPath(created.token), {}, ENV);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("etag")).toBe(`"${created.jti}"`);
    expect(response.headers.get("x-rota-events")).toBe("6");
    expect(response.headers.get("x-rota-period-weeks")).toBe("3");

    const body = await response.text();

    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain("X-WR-CALNAME:Gym");
  });

  test("answers If-None-Match with 304 and no body", async () => {
    const created = await create();
    const response = await app.request(
      feedPath(created.token),
      { headers: { "if-none-match": `"${created.jti}"` } },
      ENV,
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });

  test("serves the calendar when the ETag does not match", async () => {
    const created = await create();
    const response = await app.request(
      feedPath(created.token),
      { headers: { "if-none-match": '"stale"' } },
      ENV,
    );

    expect(response.status).toBe(200);
  });

  test("does not reveal anything for a token it cannot verify", async () => {
    const response = await app.request(feedPath("not-a-real-token"), {}, ENV);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/schedule/:token", () => {
  test("reads the schedule back out without building a calendar", async () => {
    const created = await create({ duration: 75 });
    const response = await app.request(`/api/schedule/${created.token}`, {}, ENV);

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      jti: created.jti,
      feedUrl: created.feedUrl,
      eventCount: 6,
      periodWeeks: 3,
      config: {
        routines: [
          { name: "Push", url: "https://app.example/push" },
          { name: "Pull" },
          { name: "Legs" },
        ],
        start: "2026-09-14",
        duration: 75,
        tz: "Europe/Amsterdam",
        name: "Gym",
      },
    });
  });

  test("404s an unverifiable token", async () => {
    const response = await app.request("/api/schedule/not-a-real-token", {}, ENV);

    expect(response.status).toBe(404);
  });
});

test("serves the API docs at the root", async () => {
  const response = await app.request("/", {}, ENV);

  expect(response.status).toBe(200);
});
