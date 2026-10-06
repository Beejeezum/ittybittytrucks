CREATE TABLE `site_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`started_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`referrer_host` text DEFAULT '' NOT NULL,
	`device` text DEFAULT 'unknown' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_site_visits_started_at` ON `site_visits` (`started_at`);--> statement-breakpoint
CREATE INDEX `idx_site_visits_last_seen_at` ON `site_visits` (`last_seen_at`);