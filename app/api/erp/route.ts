import { getD1 } from '@/db';

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

export async function GET() {
  try {
    const db = getD1();
    const [settings, candidates, sessions] = await db.batch([
      db.prepare('SELECT training_target AS trainingTarget FROM settings WHERE id = ?').bind('primary'),
      db.prepare('SELECT id, name, phone, enrolled_at AS enrolledAt, is_active AS isActive FROM candidates WHERE is_active = 1 ORDER BY enrolled_at DESC, name ASC'),
      db.prepare('SELECT s.id, s.candidate_id AS candidateId, c.name AS candidateName, s.session_date AS sessionDate, s.time_slot AS timeSlot, s.status, s.trainer_name AS trainerName, s.notes FROM training_sessions s JOIN candidates c ON c.id = s.candidate_id ORDER BY s.session_date DESC, s.time_slot ASC LIMIT 100'),
    ]);
    return Response.json({ trainingTarget: settings.results[0]?.trainingTarget ?? 15, candidates: candidates.results, sessions: sessions.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load ERP data.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const db = getD1();
    const timestamp = new Date().toISOString();
    if (payload.action === 'candidate') {
      const id = requiredString(payload.id, 'Candidate ID');
      const name = requiredString(payload.name, 'Candidate name');
      const enrolledAt = requiredString(payload.enrolledAt, 'Enrollment date');
      await db.prepare('INSERT INTO candidates (id, name, phone, enrolled_at, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)').bind(id, name, typeof payload.phone === 'string' ? payload.phone.trim() : null, enrolledAt, timestamp).run();
      return Response.json({ ok: true, id }, { status: 201 });
    }
    if (payload.action === 'session') {
      const candidateId = requiredString(payload.candidateId, 'Candidate ID');
      const sessionDate = requiredString(payload.sessionDate, 'Session date');
      const timeSlot = requiredString(payload.timeSlot, 'Time slot');
      const status = requiredString(payload.status, 'Status');
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO training_sessions (id, candidate_id, session_date, time_slot, status, trainer_name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, candidateId, sessionDate, timeSlot, status, typeof payload.trainerName === 'string' ? payload.trainerName.trim() : null, typeof payload.notes === 'string' ? payload.notes.trim() : null, timestamp).run();
      return Response.json({ ok: true, id }, { status: 201 });
    }
    if (payload.action === 'session-status') {
      const id = requiredString(payload.id, 'Session ID');
      const status = requiredString(payload.status, 'Status');
      await db.prepare('UPDATE training_sessions SET status = ? WHERE id = ?').bind(status, id).run();
      return Response.json({ ok: true, id });
    }
    if (payload.action === 'settings') {
      const target = Number(payload.trainingTarget);
      if (!Number.isInteger(target) || target < 1) throw new Error('Training target must be a positive whole number.');
      await db.prepare('INSERT INTO settings (id, training_target, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET training_target = excluded.training_target, updated_at = excluded.updated_at').bind('primary', target, timestamp).run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Unsupported ERP action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to update ERP data.' }, { status: 400 });
  }
}
