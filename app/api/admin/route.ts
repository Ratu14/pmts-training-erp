import { getD1 } from '@/db';
import { AccessError, requireAdmin } from '@/lib/access';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
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
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unsupported administrator action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to save administrator changes.' },
      { status: 400 },
    );
  }
}
