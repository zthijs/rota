import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { buildCalendar } from "@/schedule/calendar";
import { buildRotation } from "@/schedule/rotate";
import { verifyToken } from "@/schedule/token";
import type { AppContext } from "@/types";

const CACHE_CONTROL = "public, max-age=3600, immutable";

const unknownFeed = (): Response =>
  new Response("Unknown feed\n", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

export class ScheduleFeed extends OpenAPIRoute {
  schema = {
    tags: ["Schedule"],
    summary: "The calendar feed itself",
    description:
      "The iCalendar document a calendar subscribes to, built from the schedule in the token. Every event recurs at the rotation's period, so the feed is a handful of VEVENTs and never runs out.",
    request: {
      params: z.object({
        token: z.string().describe("The signed token from a feed URL."),
      }),
    },
    responses: {
      "200": {
        description: "An iCalendar document",
        content: { "text/calendar": { schema: z.string() } },
      },
      "304": { description: "Unchanged since the ETag you sent" },
      "404": {
        description: "That token did not verify",
        content: { "text/plain": { schema: z.string() } },
      },
    },
  };

  async handle(c: AppContext<"/c/:token/rota.ics">) {
    const token = c.req.param("token");

    const feed = await verifyToken(token, c.env);
    if (!feed) return unknownFeed();

    const etag = `"${feed.jti}"`;

    if (c.req.header("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL },
      });
    }

    const rotation = buildRotation(feed.config);

    return new Response(buildCalendar(feed.config, rotation, feed), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="rota.ics"',
        "Cache-Control": CACHE_CONTROL,
        ETag: etag,
        "X-Rota-Events": String(rotation.eventCount),
        "X-Rota-Period-Weeks": String(rotation.periodWeeks),
      },
    });
  }
}
