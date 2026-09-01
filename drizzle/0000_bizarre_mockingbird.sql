CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`enrolled_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`training_target` integer DEFAULT 15 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`session_date` text NOT NULL,
	`time_slot` text NOT NULL,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`trainer_name` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_training_sessions_candidate_status_date` ON `training_sessions` (`candidate_id`,`status`,`session_date`);--> statement-breakpoint
CREATE INDEX `idx_training_sessions_date_slot` ON `training_sessions` (`session_date`,`time_slot`);