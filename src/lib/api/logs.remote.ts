import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { source } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { searchLogsSchema } from '$lib/schemas/logs';
import { QuickwitClient } from 'quickwit-js';
import { requireUser } from '$lib/middleware/auth';
import { normalizeQuickwitUrl } from '$lib/utils';

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
	} else if (data.timeRange !== 'all') {
		endTs = Math.floor(Date.now() / 1000);
		const rangeSeconds: Record<string, number> = {
			'15m': 15 * 60,
			'1h': 60 * 60,
			'6h': 6 * 60 * 60,
			'24h': 24 * 60 * 60,
			'7d': 7 * 24 * 60 * 60
		};
		startTs = endTs - (rangeSeconds[data.timeRange] ?? 900);
	}

	const query = index
		.query(data.query || '*')
		.limit(data.limit)
		.offset(data.offset)
		.sortBy(`+${src.timestampField}`);

	if (startTs !== undefined && endTs !== undefined) {
		query.timeRange(startTs, endTs);
	}

	const result = await index.search(query);

	return {
		hits: result.hits,
		numHits: result.num_hits,
		startTimestamp: startTs,
		endTimestamp: endTs
	};
});
