import { getD1 } from '@/db';
import {
  adminClientFingerprint,
  adminResponseHeaders,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  isAdminSignInConfigured,
  isAdminRequest,
  isSameOriginRequest,
  verifyAdminPassword,
} from '@/lib/admin';

const MAX_BODY_BYTES = 2_048;
const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;

type AttemptRow = {
  blocked_until: number;
  failure_count: number;
  window_started: number;
};

function json(payload: unknown, status = 200, extra?: HeadersInit) {
  return Response.json(payload, {
    status,
    headers: adminResponseHeaders(extra),
  });
}

async function currentAttempt(clientHash: string) {
  return getD1()
    .prepare(
      'SELECT window_started, failure_count, blocked_until FROM admin_login_attempts WHERE client_hash = ?',
    )
    .bind(clientHash)
    .first<AttemptRow>();
}

async function recordFailure(clientHash: string, previous: AttemptRow | null) {
  const now = Math.floor(Date.now() / 1000);
  const inWindow = Boolean(
    previous && now - previous.window_started < WINDOW_SECONDS,
  );
  const failureCount = inWindow ? previous!.failure_count + 1 : 1;
  const windowStarted = inWindow ? previous!.window_started : now;
  const blockedUntil =
    failureCount >= MAX_FAILURES ? now + LOCK_SECONDS : 0;

  await getD1()
    .prepare(
      'INSERT INTO admin_login_attempts (client_hash, window_started, failure_count, blocked_until) VALUES (?, ?, ?, ?) ON CONFLICT(client_hash) DO UPDATE SET window_started = excluded.window_started, failure_count = excluded.failure_count, blocked_until = excluded.blocked_until',
    )
    .bind(clientHash, windowStarted, failureCount, blockedUntil)
    .run();
}

export async function GET(request: Request) {
  return json({
    authenticated: await isAdminRequest(request),
    configured: isAdminSignInConfigured(),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: 'Not found' }, 404);
  }

  const contentType = request.headers.get('content-type') ?? '';
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (!contentType.startsWith('application/json') || contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Invalid request.' }, 400);
  }

  if (!isAdminSignInConfigured()) {
    return json({ error: 'Administrator sign-in has not been configured yet.' }, 503);
  }

  const clientHash = await adminClientFingerprint(request);
  const previous = (await currentAttempt(clientHash)) ?? null;
  const now = Math.floor(Date.now() / 1000);
  if (previous && previous.blocked_until > now) {
    return json(
      { error: 'Too many attempts. Try again later.' },
      429,
      { 'retry-after': String(previous.blocked_until - now) },
    );
  }

  let body: { password?: unknown; website?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Invalid request.' }, 400);
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  if (typeof body.website === 'string' && body.website.trim()) {
    return json({ error: 'Unable to sign in.' }, 401);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!(await verifyAdminPassword(password))) {
    await recordFailure(clientHash, previous);
    return json({ error: 'Unable to sign in. Check the password and try again.' }, 401);
  }

  await getD1()
    .prepare('DELETE FROM admin_login_attempts WHERE client_hash = ?')
    .bind(clientHash)
    .run();

  return json(
    { ok: true },
    200,
    { 'set-cookie': await createAdminSessionCookie(request) },
  );
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: 'Not found' }, 404);
  }
  return json(
    { ok: true },
    200,
    { 'set-cookie': clearAdminSessionCookie(request) },
  );
}
