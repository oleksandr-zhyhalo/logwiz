import { command, getRequestEvent, query } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import {
	searchFieldValuesSchema,
	searchLogHistogramSchema,
	searchLogsSchema
} from '$lib/schemas/logs';
import { logger as baseLogger } from '$lib/server/logger';
import * as indexService from '$lib/server/services/index.service';
import * as logService from '$lib/server/services/log.service';

export const searchLogs = command(searchLogsSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	const log = (getRequestEvent().locals.logger ?? baseLogger).child({ userEmail: user.email });
	const start = performance.now();
	const result = await logService.searchLogs(data);
	const durationMs = Math.round(performance.now() - start);
	log.info({ indexId: data.indexId, query: data.query, hitCount: result.numHits, durationMs }, 'search executed');
	return result;
});

export const searchFieldValues = query(searchFieldValuesSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return logService.searchFieldValues(data);
});

export const searchLogHistogram = command(searchLogHistogramSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return logService.searchLogHistogram(data);
});
