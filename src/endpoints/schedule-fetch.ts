import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { describeRotation, feedUrls } from "@/schedule/feed";
import { buildRotation } from "@/schedule/rotate";
import { verifyToken } from "@/schedule/token";
import { InspectedFeed, Rejected } from "@/schemas";
import type { AppContext } from "@/types";

export class ScheduleFetch extends OpenAPIRoute {
  schema = {
    tags: ["Schedule"],
    summary: "Read the schedule back out of a feed URL",
    description:
      "Unpacks a token minted by POST /api/schedule and says what it holds. Useful for checking what a link you already have will do.",
    request: {
      params: z.object({
        token: z.string().describe("The signed token from a feed URL."),
      }),
    },
    responses: {
      "200": {
        description: "The schedule and the rotation it produces",
        ...contentJson(InspectedFeed),
      },
      "404": { description: "That token did not verify", ...contentJson(Rejected) },
    },
  };

  async handle(c: AppContext<"/api/schedule/:token">) {
    const token = c.req.param("token");

    const feed = await verifyToken(token, c.env);
    if (!feed) return c.json({ error: "Unknown feed" }, 404);

    const rotation = buildRotation(feed.config);

    return c.json({
      ...feedUrls(token, new URL(c.req.url).origin),
      jti: feed.jti,
      issuedAt: new Date(feed.iat * 1000).toISOString(),
      config: feed.config,
      eventCount: rotation.eventCount,
      periodWeeks: rotation.periodWeeks,
      rotation: describeRotation(rotation),
    });
  }
}
