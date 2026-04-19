import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const endpointUrl = `${origin}/api/ingest/${DEFAULT_OTEL_LOGS_INDEX_ID}`;
	const curl = `curl -X POST ${endpointUrl} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from my app", "level": "info"}'`;

	return {
		endpointUrl,
		snippets: {
			curl: {
				code: curl,
				html: await highlightCode(curl, 'bash'),
				lang: 'bash'
			}
		}
	};
};
