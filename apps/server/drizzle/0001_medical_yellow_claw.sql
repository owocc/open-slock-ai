CREATE TABLE "channelGroups" (
	"id" text PRIMARY KEY NOT NULL,
	"serverId" text NOT NULL,
	"name" text NOT NULL,
	"sortIndex" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channelGroups_serverId_name_unique" UNIQUE("serverId","name")
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "groupId" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "isArchived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "sortIndex" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channelGroups" ADD CONSTRAINT "channelGroups_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_channelGroups_serverId" ON "channelGroups" USING btree ("serverId");--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_groupId_channelGroups_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."channelGroups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_channels_groupId" ON "channels" USING btree ("groupId");