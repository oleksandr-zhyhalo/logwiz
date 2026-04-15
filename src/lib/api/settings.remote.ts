import { command, getRequestEvent } from '$app/server';
import { requireAdmin } from '$lib/middleware/auth';
import { saveGoogleAuthSettingsSchema } from '$lib/schemas/settings';
import { logger as baseLogger } from '$lib/server/logger';
import * as settingsService from '$lib/server/services/settings.service';

export const removeGoogleAuthSettings = command(async () => {
	const admin = requireAdmin();
	const log = (getRequestEvent().locals.logger ?? baseLogger).child({ userEmail: admin.email });
	settingsService.deleteSetting('google_client_id');
	settingsService.deleteSetting('google_client_secret');
	settingsService.deleteSetting('google_allowed_domains');
	log.info('Google auth settings removed');
});

export const saveGoogleAuthSettings = command(saveGoogleAuthSettingsSchema, async (data) => {
	const admin = requireAdmin();
	const log = (getRequestEvent().locals.logger ?? baseLogger).child({ userEmail: admin.email });

	settingsService.setSetting('google_client_id', data.clientId);

	// Only update secret if a new value was provided
	if (data.clientSecret && data.clientSecret.length > 0) {
		settingsService.setSetting('google_client_secret', data.clientSecret);
	}

	settingsService.setSetting('google_allowed_domains', JSON.stringify(data.allowedDomains));
	log.info({ domainCount: data.allowedDomains.length }, 'Google auth settings saved');
});
