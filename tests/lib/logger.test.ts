import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import {
	createOperationLogger,
	createRequestLogger,
	logger,
	resolveRequestId
} from '../../src/lib/server/logger';

describe('logger module', () => {
	it('exports a base logger with name "logwiz"', () => {
		expect(logger).toBeDefined();
		expect(typeof logger.level).toBe('string');
	});

	it('createRequestLogger returns a child logger with bound context', () => {
		const child = createRequestLogger({
			requestId: 'test-req-1',
			method: 'GET',
			path: '/api/health'
		});
		expect(child).toBeDefined();
		expect(typeof child.info).toBe('function');
		const bindings = child.bindings();
		expect(bindings.requestId).toBe('test-req-1');
		expect(bindings.method).toBe('GET');
		expect(bindings.path).toBe('/api/health');
	});

	it('createRequestLogger includes optional userId', () => {
		const child = createRequestLogger({
			requestId: 'test-req-2',
			method: 'POST',
			path: '/api/export',
			userId: 'user-abc'
		});
		expect(child.bindings().userId).toBe('user-abc');
	});

	it('resolveRequestId returns inbound header value when present', () => {
		const headers = new Headers({ 'x-request-id': 'from-client-123' });
		expect(resolveRequestId(headers)).toBe('from-client-123');
	});

	it('resolveRequestId generates a UUID when header is absent', () => {
		const headers = new Headers();
		const id = resolveRequestId(headers);
		expect(id).toBeDefined();
		expect(typeof id).toBe('string');
		expect(id.length).toBeGreaterThan(0);
	});

	it('resolveRequestId generates a UUID when header is empty', () => {
		const headers = new Headers({ 'x-request-id': '' });
		const id = resolveRequestId(headers);
		expect(id).toBeDefined();
		expect(id).not.toBe('');
	});

	it('createOperationLogger returns a child with operation context', () => {
		const parent = createRequestLogger({
			requestId: 'req-op-1',
			method: 'POST',
			path: '/api/export'
		});
		const opLogger = createOperationLogger(parent, {
			operation: 'export',
			exportId: 'exp-123'
		});
		const bindings = opLogger.bindings();
		expect(bindings.operation).toBe('export');
		expect(bindings.exportId).toBe('exp-123');
		expect(bindings.requestId).toBe('req-op-1');
	});
});
