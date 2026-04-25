import type {
	CreateIndexRequest,
	FastFieldConfig,
	FieldMapping,
	IndexMetadata
} from 'quickwit-js';
import { NotFoundError } from 'quickwit-js';

import { quickwitClient } from '$lib/server/quickwit';
import type {
	CreateIndexInput,
	FieldMappingInput,
	QuickwitField,
	QuickwitIndexMetadata,
	QuickwitSource,
	ScalarFieldInput
} from '$lib/types';

// Tri-state: null = unset, true = on (boolean true OR { normalizer }), false = explicitly off.
// The null case lets downstream rules treat unset differently from explicit false.
function normalizeFast(value: FastFieldConfig | undefined): boolean | null {
	if (value === undefined) return null;
	return value !== false;
}

function flattenFieldMappings(mappings: FieldMapping[], prefix = ''): QuickwitField[] {
	const result: QuickwitField[] = [];
	for (const f of mappings) {
		const fullName = prefix ? `${prefix}.${f.name}` : f.name;
		if (f.type === 'object' && f.field_mappings) {
			result.push(...flattenFieldMappings(f.field_mappings, fullName));
		} else {
			result.push({
				name: fullName,
				type: f.type,
				fast: normalizeFast(f.fast),
				indexed: f.indexed ?? null,
				stored: f.stored ?? null,
				record: f.record ?? null,
				tokenizer: f.tokenizer ?? null,
				description: f.description ?? null
			});
		}
	}
	return result;
}

function normalize(meta: IndexMetadata): QuickwitIndexMetadata {
	const cfg = meta.index_config;
	const doc = cfg.doc_mapping;
	const sources: QuickwitSource[] = (meta.sources ?? []).map((s) => ({
		sourceId: s.source_id,
		sourceType: s.source_type,
		enabled: s.enabled ?? true,
		inputFormat: s.input_format ?? null,
		numPipelines: s.num_pipelines ?? null,
		params: s.params ?? null
	}));

	return {
		indexId: cfg.index_id,
		indexUid: meta.index_uid ?? null,
		indexUri: cfg.index_uri ?? null,
		version: cfg.version ?? null,
		createTimestamp: meta.create_timestamp ?? null,
		mode: doc.mode ?? null,
		timestampField: doc.timestamp_field ?? null,
		indexFieldPresence: doc.index_field_presence ?? null,
		storeSource: doc.store_source ?? null,
		storeDocumentSize: doc.store_document_size ?? null,
		tagFields: doc.tag_fields ?? null,
		defaultSearchFields: cfg.search_settings?.default_search_fields ?? null,
		retention: cfg.retention ?? null,
		fields: flattenFieldMappings(doc.field_mappings ?? []),
		sources
	};
}

export async function listIndexes(): Promise<QuickwitIndexMetadata[]> {
	const all = await quickwitClient.listIndexes();
	return all.map(normalize);
}

export async function listIndexIdsAndUris(): Promise<
	{ indexId: string; indexUri: string | null }[]
> {
	const all = await quickwitClient.listIndexes();
	return all.map((m) => ({
		indexId: m.index_config.index_id,
		indexUri: m.index_config.index_uri ?? null
	}));
}

function countFieldLeaves(mappings: FieldMapping[]): number {
	let n = 0;
	for (const f of mappings) {
		n += f.type === 'object' && f.field_mappings ? countFieldLeaves(f.field_mappings) : 1;
	}
	return n;
}

export async function listIndexSummaries() {
	const all = await quickwitClient.listIndexes();
	return all.map((m) => ({
		indexId: m.index_config.index_id,
		mode: m.index_config.doc_mapping.mode ?? null,
		createTimestamp: m.create_timestamp ?? null,
		fieldCount: countFieldLeaves(m.index_config.doc_mapping.field_mappings ?? []),
		sourceCount: (m.sources ?? []).length
	}));
}

export async function getIndex(indexId: string): Promise<QuickwitIndexMetadata | null> {
	try {
		return normalize(await quickwitClient.getIndex(indexId));
	} catch (e) {
		if (e instanceof NotFoundError) return null;
		throw e;
	}
}

function toFieldMapping(f: FieldMappingInput): FieldMapping {
	if (f.type === 'array') {
		const inner = toScalarFieldMapping(f.inner);
		const { type: innerType, ...innerRest } = stripName(inner);
		return {
			name: f.name,
			...innerRest,
			stored: f.stored,
			indexed: f.indexed,
			fast: f.fast,
			type: `array<${innerType}>` as FieldMapping['type']
		};
	}
	return toScalarFieldMapping(f);
}

function toScalarFieldMapping(f: ScalarFieldInput): FieldMapping {
	const base = {
		name: f.name,
		type: f.type,
		stored: f.stored,
		indexed: f.indexed,
		fast: f.fast
	};
	switch (f.type) {
		case 'text':
			return {
				...base,
				...(f.tokenizer && { tokenizer: f.tokenizer }),
				...(f.record && { record: f.record }),
				...(f.fieldnorms !== undefined && { fieldnorms: f.fieldnorms })
			};
		case 'datetime':
			return {
				...base,
				...(f.input_formats && { input_formats: f.input_formats }),
				...(f.fast_precision && { fast_precision: f.fast_precision }),
				...(f.output_format && { output_format: f.output_format })
			};
		case 'bytes':
			return {
				...base,
				...(f.input_format && { input_format: f.input_format }),
				...(f.output_format && { output_format: f.output_format })
			};
		case 'json':
			return {
				...base,
				...(f.tokenizer && { tokenizer: f.tokenizer }),
				...(f.expand_dots !== undefined
					? ({ expand_dots: f.expand_dots } as Record<string, unknown>)
					: {})
			};
		case 'i64':
		case 'u64':
		case 'f64':
			return {
				...base,
				...(f.coerce !== undefined ? ({ coerce: f.coerce } as Record<string, unknown>) : {}),
				...(f.output_format && { output_format: f.output_format })
			};
		default:
			return base;
	}
}

function stripName<T extends { name: string }>(o: T): Omit<T, 'name'> {
	const { name: _name, ...rest } = o;
	return rest;
}

export function toCreateIndexRequest(input: CreateIndexInput): CreateIndexRequest {
	const request: CreateIndexRequest = {
		version: '0.9',
		index_id: input.indexId,
		doc_mapping: {
			mode: input.mode,
			field_mappings: input.fieldMappings.map(toFieldMapping),
			timestamp_field: input.timestampField
		},
		indexing_settings: {
			commit_timeout_secs: input.commitTimeoutSecs
		}
	};
	if (input.defaultSearchFields.length > 0) {
		request.search_settings = { default_search_fields: input.defaultSearchFields };
	}
	if (input.retention) {
		request.retention = {
			period: input.retention.period,
			schedule: input.retention.schedule
		};
	}
	return request;
}

export async function createIndex(input: CreateIndexInput): Promise<IndexMetadata> {
	return quickwitClient.createIndex(toCreateIndexRequest(input));
}

export async function deleteIndexNoThrow(indexId: string): Promise<void> {
	try {
		await quickwitClient.deleteIndex(indexId);
	} catch {
		// Best-effort rollback; the original error from caller is what surfaces to the user.
	}
}
