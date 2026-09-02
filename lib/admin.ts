import { env } from 'cloudflare:workers';

type AdminEnvironment = {
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

const SESSION_LIFETIME_SECONDS = 30 * 60;
const CLOCK_SKEW_SECONDS = 30;
const PRODUCTION_COOKIE = '__Host-pmts_admin';
const DEVELOPMENT_COOKIE = 'pmts_admin_dev';

function configuredSecrets() {
  const environment = env as unknown as AdminEnvironment;
  return {
    password: environment.ADMIN_PASSWORD?.trim() ?? '',
    sessionSecret: environment.ADMIN_SESSION_SECRET?.trim() ?? '',
  };
}

export function isAdminSignInConfigured() {
  const { password, sessionSecret } = configuredSecrets();
  return Boolean(password && sessionSecret.length >= 32);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function base64UrlToBytes(value: string) {
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
}

async function sign(value: string) {
  const { password, sessionSecret } = configuredSecrets();
  if (!password || sessionSecret.length < 32) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret + '\0' + password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)),
  );
}

function isHttps(request: Request) {
  return new URL(request.url).protocol === 'https:';
}

function cookieName(request: Request) {
  return isHttps(request) ? PRODUCTION_COOKIE : DEVELOPMENT_COOKIE;
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? '';
  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim();
    }
  }
  return '';
}

export async function verifyAdminPassword(provided: string) {
  const { password: expected, sessionSecret } = configuredSecrets();
  if (!expected || sessionSecret.length < 32 || !provided || provided.length > 256) return false;

  const [expectedHash, providedHash] = await Promise.all([
    sha256(expected),
    sha256(provided),
  ]);
  return constantTimeEqual(expectedHash, providedHash);
}

export async function createAdminSessionCookie(request: Request) {
  const now = Math.floor(Date.now() / 1000);
  const expires = now + SESSION_LIFETIME_SECONDS;
  const nonce = crypto.getRandomValues(new Uint8Array(18));
  const payload = [
    'v1',
    String(now),
    String(expires),
    bytesToBase64Url(nonce),
  ].join('.');
  const signature = await sign(payload);
  if (!signature) throw new Error('Administrator sign-in is not configured.');

  const secure = isHttps(request) ? '; Secure' : '';
  return (
    cookieName(request) +
    '=' +
    payload +
    '.' +
    bytesToBase64Url(signature) +
    '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
    SESSION_LIFETIME_SECONDS +
    secure
  );
}

export function clearAdminSessionCookie(request: Request) {
  const secure = isHttps(request) ? '; Secure' : '';
  return cookieName(request) + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + secure;
}

export async function isAdminRequest(request: Request) {
  const token = readCookie(request, cookieName(request));
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') return false;

  const issuedAt = Number(parts[1]);
  const expires = Number(parts[2]);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isInteger(issuedAt) ||
    !Number.isInteger(expires) ||
    issuedAt > now + CLOCK_SKEW_SECONDS ||
    expires <= now ||
    expires - issuedAt !== SESSION_LIFETIME_SECONDS
  ) {
    return false;
  }

  const payload = parts.slice(0, 4).join('.');
  const expectedSignature = await sign(payload);
  const providedSignature = base64UrlToBytes(parts[4]);
  return Boolean(
    expectedSignature &&
      providedSignature &&
      constantTimeEqual(expectedSignature, providedSignature),
  );
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function adminResponseHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set('cache-control', 'no-store, max-age=0');
  headers.set('pragma', 'no-cache');
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  return headers;
}

export async function adminClientFingerprint(request: Request) {
  const address =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const secret = configuredSecrets().sessionSecret;
  return bytesToBase64Url(await sha256(secret + '\0' + address));
}
