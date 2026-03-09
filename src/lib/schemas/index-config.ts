import * as v from 'valibot';

export const indexNameSchema = v.pipe(v.string(), v.minLength(1));

export const saveIndexConfigSchema = v.object({
	indexName: v.pipe(v.string(), v.minLength(1)),
	levelField: v.optional(v.pipe(v.string(), v.minLength(1)), 'level'),
	timestampField: v.optional(v.pipe(v.string(), v.minLength(1)), 'timestamp'),
	messageField: v.optional(v.pipe(v.string(), v.minLength(1)), 'message')
});
