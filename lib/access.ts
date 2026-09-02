import { env } from 'cloudflare:workers';

export type AccessRole = 'admin' | 'general';

export type AccessContext = {
  authenticated: boolean;
  configured: boolean;
  email: string | null;
  role: AccessRole;
};

type AccessTokenHeader = { alg?: unknown; kid?: unknown };
type AccessTokenClaims = {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
  nbf?: unknown;
};

type AccessKey = JsonWebKey & { kid?: unknown };
type CachedKeys = { expiresAt: number; keys: AccessKey[] };

const keyCache = new Map<string, CachedKeys>();
const cacheLifetimeMs = 60 * 60 * 1000;

export class AccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 503,
  ) {
    super(message);
  }
}

function requiredConfig() {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/, '') ?? '';
  const audience = env.ACCESS_AUD?.trim() ?? '';
  return { audience, teamDomain };
}

function adminEmails() {
  return new Set(
    (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLocaleLowerCase())
      .filter(Boolean),
  );
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    return null;
  }
}

function includesAudience(value: unknown, expected: string) {
  return Array.isArray(value)
    ? value.some((item) => item === expected)
    : value === expected;
}

async function accessKeys(teamDomain: string) {
  const cached = keyCache.get(teamDomain);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(teamDomain + '/cdn-cgi/access/certs');
  if (!response.ok) throw new Error('Unable to verify Cloudflare Access credentials.');
  const body = (await response.json()) as { keys?: AccessKey[] };
  if (!Array.isArray(body.keys)) throw new Error('Cloudflare Access did not return signing keys.');

  keyCache.set(teamDomain, { keys: body.keys, expiresAt: Date.now() + cacheLifetimeMs });
  return body.keys;
}

async function verifyAccessToken(request: Request, teamDomain: string, audience: string) {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;

  const [encodedHeader, encodedClaims, encodedSignature, ...extraParts] = token.split('.');
  if (!encodedHeader || !encodedClaims || !encodedSignature || extraParts.length) return null;

  const header = decodeJson<AccessTokenHeader>(encodedHeader);
  const claims = decodeJson<AccessTokenClaims>(encodedClaims);
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
  if (claims.iss !== teamDomain || !includesAudience(claims.aud, audience)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > now) return null;
  if (typeof claims.email !== 'string' || !claims.email.trim()) return null;

  const key = (await accessKeys(teamDomain)).find(
    (item) => typeof item.kid === 'string' && item.kid === header.kid,
  );
  if (!key) return null;

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(encodedHeader + '.' + encodedClaims),
  );
  if (!verified) return null;

  return claims.email.trim().toLocaleLowerCase();
}

export async function getAccessContext(request: Request): Promise<AccessContext> {
  const { teamDomain, audience } = requiredConfig();
  if (!teamDomain || !audience) {
    return { authenticated: false, configured: false, email: null, role: 'general' };
  }

  const email = await verifyAccessToken(request, teamDomain, audience).catch(() => null);
  if (!email) return { authenticated: false, configured: true, email: null, role: 'general' };

  return {
    authenticated: true,
    configured: true,
    email,
    role: adminEmails().has(email) ? 'admin' : 'general',
  };
}

export async function requireAuthenticated(request: Request) {
  const context = await getAccessContext(request);
  if (!context.configured) {
    throw new AccessError('Cloudflare Access has not been configured for this ERP.', 503);
  }
  if (!context.authenticated) {
    throw new AccessError('Cloudflare Access sign-in is required.', 401);
  }
  return context;
}

export async function requireAdmin(request: Request) {
  const context = await requireAuthenticated(request);
  if (context.role !== 'admin') {
    throw new AccessError('Administrator access is required for this action.', 403);
  }
  return context;
}
