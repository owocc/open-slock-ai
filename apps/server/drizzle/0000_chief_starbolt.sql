CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"serverId" text NOT NULL,
	"machineId" text NOT NULL,
	"name" text NOT NULL,
	"displayName" text NOT NULL,
	"runtime" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_serverId_name_unique" UNIQUE("serverId","name"),
	CONSTRAINT "agents_runtime_check" CHECK (runtime IN ('claude', 'opencode'))
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"serverId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_serverId_name_unique" UNIQUE("serverId","name")
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"serverId" text NOT NULL,
	"label" text NOT NULL,
	"keyHash" text NOT NULL,
	"keyPrefix" text NOT NULL,
	"lastSeenAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"channelId" text NOT NULL,
	"parentId" text,
	"senderId" text NOT NULL,
	"senderType" text NOT NULL,
	"content" text NOT NULL,
	"seq" bigserial NOT NULL,
	"mentions" text[] DEFAULT '{}'::text[] NOT NULL,
	"replyTo" text,
	"triggerChainId" text,
	"chainDepth" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_channelId_seq_unique" UNIQUE("channelId","seq"),
	CONSTRAINT "messages_senderType_check" CHECK ("senderType" IN ('human', 'agent', 'system'))
);
--> statement-breakpoint
CREATE TABLE "serverMembers" (
	"serverId" text NOT NULL,
	"userId" text NOT NULL,
	"joinedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serverMembers_serverId_userId_pk" PRIMARY KEY("serverId","userId")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_machineId_machines_id_fk" FOREIGN KEY ("machineId") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channelId_channels_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_parentId_messages_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyTo_messages_id_fk" FOREIGN KEY ("replyTo") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serverMembers" ADD CONSTRAINT "serverMembers_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serverMembers" ADD CONSTRAINT "serverMembers_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_agents_serverId" ON "agents" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "idx_agents_machineId" ON "agents" USING btree ("machineId");--> statement-breakpoint
CREATE INDEX "idx_channels_serverId" ON "channels" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "idx_machines_userId" ON "machines" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_machines_serverId" ON "machines" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "idx_machines_keyHash" ON "machines" USING btree ("keyHash");--> statement-breakpoint
CREATE INDEX "idx_messages_channelId_seq" ON "messages" USING btree ("channelId","seq" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_messages_parentId" ON "messages" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "idx_messages_senderId" ON "messages" USING btree ("senderId");--> statement-breakpoint
CREATE INDEX "idx_messages_replyTo" ON "messages" USING btree ("replyTo");--> statement-breakpoint
CREATE INDEX "idx_serverMembers_userId" ON "serverMembers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_servers_slug" ON "servers" USING btree ("slug");