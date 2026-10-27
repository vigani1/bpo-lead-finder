CREATE TABLE "centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"domain" text,
	"website_url" text,
	"website_status" text DEFAULT 'none' NOT NULL,
	"phones" text[] DEFAULT '{}'::text[] NOT NULL,
	"emails" text[] DEFAULT '{}'::text[] NOT NULL,
	"country" text,
	"country_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text,
	"social_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classification_cache" (
	"content_hash" text NOT NULL,
	"classifier" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classification_cache_content_hash_classifier_pk" PRIMARY KEY("content_hash","classifier")
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"search_id" uuid,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"campaign_role" text,
	"quote" text NOT NULL,
	"match_type" text NOT NULL,
	"source_url" text NOT NULL,
	"source" text NOT NULL,
	"merge_rule" text NOT NULL,
	"classifier" text NOT NULL,
	"posted_at" timestamp with time zone,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"search_id" uuid,
	"verdict" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_cache" (
	"url" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"title" text,
	"text" text,
	"content_hash" text,
	"extracted" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ruled_out" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"reason" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_results" (
	"search_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"fit_score" integer NOT NULL,
	"label" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"from_earlier_search" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_results_search_id_center_id_pk" PRIMARY KEY("search_id","center_id")
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" text NOT NULL,
	"market" text NOT NULL,
	"campaign" text NOT NULL,
	"depth" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" jsonb NOT NULL,
	"error" text,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_center_id_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_center_id_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruled_out" ADD CONSTRAINT "ruled_out_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_center_id_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "centers_domain_idx" ON "centers" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "centers_name_trgm_idx" ON "centers" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "centers_phones_idx" ON "centers" USING gin ("phones");--> statement-breakpoint
CREATE INDEX "evidence_center_idx" ON "evidence" USING btree ("center_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_dedupe_idx" ON "evidence" USING btree ("center_id","kind","value","source_url","quote");--> statement-breakpoint
CREATE INDEX "feedback_center_idx" ON "feedback" USING btree ("center_id");--> statement-breakpoint
CREATE INDEX "ruled_out_search_idx" ON "ruled_out" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "search_results_score_idx" ON "search_results" USING btree ("search_id","fit_score");--> statement-breakpoint
CREATE INDEX "searches_filters_idx" ON "searches" USING btree ("country","market","campaign","depth","created_at");--> statement-breakpoint
CREATE INDEX "searches_ip_idx" ON "searches" USING btree ("ip_hash","created_at");