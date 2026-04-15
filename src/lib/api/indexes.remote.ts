import { form, getRequestEvent, query } from '$app/server';
import { requireAdmin, requireUser } from '$lib/middleware/auth';
import { indexIdSchema, saveIndexConfigSchema } from '$lib/schemas/index-config';
import { getIndexFieldsSchema } from '$lib/schemas/preference';
import { logger as baseLogger } from '$lib/server/logger';
import * as indexService from '$lib/server/services/index.service';

export const getIndexFields = query(getIndexFieldsSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return indexService.getIndexFields(data.indexId);
});

export const getIndexConfig = query(indexIdSchema, async ({ indexId }) => {
	const user = requireUser();
	indexService.assertIndexAccess(indexId, user.role);
	return indexService.getIndexConfig(indexId);
});

export const saveIndexConfig = form(saveIndexConfigSchema, async ({ indexId, ...fields }) => {
	const admin = requireAdmin();
	await indexService.saveIndexConfig(indexId, fields);
	const log = (getRequestEvent().locals.logger ?? baseLogger).child({ userEmail: admin.email });
	log.info({ indexId }, 'index configuration saved');
});
