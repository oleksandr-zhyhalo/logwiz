import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { auth } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { db } from '$lib/server/db';
import { account, inviteToken, user } from '$lib/server/db/schema';
import type { Logger } from '$lib/server/logger';
import { hasGoogleAccount } from '$lib/server/services/auth.service';
import { randomHex } from '$lib/utils/crypto';

const INVITE_EXPIRY_MS = () => config.inviteExpiryHours * 60 * 60 * 1000;

const resolvePublicOrigin = (requestOrigin: string) => config.origin ?? requestOrigin;

const buildInviteUrl = (origin: string, token: string) => `${origin}/auth/setup?token=${token}`;

export async function listUsersWithInvites(headers: Headers, requestOrigin: string) {
	const publicOrigin = resolvePublicOrigin(requestOrigin);

	const result = await auth.api.listUsers({ headers, query: {} });

	const pendingInvites = await db.select().from(inviteToken);
	const inviteMap = new Map(
		pendingInvites.map((inv) => [
			inv.userId,
			{ url: buildInviteUrl(publicOrigin, inv.token), expiresAt: inv.expiresAt }
		])
	);

	const googleAccounts = await db
		.select({ userId: account.userId })
		.from(account)
		.where(eq(account.providerId, 'google'));
	const googleUserIds = new Set(googleAccounts.map((a) => a.userId));

	// Better Auth's admin plugin doesn't infer custom additionalFields in listUsers return type
	type UserWithLastActive = (typeof result.users)[number] & { lastActive?: number };

	return (result.users as UserWithLastActive[]).map((u) => ({
		id: u.id,
		name: u.name,
		email: u.email,
		role: u.role,
		lastActive: u.lastActive ? new Date(u.lastActive) : null,
		status:
			!googleUserIds.has(u.id) && inviteMap.has(u.id) ? ('pending' as const) : ('active' as const),
		authProvider: googleUserIds.has(u.id) ? ('google' as const) : ('credential' as const),
		inviteUrl: inviteMap.get(u.id)?.url ?? null,
		inviteExpiresAt: inviteMap.get(u.id)?.expiresAt ?? null
	}));
}

export async function createInvite(
	logger: Logger,
	headers: Headers,
	data: { email: string; name: string; role: 'user' | 'admin' },
	requestOrigin: string
) {
	const publicOrigin = resolvePublicOrigin(requestOrigin);
	const tempPassword = randomHex(32);

	let created;
	try {
		created = await auth.api.createUser({
			headers,
			body: {
				email: data.email,
				password: tempPassword,
				name: data.name,
				role: data.role
			}
		});
	} catch (e) {
		if (e instanceof APIError) {
			throw new Error(e.message || 'Failed to create user', { cause: e });
		}
		throw e;
	}

	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS());
	const token = randomHex(32);
	await db.insert(inviteToken).values({
		userId: created.user.id,
		token,
		expiresAt
	});

	logger.info({ userId: created.user.id, role: data.role }, 'user invite created');
	return { inviteUrl: buildInviteUrl(publicOrigin, token) };
}

export async function regenerateInvite(logger: Logger, userId: string, requestOrigin: string) {
	if (await hasGoogleAccount(userId)) {
		throw new Error('Cannot regenerate invite for a Google-authenticated user');
	}

	const publicOrigin = resolvePublicOrigin(requestOrigin);
	await db.delete(inviteToken).where(eq(inviteToken.userId, userId));

	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS());
	const token = randomHex(32);
	await db.insert(inviteToken).values({
		userId,
		token,
		expiresAt
	});

	logger.info({ targetUserId: userId }, 'invite regenerated');
	return { inviteUrl: buildInviteUrl(publicOrigin, token) };
}

export async function removeUser(logger: Logger, headers: Headers, adminId: string, userId: string) {
	if (userId === adminId) {
		throw new Error('Cannot remove yourself');
	}
	await auth.api.removeUser({
		headers,
		body: { userId }
	});
	logger.info({ targetUserId: userId }, 'user removed');
}

export async function setUserRole(
	logger: Logger,
	headers: Headers,
	adminId: string,
	userId: string,
	role: 'user' | 'admin'
) {
	if (userId === adminId) {
		throw new Error('Cannot change your own role');
	}
	await auth.api.setRole({
		headers,
		body: { userId, role }
	});
	logger.info({ targetUserId: userId, role }, 'user role changed');
}

export async function resetPassword(
	logger: Logger,
	headers: Headers,
	adminId: string,
	userId: string,
	password: string
) {
	if (userId === adminId) {
		throw new Error('Cannot reset your own password');
	}
	if (await hasGoogleAccount(userId)) {
		throw new Error('Cannot reset password for a Google-authenticated user');
	}
	try {
		await auth.api.setUserPassword({
			headers,
			body: { userId, newPassword: password }
		});
	} catch (e) {
		if (e instanceof APIError) {
			throw new Error(e.message || 'Failed to reset password', { cause: e });
		}
		throw e;
	}
	await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, userId));
	logger.info({ targetUserId: userId }, 'user password reset');
}
