import app from "@/app";
import type { Secrets } from "@/schedule/token";

const secrets: Secrets = { ROTA_SECRET: Bun.env.ROTA_SECRET };

/**
 * Bun hands the Server to fetch as its second argument, which is the slot Hono reads `c.env` from,
 * so the secrets have to be passed in here or every request sees an empty env.
 */
const server = Bun.serve({
  port: Number(Bun.env.PORT ?? 3000),
  fetch: (request) => app.fetch(request, secrets),
});

/**
 * Bun does not stop on SIGTERM by itself, so a container runtime waits out its whole grace period
 * and then kills the process: ten seconds per replica on every deploy, and a 137 that reads as an
 * out-of-memory kill. Draining explicitly turns that into an immediate, honest exit.
 */
const shutdown = async () => {
  await server.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`rota listening on ${server.url}`);
