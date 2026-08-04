/**
 * Turns raw/API/native errors into short messages a normal user can act on.
 * Never exposes URLs, ports, status codes, stack traces, or setup commands.
 */

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

const KNOWN: Array<{ test: RegExp; message: string }> = [
  { test: /^not logged in$/i, message: 'Please sign in again to continue.' },
  { test: /no joint account/i, message: 'Join or create a joint account first.' },
  { test: /set a pin first/i, message: 'Set a 4–8 digit PIN first.' },
  { test: /turn on app lock first/i, message: 'Turn on App lock first, then try again.' },
  { test: /pin must be/i, message: 'PIN must be 4–8 digits.' },
  { test: /email already registered/i, message: 'This email is already registered. Try signing in.' },
  { test: /invalid email or password/i, message: 'Incorrect email or password.' },
  { test: /user did not share/i, message: '' }, // cancel — caller should ignore
  { test: /network request failed/i, message: "Can't connect right now. Check your internet and try again." },
  { test: /failed to fetch|fetch failed|econnrefused|enotfound/i, message: "Can't connect right now. Check your internet and try again." },
  { test: /timeout|timed out|aborted|aborterror/i, message: 'This is taking too long. Please try again in a moment.' },
  { test: /permission.*(denied|microphone|mic)/i, message: 'Please allow microphone access in your phone settings.' },
  { test: /biometric module|rebuild the app/i, message: 'Fingerprint / Face unlock isn’t available on this device right now.' },
  { test: /amount.*required|merchant.*required/i, message: 'Please enter an amount and what you spent on.' },
  { test: /amount must be greater than/i, message: 'Please enter an amount greater than zero.' },
  { test: /group not found/i, message: "We couldn’t find that group." },
  { test: /not a member/i, message: 'You’re not a member of this group.' },
  { test: /invalid invite|invite code.*(invalid|not found|expired)|bad invite|wrong invite/i, message: 'That invite code doesn’t look right. Please check and try again.' },
];

function looksTechnical(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    /https?:\/\//.test(m) ||
    m.includes('localhost') ||
    m.includes('127.0.0.1') ||
    m.includes('adb') ||
    m.includes('npm run') ||
    m.includes('dev_lan') ||
    m.includes('api.ts') ||
    m.includes('rebuild') ||
    m.includes('stack') ||
    m.includes('exception') ||
    m.includes('typeerror') ||
    m.includes('referenceerror') ||
    m.includes('syntaxerror') ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('unexpected token') ||
    m.includes('json parse') ||
    m.includes('java.') ||
    m.includes('nsurl') ||
    m.includes('com.google') ||
    m.includes('error code') ||
    /request failed\s*\(/.test(m) ||
    /failed\s*\(\d{3}\)/.test(m) ||
    /cannot reach server/.test(m) ||
    /server timeout/.test(m) ||
    /^\d{3}\b/.test(msg.trim()) ||
    msg.includes('\n    at ') ||
    // API field names (camelCase) — not for end users
    /[a-z]+[A-Z][a-zA-Z]*/.test(msg) ||
    /\b(payload|schema|validation|mongo|objectid|undefined|null is not)\b/i.test(msg)
  );
}

function mapByStatus(status: number, raw: string, fallback: string): string {
  if (status === 0) {
    if (/timeout|abort/i.test(raw)) {
      return 'This is taking too long. Please try again in a moment.';
    }
    return "Can't connect right now. Check your internet and try again.";
  }
  if (status === 401) return 'Please sign in again to continue.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) {
    if (raw && !looksTechnical(raw) && raw.length < 120) return raw;
    return "We couldn't find that.";
  }
  if (status === 409) {
    if (raw && !looksTechnical(raw) && raw.length < 120) return raw;
    return 'That already exists. Try something else.';
  }
  if (status === 429) return 'Too many tries. Please wait a bit and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  if (status >= 400) {
    if (raw && !looksTechnical(raw) && raw.length < 160) return raw;
    return fallback;
  }
  return fallback;
}

/**
 * @param err - thrown value, ApiError, or raw string
 * @param fallback - used when the error is empty or too technical
 */
export function userFacingError(err: unknown, fallback: string = DEFAULT_FALLBACK): string {
  if (err == null || err === '') return fallback;

  const status = typeof (err as any)?.status === 'number' ? (err as any).status : undefined;
  const raw =
    typeof err === 'string'
      ? err
      : String((err as any)?.message || err || '').trim();

  if (!raw && status == null) return fallback;

  for (const { test, message } of KNOWN) {
    if (test.test(raw)) {
      return message || fallback;
    }
  }

  if (typeof status === 'number') {
    return mapByStatus(status, raw, fallback);
  }

  if (!raw || looksTechnical(raw)) return fallback;
  if (raw.length > 160) return fallback;
  return raw;
}
