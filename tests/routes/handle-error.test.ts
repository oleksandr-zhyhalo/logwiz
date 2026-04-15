import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ building: true }));
vi.mock('$lib/server/auth', () => ({ auth: {} }));
vi.mock('$lib/server/config', () => ({
	config: { signinRateLimitMax: 5 },
	validateConfig: () => ({})
}));
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/schema', () => ({ account: {}, user: {} }));
vi.mock('$lib/server/services/index.service', () => ({ syncIndexesFromQuickwit: async () => [] }));
vi.mock('$lib/server/logger', () => {
	const noop = () => {};
	const noopLogger = {
		info: noop,
		warn: noop,
		error: noop,
		debug: noop,
		child: () => noopLogger
	};
	return { logger: noopLogger, createRequestLogger: () => noopLogger, resolveRequestId: () => 'mock-id' };
});
vi.mock('sveltekit-rate-limiter/server', () => ({
	RetryAfterRateLimiter: class {
		check() {
			return { limited: false };
		}
	}
}));
vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: async ({ resolve, event }: { resolve: Function; event: unknown }) =>
		resolve(event)
}));

import { handleError } from '../../src/hooks.server';

describe('handleError', () => {
	it('returns requestId from event.locals', () => {
		const event = {
			locals: { requestId: 'test-req-123' }
		} as Parameters<typeof handleError>[0]['event'];

		const result = handleError({
			event,
			error: new Error('boom'),
			status: 500,
			message: 'Internal Error'
		});

		expect(result).toEqual({
			message: 'An unexpected error occurred',
			requestId: 'test-req-123'
		});
	});

	it('returns undefined requestId when not set in locals', () => {
		const event = {
			locals: {}
		} as Parameters<typeof handleError>[0]['event'];

		const result = handleError({
			event,
			error: new Error('boom'),
			status: 500,
			message: 'Internal Error'
		});

		expect(result).toEqual({
			message: 'An unexpected error occurred',
			requestId: undefined
		});
	});

	it('does not leak the original error message', () => {
		const event = {
			locals: { requestId: 'req-456' }
		} as Parameters<typeof handleError>[0]['event'];

		const result = handleError({
			event,
			error: new Error('sensitive database connection string'),
			status: 500,
			message: 'Internal Error'
		});

		expect(result?.message).toBe('An unexpected error occurred');
		expect(JSON.stringify(result)).not.toContain('sensitive');
	});
});
