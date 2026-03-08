import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { source } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { searchLogsSchema, searchFieldValuesSchema } from '$lib/schemas/logs';
import { QuickwitClient, AggregationBuilder } from 'quickwit-js';
import { requireUser } from '$lib/middleware/auth';
import { normalizeQuickwitUrl } from '$lib/utils';
import { TIME_PRESETS } from '$lib/types';

export const searchLogs = command(searchLogsSchema, async (data) => {
	requireUser();

	const [src] = await db.select().from(source).where(eq(source.id, data.sourceId));
	if (!src) {
		error(404, 'Source not found');
	}

	const endpoint = normalizeQuickwitUrl(src.url);
	const client = new QuickwitClient(endpoint);
	const index = client.index(src.indexName);

	let startTs: number | undefined;
	let endTs: number | undefined;

	if (data.startTimestamp !== undefined && data.endTimestamp !== undefined) {
		startTs = data.startTimestamp;
		endTs = data.endTimestamp;
	} else {
		const preset = TIME_PRESETS.find((p) => p.code === data.timeRange);
		if (preset) {
			endTs = Math.floor(Date.now() / 1000);
			startTs = endTs - preset.seconds;
		}
	}

	const query = index
		.query(data.query || '*')
		.limit(data.limit)
		.offset(data.offset)
		.sortBy(`+${src.timestampField}`);

	if (startTs !== undefined && endTs !== undefined) {
		query.timeRange(startTs, endTs);
	}

	// Add aggregations for quick filter fields
	if (data.quickFilterFields?.length) {
		for (const field of data.quickFilterFields) {
			query.agg(field, AggregationBuilder.terms(field, { size: 50 }));
		}
	}

	const result = await index.search(query);

	// Extract aggregation buckets into a simple map
	const aggregations: Record<string, string[]> = {};
	if (result.aggregations) {
		for (const [field, agg] of Object.entries(result.aggregations)) {
			const bucketAgg = agg as { buckets?: { key: string }[] };
			if (bucketAgg.buckets) {
				aggregations[field] = bucketAgg.buckets.map((b) => String(b.key));
			}
		}
	}

	return {
		hits: result.hits,
		numHits: result.num_hits,
		startTimestamp: startTs,
		endTimestamp: endTs,
		aggregations
	};
});

export const searchFieldValues = command(searchFieldValuesSchema, async (data) => {
	requireUser();

	const [src] = await db.select().from(source).where(eq(source.id, data.sourceId));
	if (!src) {
		error(404, 'Source not found');
	}

	const endpoint = normalizeQuickwitUrl(src.url);
	const client = new QuickwitClient(endpoint);
	const index = client.index(src.indexName);

	// Use the base query as-is; we filter aggregation results client-side
	// because wildcard prefix queries fail on non-text fields in Quickwit
	const baseQuery = data.query?.trim();
	const combinedQuery = baseQuery && baseQuery !== '*' ? baseQuery : '*';

	let startTs: number | undefined;
	let endTs: number | undefined;

	if (data.startTimestamp !== undefined && data.endTimestamp !== undefined) {
		startTs = data.startTimestamp;
		endTs = data.endTimestamp;
	} else {
		const preset = TIME_PRESETS.find((p) => p.code === data.timeRange);
		if (preset) {
			endTs = Math.floor(Date.now() / 1000);
			startTs = endTs - preset.seconds;
		}
	}

	const query = index
		.query(combinedQuery)
		.limit(0)
		.agg(data.field, AggregationBuilder.terms(data.field, { size: 50 }));

	if (startTs !== undefined && endTs !== undefined) {
		query.timeRange(startTs, endTs);
	}

	const result = await index.search(query);

	const bucketAgg = result.aggregations?.[data.field] as { buckets?: { key: string }[] } | undefined;
	const searchLower = data.searchTerm.toLowerCase();
	const values = (bucketAgg?.buckets?.map((b) => String(b.key)) ?? [])
		.filter((v) => v.toLowerCase().includes(searchLower));

	return { values };
});
