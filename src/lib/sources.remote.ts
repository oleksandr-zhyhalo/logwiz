import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { source } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
	sourceSchema,
	sourceIdSchema,
	updateSourceSchema,
	testConnectionSchema
} from '$lib/schemas/source';

function requireAuth() {
	const event = getRequestEvent();
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}
}

export const getSources = query(async () => {
	requireAuth();
	return db.select().from(source).orderBy(desc(source.createdAt));
});

export const createSource = command(sourceSchema, async (data) => {
	requireAuth();
	const [created] = await db.insert(source).values(data).returning();
	await getSources().refresh();
	return created;
});

export const updateSource = command(updateSourceSchema, async (data) => {
	requireAuth();
	const { id, ...values } = data;
	const [updated] = await db
		.update(source)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(source.id, id))
		.returning();
	if (!updated) error(404, 'Source not found');
	await getSources().refresh();
	return updated;
});

export const deleteSource = command(sourceIdSchema, async (id) => {
	requireAuth();
	const [deleted] = await db.delete(source).where(eq(source.id, id)).returning();
	if (!deleted) error(404, 'Source not found');
	await getSources().refresh();
	return deleted;
});

export const testSourceConnection = command(testConnectionSchema, async (data) => {
	requireAuth();
	try {
		const url = new URL(data.url);
		const response = await fetch(`${url.origin}${url.pathname.replace(/\/$/, '')}/indexes/${data.indexName}`);
		if (!response.ok) {
			const text = await response.text();
			return { success: false as const, error: `HTTP ${response.status}: ${text}` };
		}
		return { success: true as const };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Connection failed'
		};
	}
});
