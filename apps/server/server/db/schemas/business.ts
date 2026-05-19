import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  unique,
  check,
  primaryKey,
  integer,
  bigserial,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth-schema";

export const servers = pgTable(
  "servers",
  {
    id: text("id").primaryKey(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_servers_slug").on(table.slug)],
);

export const serverMembers = pgTable(
  "serverMembers",
  {
    serverId: text("serverId")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joinedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serverId, table.userId] }),
    index("idx_serverMembers_userId").on(table.userId),
  ],
);

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),
    serverId: text("serverId")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_channels_serverId").on(table.serverId),
    unique("channels_serverId_name_unique").on(table.serverId, table.name),
  ],
);

export const machines = pgTable(
  "machines",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    serverId: text("serverId")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    keyHash: text("keyHash").notNull(),
    keyPrefix: text("keyPrefix").notNull(),
    lastSeenAt: timestamp("lastSeenAt", { withTimezone: true }),
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_machines_userId").on(table.userId),
    index("idx_machines_serverId").on(table.serverId),
    index("idx_machines_keyHash").on(table.keyHash),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    serverId: text("serverId")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    machineId: text("machineId")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    displayName: text("displayName").notNull(),
    runtime: text("runtime").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_agents_serverId").on(table.serverId),
    index("idx_agents_machineId").on(table.machineId),
    unique("agents_serverId_name_unique").on(table.serverId, table.name),
    check("agents_runtime_check", sql`${sql.raw("runtime")} IN ('claude', 'opencode')`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channelId")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    parentId: text("parentId").references((): any => messages.id, { onDelete: "cascade" }),
    senderId: text("senderId").notNull(),
    senderType: text("senderType").notNull(),
    content: text("content").notNull(),
    seq: bigserial("seq", { mode: "number" }),
    mentions: text("mentions")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    replyTo: text("replyTo").references((): any => messages.id, { onDelete: "set null" }),
    triggerChainId: text("triggerChainId"),
    chainDepth: integer("chainDepth").notNull().default(0),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_messages_channelId_seq").on(table.channelId, table.seq.desc()),
    index("idx_messages_parentId").on(table.parentId),
    index("idx_messages_senderId").on(table.senderId),
    index("idx_messages_replyTo").on(table.replyTo),
    unique("messages_channelId_seq_unique").on(table.channelId, table.seq),
    check(
      "messages_senderType_check",
      sql`${sql.raw('"senderType"')} IN ('human', 'agent', 'system')`,
    ),
  ],
);

// Relationships
export const serversRelations = relations(servers, ({ many }) => ({
  members: many(serverMembers),
  channels: many(channels),
  machines: many(machines),
  agents: many(agents),
}));

export const serverMembersRelations = relations(serverMembers, ({ one }) => ({
  server: one(servers, {
    fields: [serverMembers.serverId],
    references: [servers.id],
  }),
  user: one(user, {
    fields: [serverMembers.userId],
    references: [user.id],
  }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
  messages: many(messages),
}));

export const machinesRelations = relations(machines, ({ one, many }) => ({
  user: one(user, {
    fields: [machines.userId],
    references: [user.id],
  }),
  server: one(servers, {
    fields: [machines.serverId],
    references: [servers.id],
  }),
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one }) => ({
  server: one(servers, {
    fields: [agents.serverId],
    references: [servers.id],
  }),
  machine: one(machines, {
    fields: [agents.machineId],
    references: [machines.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  parent: one(messages, {
    fields: [messages.parentId],
    references: [messages.id],
    relationName: "thread",
  }),
  replyToMessage: one(messages, {
    fields: [messages.replyTo],
    references: [messages.id],
    relationName: "reply",
  }),
}));
