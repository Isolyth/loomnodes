import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCompletion, CompletionServiceError } from '$lib/services/completion.js';
import type { LoomSettings } from '$lib/types/settings.js';
import { DEFAULT_SETTINGS } from '$lib/types/settings.js';

const mockSettings: LoomSettings = {
	...DEFAULT_SETTINGS,
	apiKey: 'test-key',
	model: 'test-model'
};

describe('fetchCompletion', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('sends correct request shape', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					choices: [{ text: 'completion text', index: 0, finish_reason: 'stop' }]
				})
		});
		vi.stubGlobal('fetch', mockFetch);

		await fetchCompletion('test prompt', mockSettings);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, options] = mockFetch.mock.calls[0];
		expect(url).toBe('https://api.openai.com/v1/completions');
		expect(options.method).toBe('POST');
		expect(options.headers['Authorization']).toBe('Bearer test-key');
		expect(options.headers['Content-Type']).toBe('application/json');

		const body = JSON.parse(options.body);
		expect(body.model).toBe('test-model');
		expect(body.prompt).toBe('test prompt');
		expect(body.max_tokens).toBe(256);
		expect(body.temperature).toBe(0.7);
	});

	it('returns completion text', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ text: ' hello world', index: 0, finish_reason: 'stop' }]
					})
			})
		);

		const result = await fetchCompletion('say', mockSettings);
		expect(result).toBe(' hello world');
	});

	it('strips trailing slash from base URL', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					choices: [{ text: 'ok', index: 0, finish_reason: 'stop' }]
				})
		});
		vi.stubGlobal('fetch', mockFetch);

		await fetchCompletion('test', {
			...mockSettings,
			apiBaseUrl: 'http://localhost:8080/v1/'
		});

		expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8080/v1/completions');
	});

	it('throws on 401', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () =>
					Promise.resolve({
						error: { message: 'Invalid API key', type: 'auth', code: null }
					})
			})
		);

		await expect(fetchCompletion('test', mockSettings)).rejects.toThrow(CompletionServiceError);
		await expect(fetchCompletion('test', mockSettings)).rejects.toThrow('Invalid API key');
	});

	it('throws on 429', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 429,
				json: () =>
					Promise.resolve({
						error: { message: 'Rate limited', type: 'rate_limit', code: null }
					})
			})
		);

		await expect(fetchCompletion('test', mockSettings)).rejects.toThrow('Rate limited');
	});

	it('throws on 500 with fallback message', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.reject(new Error('not json'))
			})
		);

		await expect(fetchCompletion('test', mockSettings)).rejects.toThrow('API error: 500');
	});

	it('throws when no choices returned', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ choices: [] })
			})
		);

		await expect(fetchCompletion('test', mockSettings)).rejects.toThrow(
			'No completion text in response'
		);
	});

	it('omits Authorization header when no API key', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					choices: [{ text: 'ok', index: 0, finish_reason: 'stop' }]
				})
		});
		vi.stubGlobal('fetch', mockFetch);

		await fetchCompletion('test', { ...mockSettings, apiKey: '' });
		expect(mockFetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
	});
});
