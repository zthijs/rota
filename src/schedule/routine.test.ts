import { describe, expect, test } from "bun:test";
import {
  encodeRoutine,
  MAX_ROUTINE_NAME_CHARS,
  parseRoutine,
  type Routine,
} from "@/schedule/routine";

const value = (raw: unknown) => {
  const parsed = parseRoutine(raw);
  if (!parsed.ok) throw new Error(`expected ${JSON.stringify(raw)} to parse: ${parsed.message}`);

  return parsed.value;
};

const message = (raw: unknown) => {
  const parsed = parseRoutine(raw);
  if (parsed.ok) throw new Error(`expected ${JSON.stringify(raw)} to be rejected`);

  return parsed.message;
};

describe("parseRoutine from a string", () => {
  test("splits name from reference on the first pipe", () => {
    expect(value("Push|https://app.example/push")).toEqual({
      name: "Push",
      url: "https://app.example/push",
    });
  });

  test("takes a bare name as a routine with no reference", () => {
    expect(value("Push")).toEqual({ name: "Push", url: undefined });
  });

  test("treats an empty reference as absent", () => {
    expect(value("Push|")).toEqual({ name: "Push", url: undefined });
  });

  test("trims around the pipe", () => {
    expect(value("  Push  |  https://app.example/push  ")).toEqual({
      name: "Push",
      url: "https://app.example/push",
    });
  });
});

describe("parseRoutine from an object", () => {
  test("reads { name, url }", () => {
    expect(value({ name: "Push", url: "https://app.example/push" })).toEqual({
      name: "Push",
      url: "https://app.example/push",
    });
  });

  test("allows a name on its own", () => {
    expect(value({ name: "Push" })).toEqual({ name: "Push", url: undefined });
  });

  test("rejects non-string fields", () => {
    expect(message({ name: 5 })).toBe("routine name must be a string");
    expect(message({ name: "Push", url: 5 })).toBe("routine url must be a string");
  });
});

describe("parseRoutine rejections", () => {
  test("rejects an empty name", () => {
    expect(message("")).toBe("routine name is empty");
    expect(message("   ")).toBe("routine name is empty");
    expect(message("|https://app.example/push")).toBe("routine name is empty");
  });

  test("rejects an over-long name", () => {
    expect(message("x".repeat(MAX_ROUTINE_NAME_CHARS + 1))).toContain("longer than");
    expect(value("x".repeat(MAX_ROUTINE_NAME_CHARS)).name).toHaveLength(MAX_ROUTINE_NAME_CHARS);
  });

  test("rejects a reference that is not an http(s) URL", () => {
    expect(message("Push|ftp://app.example/push")).toContain("not an http(s) URL");
    expect(message("Push|app.example/push")).toContain("not an http(s) URL");
  });

  test("rejects a reference containing whitespace", () => {
    expect(message("Push|https://app.example/a b")).toContain("not an http(s) URL");
  });

  test("rejects values that are neither shape", () => {
    expect(message(42)).toContain("expected");
    expect(message(null)).toContain("expected");
  });
});

describe("encodeRoutine", () => {
  const roundTrips = (routine: Routine) => expect(value(encodeRoutine(routine))).toEqual(routine);

  test("uses the compact string form when it can", () => {
    expect(encodeRoutine({ name: "Push", url: "https://app.example/push" })).toBe(
      "Push|https://app.example/push",
    );
    expect(encodeRoutine({ name: "Push", url: undefined })).toBe("Push");
  });

  test("falls back to the object form when the name contains a pipe", () => {
    expect(encodeRoutine({ name: "Push|Pull", url: undefined })).toEqual({ name: "Push|Pull" });
    expect(encodeRoutine({ name: "Push|Pull", url: "https://app.example/push" })).toEqual({
      name: "Push|Pull",
      url: "https://app.example/push",
    });
  });

  test("survives a round-trip back through parseRoutine", () => {
    roundTrips({ name: "Push", url: "https://app.example/push" });
    roundTrips({ name: "Push", url: undefined });
    roundTrips({ name: "Push|Pull", url: undefined });
    roundTrips({ name: "Push|Pull", url: "https://app.example/push" });
    roundTrips({ name: "Núñez — legs", url: undefined });
  });
});
