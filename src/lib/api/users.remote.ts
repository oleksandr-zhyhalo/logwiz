import { error } from '@sveltejs/kit';

import { command, getRequestEvent } from '$app/server';
import { requireAdmin } from '$lib/middleware/auth';
import {
	createInviteSchema,
	regenerateInviteSchema,
	removeUserSchema,
	resetPasswordSchema,
	setUserRoleSchema
} from '$lib/schemas/users';
import { logger as baseLogger } from '$lib/server/logger';
import * as userService from '$lib/server/services/user.service';

export const createInvite = command(createInviteSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	const log = (event.locals.logger ?? baseLogger).child({ userEmail: admin.email });
	try {
		const result = await userService.createInvite(log, event.request.headers, data, event.url.origin);
		return result;
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to create user');
	}
});

export const regenerateInvite = command(regenerateInviteSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	const log = (event.locals.logger ?? baseLogger).child({ userEmail: admin.email });
	try {
		return await userService.regenerateInvite(log, data.userId, event.url.origin);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to regenerate invite');
	}
});

export const removeUser = command(removeUserSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	const log = (event.locals.logger ?? baseLogger).child({ userEmail: admin.email });
	try {
		await userService.removeUser(log, event.request.headers, admin.id, data.userId);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to remove user');
	}
});

export const setUserRole = command(setUserRoleSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	const log = (event.locals.logger ?? baseLogger).child({ userEmail: admin.email });
	try {
		await userService.setUserRole(log, event.request.headers, admin.id, data.userId, data.role);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to change role');
	}
});

export const resetPassword = command(resetPasswordSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	const log = (event.locals.logger ?? baseLogger).child({ userEmail: admin.email });
	try {
		return await userService.resetPassword(log, event.request.headers, admin.id, data.userId, data._password);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to reset password');
	}
});
