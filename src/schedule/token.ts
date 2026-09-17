import { jwtVerify, SignJWT } from "jose";
import { decodeClaims, encodeClaims } from "@/schedule/claims";
import type { ScheduleConfig } from "@/schedule/config";
import { validate } from "@/schedule/validate";

const ISSUER = "rota";
const ALGORITHM = "HS256";

export const MAX_TOKEN_CHARS = 1800;
export const MAX_TOKEN_INPUT = 4096;

export type Secrets = {
  readonly ROTA_SECRET?: string | undefined;
};

export class MissingSecretError extends Error {
  constructor() {
    super("ROTA_SECRET is not set; feed links cannot be signed or verified");
    this.name = "MissingSecretError";
  }
}

export type FeedToken = { token: string; jti: string; iat: number };

export type MintResult = ({ ok: true } & FeedToken) | { ok: false; errors: string[] };

export type VerifiedFeed = { config: ScheduleConfig; jti: string; iat: number };

const encoder = new TextEncoder();

const signingKey = (secrets: Secrets): Uint8Array => {
  const secret = secrets.ROTA_SECRET?.trim();
  if (!secret) throw new MissingSecretError();

  return encoder.encode(secret);
};

export const mintToken = async (config: ScheduleConfig, secrets: Secrets): Promise<MintResult> => {
  const sign = signingKey(secrets);
  const jti = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ ...encodeClaims(config) })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setJti(jti)
    .setIssuedAt(iat)
    .sign(sign);

  if (token.length > MAX_TOKEN_CHARS) {
    return {
      ok: false,
      errors: [
        `this schedule needs ${token.length} characters to fit in a link (max ${MAX_TOKEN_CHARS}). ` +
          "Shorten the routine names or drop some reference URLs.",
      ],
    };
  }

  return { ok: true, token, jti, iat };
};

const verifyWith = async (token: string, key: Uint8Array) => {
  try {
    return await jwtVerify(token, key, { issuer: ISSUER, algorithms: [ALGORITHM] });
  } catch {
    return null;
  }
};

export const verifyToken = async (
  token: string,
  secrets: Secrets,
): Promise<VerifiedFeed | null> => {
  if (token.length === 0 || token.length > MAX_TOKEN_INPUT) return null;

  const verified = await verifyWith(token, signingKey(secrets));
  if (!verified) return null;

  const { jti, iat } = verified.payload;
  if (typeof jti !== "string" || typeof iat !== "number") return null;

  const parsed = validate(decodeClaims(verified.payload));

  return parsed.ok ? { config: parsed.config, jti, iat } : null;
};
