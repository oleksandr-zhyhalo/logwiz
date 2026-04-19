import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';
import { config } from '$lib/server/config';
import { hasIngestTokenForIndex } from '$lib/server/services/ingest-token.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { count } = hasIngestTokenForIndex(DEFAULT_OTEL_LOGS_INDEX_ID);
	return {
		origin: config.origin || event.url.origin,
		hasToken: count > 0
	};
};
