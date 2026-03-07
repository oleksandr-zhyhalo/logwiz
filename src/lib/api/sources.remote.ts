import { query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { source } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { QuickwitClient } from 'quickwit-js';
import {
	sourceSchema,
	sourceIdSchema,
	updateSourceSchema,
	testConnectionSchema
} from '$lib/schemas/source';
import { requireUser } from '$lib/middleware/auth';
import { normalizeQuickwitUrl } from '$lib/utils';

export const getSources = query(async () => {
	requireUser();
	return db.select().from(source).orderBy(desc(source.createdAt));
});

export const createSource = command(sourceSchema, async (data) => {
	requireUser();
	const [created] = await db.insert(source).values(data).returning();
	await getSources().refresh();
	return created;
});

export const updateSource = command(updateSourceSchema, async (data) => {
	requireUser();
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
	requireUser();
	const [deleted] = await db.delete(source).where(eq(source.id, id)).returning();
	if (!deleted) error(404, 'Source not found');
	await getSources().refresh();
	return deleted;
});

export const testSourceConnection = command(testConnectionSchema, async (data) => {
	requireUser();
	try {
		const endpoint = normalizeQuickwitUrl(data.url);
		const client = new QuickwitClient(endpoint);
		await client.getIndex(data.indexName);
		return { success: true as const };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Connection failed'
		};
	}
});
