import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const source = pgTable('source', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	url: text('url').notNull(),
	indexName: text('index_name').notNull(),
	levelField: text('level_field').notNull().default('level'),
	timestampField: text('timestamp_field').notNull().default('timestamp'),
	messageField: text('message_field').notNull().default('message'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export * from './auth.schema';
