import * as v from 'valibot';

export const searchLogsSchema = v.object({
	sourceId: v.pipe(v.number(), v.integer(), v.minValue(1)),
	query: v.string(),
	timeRange: v.picklist(['15m', '1h', '6h', '24h', '7d']),
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)),
	startTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	endTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
});

export type SearchLogsInput = v.InferOutput<typeof searchLogsSchema>;
