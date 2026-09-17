import { describe, expect, test } from "bun:test";
import {
  MAX_TOKEN_INPUT,
  MissingSecretError,
  mintToken,
  type Secrets,
  verifyToken,
} from "@/schedule/token";
import { validate } from "@/schedule/validate";

const SECRETS: Secrets = { ROTA_SECRET: "test-secret-for-signing" };

const configOf = (raw: Record<string, unknown>) => {
  const parsed = validate({
    routines: ["Push|https://app.example/push", "Pull", "Legs"],
    slots: ["mon@18:00", "thu@19:30"],
    start: "2026-09-14",
    tz: "Europe/Amsterdam",
    ...raw,
  });
  if (!parsed.ok) throw new Error(`fixture is invalid: ${parsed.errors.join("; ")}`);

  return parsed.config;
};

const mint = async (raw: Record<string, unknown> = {}, secrets = SECRETS) => {
  const minted = await mintToken(configOf(raw), secrets);
  if (!minted.ok) throw new Error(`expected a token: ${minted.errors.join("; ")}`);

  return minted;
};

describe("mintToken", () => {
  test("signs a token and identifies the link", async () => {
    const minted = await mint();

    expect(minted.token.split(".")).toHaveLength(3);
    expect(minted.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(minted.iat).toBeGreaterThan(0);
  });

  test("gives every link its own identity", async () => {
    const [first, second] = await Promise.all([mint(), mint()]);

    expect(first.jti).not.toBe(second.jti);
  });

  test("refuses a schedule too big to carry in a link", async () => {
    const minted = await mintToken(
      configOf({
        routines: Array.from(
          { length: 60 },
          (_, index) => `${"Long routine name ".repeat(5)}${index}`,
        ),
        slots: ["mon@18:00"],
      }),
      SECRETS,
    );

    expect(minted.ok).toBe(false);
    if (!minted.ok) expect(minted.errors.join(" ")).toContain("characters to fit in a link");
  });

  test("needs a secret to sign with", async () => {
    await expect(mintToken(configOf({}), {})).rejects.toThrow(MissingSecretError);
  });
});

describe("verifyToken", () => {
  test("reads the whole schedule back out of the token", async () => {
    const minted = await mint({ duration: 75, location: "Sportlaan 12", name: "Gym" });
    const verified = await verifyToken(minted.token, SECRETS);

    expect(verified?.config).toEqual(
      configOf({ duration: 75, location: "Sportlaan 12", name: "Gym" }),
    );
    expect(verified?.jti).toBe(minted.jti);
    expect(verified?.iat).toBe(minted.iat);
  });

  test("keeps a routine name containing a pipe intact", async () => {
    const minted = await mint({ routines: [{ name: "Push|Pull", url: "https://app.example/p" }] });
    const verified = await verifyToken(minted.token, SECRETS);

    expect(verified?.config.routines).toEqual([
      { name: "Push|Pull", url: "https://app.example/p" },
    ]);
  });

  test("rejects a token signed with a different secret", async () => {
    const minted = await mint();

    expect(await verifyToken(minted.token, { ROTA_SECRET: "some-other-secret" })).toBeNull();
  });

  test("rejects a tampered payload", async () => {
    const [header, payload, signature] = (await mint()).token.split(".");
    const tampered = `${header}.${payload!.slice(0, -1)}${payload!.endsWith("A") ? "B" : "A"}.${signature}`;

    expect(await verifyToken(tampered, SECRETS)).toBeNull();
  });

  test("rejects nonsense", async () => {
    expect(await verifyToken("", SECRETS)).toBeNull();
    expect(await verifyToken("not-a-token", SECRETS)).toBeNull();
  });

  test("rejects an over-long token without trying to verify it", async () => {
    expect(await verifyToken("x".repeat(MAX_TOKEN_INPUT + 1), {})).toBeNull();
  });

  test("needs a secret to verify with", async () => {
    await expect(verifyToken("not-a-token", {})).rejects.toThrow(MissingSecretError);
  });
});
