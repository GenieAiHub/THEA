import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

/**
 * Ask THEA — persisted AI analyst chat conversations.
 * One conversation belongs to a single user within a single org; all
 * retrieval-augmented answers inside it are grounded in that org's data only.
 */
export const chatConversationsTable = pgTable("chat_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("chat_conversations_org_user_idx").on(table.orgId, table.userId, table.updatedAt),
]);

/**
 * Individual messages within an Ask THEA conversation.
 * Assistant messages carry a citations array (jsonb) mapping [S1]..[Sn]
 * markers in the answer text back to the underlying source records.
 */
export const chatMessagesTable = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => chatConversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  citations: jsonb("citations").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("chat_messages_conversation_idx").on(table.conversationId, table.createdAt),
]);

export const insertChatConversationSchema = createInsertSchema(chatConversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectChatConversationSchema = createSelectSchema(chatConversationsTable);
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversationsTable.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export const selectChatMessageSchema = createSelectSchema(chatMessagesTable);
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
