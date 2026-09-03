import { getD1 } from '@/db';
import {
  adminResponseHeaders,
  isAdminRequest,
  isSameOriginRequest,
} from '@/lib/admin';
import { normalizeTimeSlots, parseTimeSlots } from '@/lib/time-slots';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: adminResponseHeaders() });
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown, label: string, maxLength = 120) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${label} is too long.`);
  return trimmed;
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return json({ error: 'Not found' }, 404);
  }

  try {
    const db = getD1();
    const [settings, trainers, candidates] = await db.batch([
      db.prepare('SELECT training_target AS trainingTarget, time_slots AS timeSlots FROM settings WHERE id = ?').bind('primary'),
      db.prepare('SELECT id, name, is_active AS isActive FROM trainers ORDER BY name ASC'),
      db.prepare(
        'SELECT id, serial_number AS serialNumber, enrollment_year AS enrollmentYear, name, phone, enrolled_at AS enrolledAt, is_active AS isActive FROM candidates ORDER BY enrolled_at DESC, serial_number ASC, name ASC',
      ),
    ]);
    const primarySetting = settings.results[0] as
      | { trainingTarget?: number; timeSlots?: unknown }
      | undefined;
    return json({
      trainingTarget: primarySetting?.trainingTarget ?? 15,
      timeSlots: parseTimeSlots(primarySetting?.timeSlots),
      trainers: trainers.results,
      candidates: candidates.results,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to load administrator records.' }, 503);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest(request))) {
    return json({ error: 'Not found' }, 404);
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const db = getD1();
    const timestamp = new Date().toISOString();

    if (payload.action === 'settings') {
      const target = Number(payload.trainingTarget);
      if (!Number.isInteger(target) || target < 1) {
        throw new Error('Training target must be a positive whole number.');
      }

      await db
        .prepare(
          'INSERT INTO settings (id, training_target, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET training_target = excluded.training_target, updated_at = excluded.updated_at',
        )
        .bind('primary', target, timestamp)
        .run();
      return json({ ok: true });
    }

    if (payload.action === 'time-slots') {
      const slots = normalizeTimeSlots(payload.timeSlots);
      await db
        .prepare(
          'INSERT INTO settings (id, time_slots, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET time_slots = excluded.time_slots, updated_at = excluded.updated_at',
        )
        .bind('primary', JSON.stringify(slots), timestamp)
        .run();
      return json({ ok: true, timeSlots: slots });
    }

    if (payload.action === 'trainer-create') {
      const name = requiredString(payload.name, 'Trainer name');
      const id = 'trainer-' + crypto.randomUUID();
      await db
        .prepare('INSERT INTO trainers (id, name, is_active, created_at) VALUES (?, ?, 1, ?)')
        .bind(id, name, timestamp)
        .run();
      return json({ ok: true, id, name }, 201);
    }

    if (payload.action === 'trainer-update') {
      const id = requiredString(payload.id, 'Trainer ID');
      const name = optionalString(payload.name, 'Trainer name', 80);
      const isActive = optionalBoolean(payload.isActive);
      if (name === undefined && isActive === undefined) {
        throw new Error('Nothing to update.');
      }

      const sets: string[] = [];
      const values: unknown[] = [];
      if (name !== undefined) {
        sets.push('name = ?');
        values.push(name);
      }
      if (isActive !== undefined) {
        sets.push('is_active = ?');
        values.push(isActive ? 1 : 0);
      }
      values.push(id);

      const result = await db
        .prepare(`UPDATE trainers SET ${sets.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
      if (!result.meta.changes) throw new Error('Trainer was not found.');
      return json({ ok: true });
    }

    if (payload.action === 'candidate-update') {
      const id = requiredString(payload.id, 'Candidate ID');
      const name = optionalString(payload.name, 'Candidate name', 120);
      const phone = payload.phone === undefined ? undefined : (typeof payload.phone === 'string' ? payload.phone.trim() : '');
      const enrolledAt = optionalString(payload.enrolledAt, 'Enrollment date', 10);
      if (enrolledAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(enrolledAt)) {
        throw new Error('Enrollment date must use a valid date.');
      }
      const isActive = optionalBoolean(payload.isActive);
      if (
        name === undefined &&
        phone === undefined &&
        enrolledAt === undefined &&
        isActive === undefined
      ) {
        throw new Error('Nothing to update.');
      }

      const sets: string[] = [];
      const values: unknown[] = [];
      if (name !== undefined) {
        sets.push('name = ?');
        values.push(name);
      }
      if (phone !== undefined) {
        sets.push('phone = ?');
        values.push(phone || null);
      }
      if (enrolledAt !== undefined) {
        sets.push('enrolled_at = ?');
        values.push(enrolledAt);
      }
      if (isActive !== undefined) {
        sets.push('is_active = ?');
        values.push(isActive ? 1 : 0);
      }
      values.push(id);

      const result = await db
        .prepare(`UPDATE candidates SET ${sets.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
      if (!result.meta.changes) throw new Error('Candidate was not found.');
      return json({ ok: true });
    }

    if (payload.action === 'candidate-delete') {
      const id = requiredString(payload.id, 'Candidate ID');
      const results = await db.batch([
        db.prepare('DELETE FROM training_sessions WHERE candidate_id = ?').bind(id),
        db.prepare('DELETE FROM candidates WHERE id = ?').bind(id),
      ]);
      if (!results[1].meta.changes) throw new Error('Candidate was not found.');
      return json({ ok: true });
    }

    return json({ error: 'Unsupported administrator action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save administrator changes.';
    const isDuplicateTrainer = /unique constraint failed: trainers\.name/i.test(message);
    return json(
      { error: isDuplicateTrainer ? 'A trainer with this name already exists.' : message },
      400,
    );
  }
}
