import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const CRLF = "\r\n";
const FOLD_SEPARATOR = `${CRLF} `;
const OCTET_LIMIT = 75;

const ESCAPE_RE = /[\\;,]/g;
const NEWLINE_RE = /\r\n|[\r\n]/g;
const NON_ASCII_RE = /[^\x20-\x7e]/;

const LOCAL_FORMAT = "yyyyMMdd'T'HHmmss";
const UTC_FORMAT = "yyyyMMdd'T'HHmmss'Z'";

export const escapeText = (value: string): string =>
  value.replace(ESCAPE_RE, "\\$&").replace(NEWLINE_RE, "\\n");

const utf8Size = (char: string): number => {
  const codePoint = char.codePointAt(0)!;

  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
};

export const foldLine = (line: string): string => {
  if (line.length <= OCTET_LIMIT && !NON_ASCII_RE.test(line)) return line;

  const done: string[] = [];
  const pending = { text: "", octets: 0 };

  for (const char of line) {
    const size = utf8Size(char);
    const limit = done.length === 0 ? OCTET_LIMIT : OCTET_LIMIT - 1;

    if (pending.octets + size > limit) {
      done.push(pending.text);
      pending.text = "";
      pending.octets = 0;
    }

    pending.text += char;
    pending.octets += size;
  }

  return [...done, pending.text].join(FOLD_SEPARATOR);
};

export const formatIcsLocal = (date: Date): string => format(date, LOCAL_FORMAT);

export const formatIcsUtc = (instant: Date): string => formatInTimeZone(instant, "UTC", UTC_FORMAT);

export const formatIcsDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `PT${rest}M`;
  if (rest === 0) return `PT${hours}H`;
  return `PT${hours}H${rest}M`;
};

export const serializeLines = (lines: readonly string[]): string =>
  `${lines.map((line) => foldLine(line)).join(CRLF)}${CRLF}`;
