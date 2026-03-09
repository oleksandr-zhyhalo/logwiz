import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userPreference, source } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { QuickwitClient } from 'quickwit-js';
import {
	getPreferenceSchema,
	saveDisplayFieldsSchema,
	saveQuickFilterFieldsSchema,
	deletePreferenceSchema,
	getIndexFieldsSchema
} from '$lib/schemas/preference';
import { requireUser } from '$lib/middleware/auth';
import { normalizeQuickwitUrl } from '$lib/utils';

export const getPreference = command(getPreferenceSchema, async (data) => {
	const user = requireUser();

	const [pref] = await db
		.select()
		.from(userPreference)
		.where(and(eq(userPreference.userId, user.id), eq(userPreference.sourceId, data.sourceId)));

	return {
		displayFields: (pref?.displayFields as string[]) ?? [],
		quickFilterFields: (pref?.quickFilterFields as string[]) ?? []
	};
});

async function upsertPreference(
	userId: string,
	sourceId: number,
	set: Partial<{ displayFields: string[]; quickFilterFields: string[] }>
) {
	await db
		.insert(userPreference)
		.values({ userId, sourceId, ...set })
		.onConflictDoUpdate({
			target: [userPreference.userId, userPreference.sourceId],
			set: { ...set, updatedAt: new Date() }
		});
}

export const saveDisplayFields = command(saveDisplayFieldsSchema, async (data) => {
	const user = requireUser();
	await upsertPreference(user.id, data.sourceId, { displayFields: data.fields });
});

export const saveQuickFilterFields = command(saveQuickFilterFieldsSchema, async (data) => {
	const user = requireUser();
	await upsertPreference(user.id, data.sourceId, { quickFilterFields: data.fields });
});

export const deletePreference = command(deletePreferenceSchema, async (data) => {
	const user = requireUser();
	await db
		.delete(userPreference)
		.where(and(eq(userPreference.userId, user.id), eq(userPreference.sourceId, data.sourceId)));
});

export const getIndexFields = command(getIndexFieldsSchema, async (data) => {
	requireUser();

	const [src] = await db.select().from(source).where(eq(source.id, data.sourceId));
	if (!src) error(404, 'Source not found');

	const endpoint = normalizeQuickwitUrl(src.url);
	const client = new QuickwitClient(endpoint);
	const metadata = await client.getIndex(src.indexName);

	const fieldMappings = metadata.index_config.doc_mapping.field_mappings;

	function flattenFields(
		mappings: typeof fieldMappings,
		prefix = ''
	): { name: string; type: string; fast: boolean }[] {
		const result: { name: string; type: string; fast: boolean }[] = [];
		for (const f of mappings) {
			const fullName = prefix ? `${prefix}.${f.name}` : f.name;
			if (f.type === 'object' && f.field_mappings) {
				result.push(...flattenFields(f.field_mappings, fullName));
			} else {
				result.push({ name: fullName, type: f.type, fast: f.fast === true });
			}
		}
		return result;
	}

	return flattenFields(fieldMappings);
});
