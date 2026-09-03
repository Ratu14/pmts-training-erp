export const defaultTimeSlots = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '15:30', '16:00',
];

export function parseTimeSlots(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return defaultTimeSlots;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((slot) => typeof slot === 'string')) {
      return parsed;
    }
  } catch {
    // fall through to default
  }
  return defaultTimeSlots;
}

const TIME_SLOT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeTimeSlots(input: unknown) {
  if (!Array.isArray(input)) throw new Error('Time slots must be a list.');
  if (input.length > 40) throw new Error('Too many time slots.');
  const unique = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string' || !TIME_SLOT_PATTERN.test(item)) {
      throw new Error('Each time slot must use HH:MM (24-hour) format.');
    }
    unique.add(item);
  }
  return Array.from(unique).sort();
}
