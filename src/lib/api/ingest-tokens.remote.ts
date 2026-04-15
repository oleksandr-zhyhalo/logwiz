import { error } from '@sveltejs/kit';

import { command, getRequestEvent } from '$app/server';
import { requireAdmin } from '$lib/middleware/auth';
import { createIngestTokenSchema, deleteIngestTokenSchema } from '$lib/schemas/ingest-tokens';
import { logger as baseLogger } from '$lib/server/logger';
import * as ingestTokenService from '$lib/server/services/ingest-token.service';

export const createIngestToken = command(createIngestTokenSchema, async (data) => {
	const admin = requireAdmin();
	const log = (getRequestEvent().locals.logger ?? baseLogger).child({ userEmail: admin.email });
	try {
		const result = ingestTokenService.createIngestToken(admin.id, data);
		log.info({ tokenId: result.summary.id, creatorUserId: admin.id }, 'ingest token created');
		return result;
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to create ingest token');
	}
});

export const deleteIngestToken = command(deleteIngestTokenSchema, async (data) => {
	const admin = requireAdmin();
	const log = (getRequestEvent().locals.logger ?? baseLogger).child({ userEmail: admin.email });
	try {
		ingestTokenService.deleteIngestToken(data.tokenId);
		log.info({ tokenId: data.tokenId }, 'ingest token deleted');
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to delete ingest token');
	}
});
