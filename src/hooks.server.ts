import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { and, eq } from 'drizzle-orm';
import { RetryAfterRateLimiter } from 'sveltekit-rate-limiter/server';

import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { config, validateConfig } from '$lib/server/config';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';
import { createRequestLogger, logger, resolveRequestId } from '$lib/server/logger';
import { syncIndexesFromQuickwit } from '$lib/server/services/index.service';

async function seedDefaultAdmin() {
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'admin'))
		.limit(1);
	if (existing) return;

	await auth.api.createUser({
		body: {
			email: config.adminEmail,
			password: config.adminPassword,
			name: 'Admin',
			role: 'admin',
			data: {
				username: config.adminUsername,
				mustChangePassword: true
			}
		}
	});

	logger.info({ username: config.adminUsername, email: config.adminEmail }, 'default admin created');
}

if (!building) {
	validateConfig();

	await seedDefaultAdmin().catch((err) => logger.error({ err }, 'failed to seed default admin'));

	try {
		const summaries = await syncIndexesFromQuickwit();
		logger.info({ count: summaries.length }, 'synced indexes from Quickwit');
	} catch (err) {
		logger.warn({ err }, 'failed to sync indexes from Quickwit');
	}
}

const SKIP_PATHS = ['/_app/', '/favicon'];
const STATIC_EXT = /\.\w{2,5}$/;

function shouldSkipLog(path: string, status: number): boolean {
	if (status >= 400) return false; // always log errors
	if (path === '/api/health') return true;
	if (STATIC_EXT.test(path)) return true;
	return SKIP_PATHS.some((prefix) => path.startsWith(prefix));
}

function resolveLogLevel(
	method: string,
	path: string,
	status: number,
	durationMs: number
): 'debug' | 'info' | 'warn' | 'error' {
	if (status >= 500) return 'error';
	if (status === 429) return 'warn';
	if (durationMs > 10_000) return 'warn';
	if (path === '/api/health' && status !== 200) return 'warn';
	if (path.startsWith('/api/') || path.startsWith('/auth/') || method !== 'GET') return 'info';
	return 'debug';
}

const handleLogging: Handle = async ({ event, resolve }) => {
	const requestId = resolveRequestId(event.request.headers);
	const method = event.request.method;
	const path = event.url.pathname;

	const reqLogger = createRequestLogger({ requestId, method, path });
	event.locals.logger = reqLogger;
	event.locals.requestId = requestId;

	reqLogger.debug('request start');

	const start = performance.now();
	let response: Response;
	try {
		response = await resolve(event);
	} catch (err) {
		const durationMs = Math.round(performance.now() - start);
		const userEmail = event.locals.user?.email;
		reqLogger.error({ err, durationMs, userEmail }, 'request error');
		throw err;
	}

	const durationMs = Math.round(performance.now() - start);
	const status = response.status;

	if (!shouldSkipLog(path, status)) {
		const userEmail = event.locals.user?.email;
		const level = resolveLogLevel(method, path, status, durationMs);
		reqLogger[level]({ status, durationMs, userEmail }, 'request complete');
	}

	response.headers.set('x-request-id', requestId);
	return response;
};

const authLimiter = new RetryAfterRateLimiter({
	IP: [config.signinRateLimitMax, 'm']
});

const AUTH_PATHS = ['/auth/sign-in', '/auth/setup', '/api/auth/sign-in'];

const handleRateLimit: Handle = async ({ event, resolve }) => {
	if (event.request.method === 'POST' && AUTH_PATHS.some((p) => event.url.pathname.startsWith(p))) {
		const status = await authLimiter.check(event);
		if (status.limited) {
			return new Response('Too many requests. Please try again later.', {
				status: 429,
				headers: { 'Retry-After': status.retryAfter.toString() }
			});
		}
	}
	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		// Throttled last-active update (at most once per 5 minutes)
		const now = Date.now();
		const lastActive = session.user.lastActive ?? 0;
		if (now - lastActive > 5 * 60 * 1000) {
			db.update(user)
				.set({ lastActive: new Date(now) })
				.where(eq(user.id, session.user.id))
				.run();
		}

		// Force password change if required (skip for Google-authenticated users)
		if (
			session.user.mustChangePassword &&
			!event.url.pathname.startsWith('/auth/change-password') &&
			!event.url.pathname.startsWith('/api/auth')
		) {
			const [googleAccount] = db
				.select({ id: account.id })
				.from(account)
				.where(and(eq(account.userId, session.user.id), eq(account.providerId, 'google')))
				.all();

			if (!googleAccount) {
				return new Response(null, {
					status: 302,
					headers: { Location: '/auth/change-password' }
				});
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

// IMPORTANT: Must be first in sequence() so headers are applied to all responses,
// including 429s from rate limiting and 302 auth redirects.
// Downstream hooks must use `new Response()` (mutable headers), not `Response.redirect()`.
const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Read existing CSP (contains script-src with nonce from kit.csp), then append
	const existingCsp = response.headers.get('content-security-policy') ?? '';
	const additionalCsp = [
		"default-src 'self'",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com",
		"img-src 'self' data:",
		"connect-src 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ');
	response.headers.set(
		'content-security-policy',
		existingCsp ? `${existingCsp}; ${additionalCsp}` : additionalCsp
	);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000');
	response.headers.set('X-XSS-Protection', '0');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

export const handle = sequence(handleSecurityHeaders, handleLogging, handleRateLimit, handleBetterAuth);

export const handleError: HandleServerError = ({ event }) => {
	const requestId = event.locals.requestId;
	return {
		message: 'An unexpected error occurred',
		requestId
	};
};
