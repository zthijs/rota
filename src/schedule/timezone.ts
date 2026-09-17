const IANA_NAME_RE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const MAX_TZ_CHARS = 64;

const knownTimeZones: ReadonlySet<string> = new Set(Intl.supportedValuesOf?.("timeZone") ?? []);

const resolvableByIntl = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const isValidTimeZone = (tz: string): boolean =>
  tz.length > 0 &&
  tz.length <= MAX_TZ_CHARS &&
  IANA_NAME_RE.test(tz) &&
  (knownTimeZones.has(tz) || resolvableByIntl(tz));
