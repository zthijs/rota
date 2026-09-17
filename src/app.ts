import { fromHono } from "chanfana";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ScheduleCreate } from "@/endpoints/schedule-ceate";
import { ScheduleFeed } from "@/endpoints/schedule-feed";
import { ScheduleFetch } from "@/endpoints/schedule-fetch";
import { feedPath } from "@/schedule/feed";
import { MissingSecretError, type Secrets } from "@/schedule/token";

const MAX_BODY_BYTES = 64 * 1024;

const app = new Hono<{ Bindings: Secrets }>();

app.onError((error, c) => {
  if (error instanceof MissingSecretError) return c.json({ error: error.message }, 500);

  console.error(error);
  return c.json({ error: "Something went wrong" }, 500);
});

app.on(
  "POST",
  "/api/schedule",
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: `Body is larger than ${MAX_BODY_BYTES} bytes` }, 413),
  }),
);

const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "@zthijs/rota",
      version: "1.0.0",
      description:
        "Calendar feeds for things that come round in turn. Post a schedule to get a signed feed URL, which is the only copy — treat it like a password.",
    },
  },
});

openapi.post("/api/schedule", ScheduleCreate);
openapi.get("/api/schedule/:token", ScheduleFetch);
openapi.get(feedPath(":token"), ScheduleFeed);

export default app;
