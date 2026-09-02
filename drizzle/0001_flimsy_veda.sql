CREATE TABLE `trainers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trainers_name_unique` ON `trainers` (`name`);--> statement-breakpoint
ALTER TABLE `candidates` ADD `serial_number` integer;--> statement-breakpoint
ALTER TABLE `candidates` ADD `enrollment_year` integer;--> statement-breakpoint
CREATE INDEX `idx_candidates_serial_year` ON `candidates` (`serial_number`,`enrollment_year`);--> statement-breakpoint
ALTER TABLE `training_sessions` ADD `trainer_id` text REFERENCES trainers(id);