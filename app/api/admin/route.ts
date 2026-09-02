import { getD1 } from '@/db';
import {
  adminResponseHeaders,
  isAdminRequest,
  isSameOriginRequest,
} from '@/lib/admin';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: adminResponseHeaders() });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest(request))) {
    return json({ error: 'Not found' }, 404);
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;

    if (payload.action === 'settings') {
      const target = Number(payload.trainingTarget);
      if (!Number.isInteger(target) || target < 1) {
        throw new Error('Training target must be a positive whole number.');
      }

      await getD1()
        .prepare(
          'INSERT INTO settings (id, training_target, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET training_target = excluded.training_target, updated_at = excluded.updated_at',
        )
        .bind('primary', target, new Date().toISOString())
        .run();
      return json({ ok: true });
    }

    return json({ error: 'Unsupported administrator action.' }, 400);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Unable to save administrator changes.' },
      400,
    );
  }
}
