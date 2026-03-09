import * as v from 'valibot';

const indexNameField = v.pipe(v.string(), v.minLength(1));

export const getPreferenceSchema = v.object({
	indexName: indexNameField
});

export const saveDisplayFieldsSchema = v.object({
	indexName: indexNameField,
	fields: v.array(v.string())
});

export const saveQuickFilterFieldsSchema = v.object({
	indexName: indexNameField,
	fields: v.array(v.string())
});

export const getIndexFieldsSchema = v.object({
	indexName: indexNameField
});
