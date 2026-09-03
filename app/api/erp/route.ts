import { getD1 } from '@/db';
import { parseTimeSlots } from '@/lib/time-slots';

const sessionStatuses = new Set(['Completed', 'Scheduled', 'No-show', 'Cancelled']);
const defaultTrainers = [
  { id: 'trainer-s-rao', name: 'S. Rao' },
  { id: 'trainer-m-jain', name: 'M. Jain' },
];

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function serialNumber(value: unknown) {
  const serial = Number(value);
  if (!Number.isInteger(serial) || serial < 1) throw new Error('Candidate serial number must be a positive whole number.');
  return serial;
}

function enrollmentYear(enrolledAt: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(enrolledAt)) throw new Error('Enrollment date must use a valid date.');
  const year = Number(enrolledAt.slice(2, 4));
  if (!Number.isInteger(year)) throw new Error('Enrollment date must use a valid year.');
  return year;
}

async function ensureDefaultTrainers(db: ReturnType<typeof getD1>) {
  const trainer = await db.prepare('SELECT id FROM trainers LIMIT 1').first<{ id: string }>();
  if (trainer) return;

  const createdAt = new Date().toISOString();
  await db.batch(defaultTrainers.map((item) => db.prepare(
    'INSERT OR IGNORE INTO trainers (id, name, is_active, created_at) VALUES (?, ?, 1, ?)',
  ).bind(item.id, item.name, createdAt)));
}

export async function GET() {
  try {
    const db = getD1();
    await ensureDefaultTrainers(db);
    const [settings, candidates, sessions, trainers] = await db.batch([
      db.prepare('SELECT training_target AS trainingTarget, time_slots AS timeSlots FROM settings WHERE id = ?').bind('primary'),
      db.prepare('SELECT id, serial_number AS serialNumber, enrollment_year AS enrollmentYear, name, phone, enrolled_at AS enrolledAt, is_active AS isActive FROM candidates WHERE is_active = 1 ORDER BY enrolled_at DESC, serial_number ASC, name ASC'),
      db.prepare(`SELECT
        s.id,
        s.candidate_id AS candidateId,
        c.name AS candidateName,
        s.session_date AS sessionDate,
        s.time_slot AS timeSlot,
        s.status,
        s.trainer_id AS trainerId,
        COALESCE(t.name, s.trainer_name, '—') AS trainerName,
        s.notes
        FROM training_sessions s
        JOIN candidates c ON c.id = s.candidate_id
        LEFT JOIN trainers t ON t.id = s.trainer_id
        ORDER BY s.session_date ASC, s.time_slot ASC
        LIMIT 100`),
      db.prepare('SELECT id, name FROM trainers WHERE is_active = 1 ORDER BY name ASC'),
    ]);
    const primarySetting = settings.results[0] as
      | { trainingTarget?: number; timeSlots?: unknown }
      | undefined;
    return Response.json({
      trainingTarget: primarySetting?.trainingTarget ?? 15,
      timeSlots: parseTimeSlots(primarySetting?.timeSlots),
      candidates: candidates.results,
      sessions: sessions.results,
      trainers: trainers.results,
    });
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
      const name = requiredString(payload.name, 'Candidate name');
      const phone = typeof payload.phone === 'string' ? payload.phone.trim() : null;
      const enrolledAt = requiredString(payload.enrolledAt, 'Enrollment date');
      const candidateSerial = serialNumber(payload.serialNumber);
      const year = enrollmentYear(enrolledAt);
      const id = `${candidateSerial}-${String(year).padStart(2, '0')}`;

      await db.prepare(
        'INSERT INTO candidates (id, serial_number, enrollment_year, name, phone, enrolled_at, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      ).bind(id, candidateSerial, year, name, phone || null, enrolledAt, timestamp).run();
      return Response.json({ ok: true, id, serialNumber: candidateSerial, enrollmentYear: year }, { status: 201 });
    }

    if (payload.action === 'session') {
      const candidateId = requiredString(payload.candidateId, 'Candidate ID');
      const sessionDate = requiredString(payload.sessionDate, 'Session date');
      const timeSlot = requiredString(payload.timeSlot, 'Time slot');
      const trainerId = requiredString(payload.trainerId, 'Trainer');
      const status = requiredString(payload.status, 'Status');
      if (!sessionStatuses.has(status)) throw new Error('Session status is not valid.');

      const trainer = await db.prepare('SELECT id, name FROM trainers WHERE id = ? AND is_active = 1').bind(trainerId).first<{ id: string; name: string }>();
      if (!trainer) throw new Error('Select an active trainer from the trainer directory.');

      const id = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO training_sessions (id, candidate_id, session_date, time_slot, status, trainer_id, trainer_name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(id, candidateId, sessionDate, timeSlot, status, trainer.id, trainer.name, typeof payload.notes === 'string' ? payload.notes.trim() : null, timestamp).run();
      return Response.json({ ok: true, id, trainer }, { status: 201 });
    }

    if (payload.action === 'session-status') {
      const id = requiredString(payload.id, 'Session ID');
      const status = requiredString(payload.status, 'Status');
      if (!sessionStatuses.has(status)) throw new Error('Session status is not valid.');
      const result = await db.prepare('UPDATE training_sessions SET status = ? WHERE id = ?').bind(status, id).run();
      if (!result.meta.changes) throw new Error('Training session was not found.');
      return Response.json({ ok: true, id });
    }

    return Response.json({ error: 'Unsupported ERP action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update ERP data.';
    const isDuplicateCandidate = /unique constraint failed: candidates\.id/i.test(message);
    return Response.json({ error: isDuplicateCandidate ? 'This candidate serial number is already in use for that year.' : message }, { status: 400 });
  }
}
