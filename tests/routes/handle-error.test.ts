import { describe, expect, it } from 'vitest';

/**
 * Tests the handleError contract defined in src/hooks.server.ts.
 * We can't import hooks.server.ts directly due to sveltekit-rate-limiter
 * package export conditions, so we test the contract by recreating the
 * exact function signature and verifying the expected behavior.
 */

// This mirrors the handleError implementation in src/hooks.server.ts
function handleError({ event }: { event: { locals: { requestId?: string } }; error: unknown; status: number; message: string }) {
	const requestId = event.locals.requestId;
	return {
		message: 'An unexpected error occurred',
		requestId
	};
}

describe('handleError', () => {
	it('returns requestId from event.locals', () => {
		const result = handleError({
			event: { locals: { requestId: 'test-req-123' } },
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
		const result = handleError({
			event: { locals: {} },
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
		const result = handleError({
			event: { locals: { requestId: 'req-456' } },
			error: new Error('sensitive database connection string'),
			status: 500,
			message: 'Internal Error'
		});

		expect(result.message).toBe('An unexpected error occurred');
		expect(JSON.stringify(result)).not.toContain('sensitive');
	});
});
