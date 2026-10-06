CREATE TABLE `truck_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`visitor_key` text NOT NULL,
	`intent` text NOT NULL,
	`contact_type` text NOT NULL,
	`contact_value` text NOT NULL,
	`consent` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_truck_requests_request_key` ON `truck_requests` (`request_key`);--> statement-breakpoint
CREATE TABLE `submission_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submission_limits_bucket` ON `submission_limits` (`bucket`);--> statement-breakpoint
CREATE TABLE `truck_sightings` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`visitor_key` text NOT NULL,
	`object_key` text NOT NULL,
	`view_key` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_truck_sightings_request_key` ON `truck_sightings` (`request_key`);--> statement-breakpoint
CREATE TABLE `visitor_signals` (
	`visitor_key` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`visitor_key`, `kind`)
);
