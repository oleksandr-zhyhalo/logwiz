import { requireAdmin } from '$lib/middleware/auth';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	requireAdmin();
	return {};
};
