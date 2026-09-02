CREATE TABLE `admin_login_attempts` (
	`client_hash` text PRIMARY KEY NOT NULL,
	`window_started` integer NOT NULL,
	`failure_count` integer NOT NULL,
	`blocked_until` integer NOT NULL
);
