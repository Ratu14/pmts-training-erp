import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  trainingTarget: integer('training_target').notNull().default(15),
  updatedAt: text('updated_at').notNull(),
});

export const candidates = sqliteTable('candidates', {
  id: text('id').primaryKey(),
  serialNumber: integer('serial_number'),
  enrollmentYear: integer('enrollment_year'),
  name: text('name').notNull(),
  phone: text('phone'),
  enrolledAt: text('enrolled_at').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_candidates_serial_year').on(table.serialNumber, table.enrollmentYear),
]);

export const trainers = sqliteTable('trainers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const trainingSessions = sqliteTable(
  'training_sessions',
  {
    id: text('id').primaryKey(),
    candidateId: text('candidate_id').notNull().references(() => candidates.id),
    sessionDate: text('session_date').notNull(),
    timeSlot: text('time_slot').notNull(),
    status: text('status').notNull().default('Scheduled'),
    trainerId: text('trainer_id').references(() => trainers.id),
    trainerName: text('trainer_name'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_training_sessions_candidate_status_date').on(table.candidateId, table.status, table.sessionDate),
    index('idx_training_sessions_date_slot').on(table.sessionDate, table.timeSlot),
  ],
);
