import * as v from 'valibot';

import type { FieldMappingInput, ScalarFieldInput } from '$lib/types';

const FIELD_NAME = v.pipe(
	v.string(),
	v.minLength(1, 'Field name is required'),
	v.regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Must start with a letter and contain only letters, digits, _'),
	v.check((s) => s !== '_dynamic' && s !== '_source', 'Reserved field name')
);

const COMMON = {
	name: FIELD_NAME,
	stored: v.boolean(),
	indexed: v.boolean(),
	fast: v.boolean(),
	logwizRole: v.optional(v.picklist(['level', 'message', 'traceback'])),
	inContext: v.optional(v.boolean())
};

const TEXT = v.object({
	...COMMON,
	type: v.literal('text'),
	tokenizer: v.optional(
		v.picklist(['raw', 'default', 'en_stem', 'lowercase', 'chinese_compatible'])
	),
	record: v.optional(v.picklist(['basic', 'freq', 'position'])),
	fieldnorms: v.optional(v.boolean())
});

const NUMERIC = v.object({
	...COMMON,
	type: v.picklist(['i64', 'u64', 'f64']),
	coerce: v.optional(v.boolean()),
	output_format: v.optional(v.string())
});

const DATETIME = v.object({
	...COMMON,
	type: v.literal('datetime'),
	input_formats: v.optional(v.array(v.string())),
	fast_precision: v.optional(
		v.picklist(['seconds', 'milliseconds', 'microseconds', 'nanoseconds'])
	),
	output_format: v.optional(v.string())
});

const BOOL = v.object({ ...COMMON, type: v.literal('bool') });
const IP = v.object({ ...COMMON, type: v.literal('ip') });

const BYTES = v.object({
	...COMMON,
	type: v.literal('bytes'),
	input_format: v.optional(v.picklist(['base64', 'hex'])),
	output_format: v.optional(v.picklist(['base64', 'hex']))
});

const JSON_FIELD = v.object({
	...COMMON,
	type: v.literal('json'),
	tokenizer: v.optional(v.picklist(['raw', 'default'])),
	expand_dots: v.optional(v.boolean())
});

const SCALAR = v.variant('type', [TEXT, NUMERIC, DATETIME, BOOL, IP, BYTES, JSON_FIELD]);

const ARRAY = v.object({
	...COMMON,
	type: v.literal('array'),
	inner: SCALAR
});

const FIELD = v.variant('type', [TEXT, NUMERIC, DATETIME, BOOL, IP, BYTES, JSON_FIELD, ARRAY]);

const RETENTION = v.object({
	period: v.pipe(v.string(), v.minLength(1)),
	schedule: v.picklist(['hourly', 'daily', 'weekly', 'monthly', 'yearly'])
});

export const createIndexSchema = v.pipe(
	v.object({
		indexId: v.pipe(
			v.string(),
			v.minLength(1, 'Index ID is required'),
			v.regex(
				/^[a-zA-Z][a-zA-Z0-9_-]*$/,
				'Must start with a letter; letters, digits, _ and - only'
			)
		),
		mode: v.picklist(['dynamic', 'lenient', 'strict']),
		fieldMappings: v.pipe(v.array(FIELD), v.minLength(1, 'Add at least one field')),
		timestampField: v.pipe(v.string(), v.minLength(1, 'Pick a timestamp field')),
		defaultSearchFields: v.array(v.string()),
		retention: v.optional(RETENTION),
		commitTimeoutSecs: v.pipe(v.number(), v.integer(), v.minValue(1)),
		displayName: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
		visibility: v.picklist(['hidden', 'admin', 'all'])
	}),
	v.check(
		(input) => input.fieldMappings.some((f) => effectiveType(f) === 'datetime'),
		'At least one datetime field is required'
	),
	v.check((input) => {
		const names = input.fieldMappings.map((f) => f.name);
		return new Set(names).size === names.length;
	}, 'Field names must be unique'),
	v.check((input) => {
		const ts = input.fieldMappings.find((f) => f.name === input.timestampField);
		return !!ts && ts.type === 'datetime' && ts.fast === true;
	}, 'Timestamp field must reference an existing datetime field with fast=true'),
	v.check((input) => {
		const allowed = new Set(['text', 'json']);
		return input.defaultSearchFields.every((name) => {
			const f = input.fieldMappings.find((m) => m.name === name);
			return f != null && allowed.has(effectiveType(f));
		});
	}, 'Default search fields must reference text or json fields'),
	v.check((input) => {
		const roleHolders = input.fieldMappings.filter((f) => f.logwizRole);
		const roles = roleHolders.map((f) => f.logwizRole);
		if (new Set(roles).size !== roles.length) return false;
		return roleHolders.every((f) => f.type === 'text');
	}, 'Each Logwiz role must be assigned to at most one text field')
);

function effectiveType(f: FieldMappingInput): ScalarFieldInput['type'] {
	return f.type === 'array' ? f.inner.type : f.type;
}
