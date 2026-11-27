CREATE TABLE `ade_voice_host` (
	`id` integer PRIMARY KEY NOT NULL,
	`peer` text NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ade_voice_job` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`peer` text NOT NULL,
	`payload` text NOT NULL,
	`state` text NOT NULL,
	`expires` integer NOT NULL
);
