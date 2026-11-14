export const METADATA_KEY = /^[A-Za-z](?:[A-Za-z0-9_-]| [A-Za-z0-9_-])*$/;
export const CALLBACK_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
export const REFERENCE_NAME = /^[A-Za-z0-9_./:@$#-]{1,80}$/;
export const HEX_COLOR = /^#(?:[a-f\d]{8}|[a-f\d]{6}|[a-f\d]{3,4})$/i;
// OAI-CTRL-003 forbids these control and bidi characters.
// eslint-disable-next-line no-control-regex
export const FORBIDDEN_TEXT = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/;
export const HIT_TEST_MS = 250;

export function isForbiddenText(value: string): boolean {
  return FORBIDDEN_TEXT.test(value);
}

const encoder = new TextEncoder();

export function utf8Length(value: string): number {
  return encoder.encode(value).length;
}
