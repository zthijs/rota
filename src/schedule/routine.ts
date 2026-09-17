import { fail, isRecord, ok, type Parsed } from "@/schedule/parse";

export type Routine = { name: string; url: string | undefined };

export const MAX_ROUTINE_NAME_CHARS = 200;
export const MAX_ROUTINE_URL_CHARS = 2000;

const HTTP_URL_RE = /^https?:\/\/\S+$/i;

type Fields = { name: string; url: string };

const readFields = (raw: unknown): Parsed<Fields> => {
  if (typeof raw === "string") {
    const separator = raw.indexOf("|");

    return ok(
      separator === -1
        ? { name: raw.trim(), url: "" }
        : { name: raw.slice(0, separator).trim(), url: raw.slice(separator + 1).trim() },
    );
  }

  if (isRecord(raw) && "name" in raw) {
    const { name, url } = raw;

    if (typeof name !== "string") return fail("routine name must be a string");
    if (url !== undefined && typeof url !== "string") return fail("routine url must be a string");

    return ok({ name: name.trim(), url: url?.trim() ?? "" });
  }

  return fail('expected "Name|https://url", "Name", or { name, url }');
};

export const parseRoutine = (raw: unknown): Parsed<Routine> => {
  const fields = readFields(raw);
  if (!fields.ok) return fields;

  const { name, url } = fields.value;

  if (name.length === 0) return fail("routine name is empty");
  if (name.length > MAX_ROUTINE_NAME_CHARS) {
    return fail(`routine name is longer than ${MAX_ROUTINE_NAME_CHARS} characters`);
  }
  if (url.length > MAX_ROUTINE_URL_CHARS) {
    return fail(
      `routine "${name}" has a reference longer than ${MAX_ROUTINE_URL_CHARS} characters`,
    );
  }
  if (url.length > 0 && !HTTP_URL_RE.test(url)) {
    return fail(`routine "${name}" has a reference that is not an http(s) URL`);
  }

  return ok({ name, url: url.length > 0 ? url : undefined });
};

export type EncodedRoutine = string | { name: string; url?: string };

export const encodeRoutine = ({ name, url }: Routine): EncodedRoutine => {
  if (name.includes("|")) return url ? { name, url } : { name };

  return url ? `${name}|${url}` : name;
};
