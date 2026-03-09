import { pgTable, serial, integer, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

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

export const userPreference = pgTable(
	'user_preference',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		sourceId: integer('source_id').references(() => source.id, { onDelete: 'cascade' }),
		displayFields: jsonb('display_fields').$type<string[]>(),
		quickFilterFields: jsonb('quick_filter_fields').$type<string[]>(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [unique('user_preference_unique').on(table.userId, table.sourceId)]
);

export * from './auth.schema';
