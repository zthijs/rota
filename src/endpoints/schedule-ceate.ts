import { contentJson, OpenAPIRoute } from "chanfana";
import { describeRotation, feedUrls } from "@/schedule/feed";
import { buildRotation } from "@/schedule/rotate";
import { mintToken } from "@/schedule/token";
import { validate } from "@/schedule/validate";
import { CreatedFeed, Rejected, ScheduleInput } from "@/schemas";
import type { AppContext } from "@/types";

export class ScheduleCreate extends OpenAPIRoute {
  schema = {
    tags: ["Schedule"],
    summary: "Mint a feed URL for a rotating schedule",
    description:
      "Describe the routines and the weekly slots they rotate through, and get back a feed URL to subscribe to. Routines are dealt into slots in order and wrap around, so 3 routines across 2 slots a week takes 3 weeks to come round.",
    request: { body: contentJson(ScheduleInput) },
    responses: {
      "200": {
        description: "The feed URL and the rotation it will produce",
        ...contentJson(CreatedFeed),
      },
      "400": { description: "The schedule was rejected", ...contentJson(Rejected) },
    },
  };

  async handle(c: AppContext) {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Body is not valid JSON" }, 400);
    }

    const parsed = validate(body);
    if (!parsed.ok) return c.json({ error: "Invalid schedule", issues: parsed.errors }, 400);

    const minted = await mintToken(parsed.config, c.env);
    if (!minted.ok) return c.json({ error: "Invalid schedule", issues: minted.errors }, 400);

    const rotation = buildRotation(parsed.config);

    return c.json({
      ...feedUrls(minted.token, new URL(c.req.url).origin),
      token: minted.token,
      jti: minted.jti,
      location: parsed.config.location,
      eventCount: rotation.eventCount,
      periodWeeks: rotation.periodWeeks,
      rotation: describeRotation(rotation),
    });
  }
}
