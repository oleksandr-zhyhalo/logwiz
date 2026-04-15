import { json, type RequestHandler } from '@sveltejs/kit';
import type pino from 'pino';
import { AggregationBuilder } from 'quickwit-js';
import * as v from 'valibot';

import { exportLogsSchema } from '$lib/schemas/export';
import { createOperationLogger, logger as baseLogger } from '$lib/server/logger';
import { getQuickwitClient } from '$lib/server/quickwit';
import {
	EXPORT_BATCH_SIZE,
	EXPORT_MAX_LOGS,
	exportManager
} from '$lib/server/services/export.service';
import { assertIndexAccess, getFieldConfig } from '$lib/server/services/index.service';

async function runExportJob(
	exportLogger: pino.Logger,
	exportId: string,
	data: v.InferOutput<typeof exportLogsSchema>,
	timestampField: string,
	levelField: string,
	messageField: string
): Promise<void> {
	const start = performance.now();
	try {
		const client = getQuickwitClient();
		const index = client.index(data.indexId);

		let currentOffset = 0;
		let totalFetched = 0;

		while (totalFetched < EXPORT_MAX_LOGS) {
			const remaining = EXPORT_MAX_LOGS - totalFetched;
			const batchLimit = Math.min(EXPORT_BATCH_SIZE, remaining);

			// Adding an aggregation forces quickwit-js to use POST instead of GET.
			// Quickwit's GET search endpoint rejects certain query parameter combinations.
			const query = index
				.query(data.query || '*')
				.limit(batchLimit)
				.offset(currentOffset)
				.sortBy(timestampField, 'desc')
				.agg('_export', AggregationBuilder.terms(timestampField, { size: 1 }));

			query.timeRange(data.startTimestamp, data.endTimestamp);

			const result = await index.search(query);
			const hits = result.hits as Record<string, unknown>[];

			if (hits.length === 0) break;

			exportManager.appendLogs(exportId, hits);
			totalFetched += hits.length;
			currentOffset += hits.length;

			if (hits.length < batchLimit) break;
		}

		await exportManager.finalize(exportId, timestampField, levelField, messageField);
		const durationMs = Math.round(performance.now() - start);
		exportLogger.info({ exportId, rowCount: totalFetched, durationMs }, 'export completed');
	} catch (e) {
		const durationMs = Math.round(performance.now() - start);
		const message = e instanceof Error ? e.message : 'Unknown export error';
		exportManager.setError(exportId, message);
		exportLogger.error({ exportId, durationMs, err: e }, 'export failed');
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid JSON body' }, { status: 400 });
	}

	const parsed = v.safeParse(exportLogsSchema, body);
	if (!parsed.success) {
		return json({ message: 'Invalid request' }, { status: 400 });
	}

	const data = parsed.output;
	const log = locals.logger ?? baseLogger;
	assertIndexAccess(data.indexId, locals.user.role);
	const fieldConfig = getFieldConfig(data.indexId);

	const client = getQuickwitClient();
	const index = client.index(data.indexId);

	let total: number;
	try {
		const countQuery = index
			.query(data.query || '*')
			.limit(0)
			.countAll()
			.agg('_count', AggregationBuilder.terms(fieldConfig.timestampField, { size: 1 }));
		countQuery.timeRange(data.startTimestamp, data.endTimestamp);
		const countResult = await index.search(countQuery);
		total = (countResult.num_hits as number) ?? 0;
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Query failed';
		return json({ message }, { status: 400 });
	}

	const timestamp = new Date()
		.toISOString()
		.replace(/\.\d{3}Z$/, 'Z')
		.replace(/:/g, '-');
	const filename = `logwiz-${data.indexId}-${timestamp}.${data.format}.gz`;

	const exportId = exportManager.create({
		format: data.format,
		total,
		filename,
		userId: locals.user.id
	});

	log.info({ exportId, indexId: data.indexId, format: data.format, query: data.query, total }, 'export requested');

	const exportLogger = createOperationLogger(log, {
		operation: 'export',
		exportId,
		indexId: data.indexId
	});

	runExportJob(
		exportLogger,
		exportId,
		data,
		fieldConfig.timestampField,
		fieldConfig.levelField,
		fieldConfig.messageField
	);

	return json({ exportId });
};
