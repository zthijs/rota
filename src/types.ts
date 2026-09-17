import type { Context } from "hono";
import type { Secrets } from "@/schedule/token";

export type AppContext<Path extends string = string> = Context<{ Bindings: Secrets }, Path>;
