import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userFieldPreference, source } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { QuickwitClient } from 'quickwit-js';
import {
	getFieldPreferenceSchema,
	saveFieldPreferenceSchema,
	deleteFieldPreferenceSchema,
	getIndexFieldsSchema
} from '$lib/schemas/field-preference';
import { requireUser } from '$lib/middleware/auth';
import { normalizeQuickwitUrl } from '$lib/utils';

export const getFieldPreference = command(getFieldPreferenceSchema, async (data) => {
	const user = requireUser();

	// Try per-source first
	if (data.sourceId !== null) {
		const [pref] = await db
			.select()
			.from(userFieldPreference)
			.where(
				and(
					eq(userFieldPreference.userId, user.id),
					eq(userFieldPreference.sourceId, data.sourceId)
				)
			);
		if (pref) return { fields: pref.fields as string[], isOverride: true };
	}

	// Fallback to global default
	const [globalPref] = await db
		.select()
		.from(userFieldPreference)
		.where(
			and(
				eq(userFieldPreference.userId, user.id),
				isNull(userFieldPreference.sourceId)
			)
		);

	return { fields: (globalPref?.fields as string[]) ?? [], isOverride: false };
});

export const saveFieldPreference = command(saveFieldPreferenceSchema, async (data) => {
	const user = requireUser();

	const [result] = await db
		.insert(userFieldPreference)
		.values({
			userId: user.id,
			sourceId: data.sourceId,
			fields: data.fields
		})
		.onConflictDoUpdate({
			target: [userFieldPreference.userId, userFieldPreference.sourceId],
			set: { fields: data.fields, updatedAt: new Date() }
		})
		.returning();
	return result;
});

export const deleteFieldPreference = command(deleteFieldPreferenceSchema, async (data) => {
	const user = requireUser();
	await db
		.delete(userFieldPreference)
		.where(
			and(
				eq(userFieldPreference.userId, user.id),
				eq(userFieldPreference.sourceId, data.sourceId)
			)
		);
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
	): { name: string; type: string }[] {
		const result: { name: string; type: string }[] = [];
		for (const f of mappings) {
			const fullName = prefix ? `${prefix}.${f.name}` : f.name;
			if (f.type === 'object' && f.field_mappings) {
				result.push(...flattenFields(f.field_mappings, fullName));
			} else {
				result.push({ name: fullName, type: f.type });
			}
		}
		return result;
	}

	return flattenFields(fieldMappings);
});
