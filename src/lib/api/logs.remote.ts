import { command } from '$app/server';
import { db } from '$lib/server/db';
import { indexConfig } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { searchLogsSchema, searchFieldValuesSchema } from '$lib/schemas/logs';
import { AggregationBuilder } from 'quickwit-js';
import { requireUser } from '$lib/middleware/auth';
import { getQuickwitClient } from '$lib/server/quickwit';
import { TIME_PRESETS } from '$lib/types';

async function resolveFieldConfig(indexName: string) {
	const [config] = await db
		.select()
		.from(indexConfig)
		.where(eq(indexConfig.indexName, indexName));

	return {
		levelField: config?.levelField ?? 'level',
		timestampField: config?.timestampField ?? 'timestamp',
		messageField: config?.messageField ?? 'message'
	};
}

export const searchLogs = command(searchLogsSchema, async (data) => {
	requireUser();

	const fields = await resolveFieldConfig(data.indexName);
	const client = getQuickwitClient();
	const index = client.index(data.indexName);

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
		.sortBy(`+${fields.timestampField}`);

	if (startTs !== undefined && endTs !== undefined) {
		query.timeRange(startTs, endTs);
	}

	if (data.quickFilterFields?.length) {
		for (const field of data.quickFilterFields) {
			query.agg(field, AggregationBuilder.terms(field, { size: 50 }));
		}
	}

	const result = await index.search(query);

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

	const client = getQuickwitClient();
	const index = client.index(data.indexName);

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

	const bucketAgg = result.aggregations?.[data.field] as
		| { buckets?: { key: string }[] }
		| undefined;
	const searchLower = data.searchTerm.toLowerCase();
	const values = (bucketAgg?.buckets?.map((b) => String(b.key)) ?? []).filter((v) =>
		v.toLowerCase().includes(searchLower)
	);

	return { values };
});
