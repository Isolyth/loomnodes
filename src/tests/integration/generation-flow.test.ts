import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear()
});

// Mock requestAnimationFrame to flush synchronously in tests
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });

// Mock fetch
vi.stubGlobal('fetch', vi.fn());

/** Create a mock SSE Response from completion text */
function mockSSEResponse(text: string) {
	const sseData = `data: ${JSON.stringify({ choices: [{ text, index: 0, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`;
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(sseData));
			controller.close();
		}
	});
	return { ok: true, body: stream };
}

const { graphStore } = await import('$lib/stores/graph.svelte.js');
const { settingsStore } = await import('$lib/stores/settings.svelte.js');
const { generationStore } = await import('$lib/stores/generation.svelte.js');

describe('generation flow integration', () => {
	beforeEach(() => {
		storage.clear();
		graphStore.clearAll();
		settingsStore.reset();
		vi.restoreAllMocks();
	});

	it('generates N children with mocked API', async () => {
		settingsStore.update({
			apiKey: 'test-key',
			numGenerations: 3,
			maxParallelRequests: 5
		});

		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'Hello world');

		let callCount = 0;
		const mockFetch = vi.fn().mockImplementation(() => {
			callCount++;
			return Promise.resolve(mockSSEResponse(` completion ${callCount}`));
		});
		vi.stubGlobal('fetch', mockFetch);

		await generationStore.generateForNode(rootId);

		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(graphStore.nodes.length).toBe(4); // root + 3 children
		expect(graphStore.edges.length).toBe(3);

		// All children should have the root as parent and contain full prompt
		const children = graphStore.nodes.filter((n) => !n.data.isRoot);
		for (const child of children) {
			expect(child.data.parentId).toBe(rootId);
			expect(child.data.text).toMatch(/^Hello world completion \d$/);
		}
	});

	it('creates error placeholder nodes on API failure', async () => {
		settingsStore.update({
			apiKey: 'test-key',
			numGenerations: 2,
			maxParallelRequests: 5
		});

		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'test prompt');

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.reject(new Error('not json'))
			})
		);

		await generationStore.generateForNode(rootId);

		expect(graphStore.nodes.length).toBe(3); // root + 2 error nodes
		const children = graphStore.nodes.filter((n) => !n.data.isRoot);
		for (const child of children) {
			expect(child.data.text).toMatch(/\[Error:/);
		}
	});

	it('throws when no API key set for openai', async () => {
		settingsStore.reset(); // no API key
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'test');

		await expect(generationStore.generateForNode(rootId)).rejects.toThrow('API key is required');
	});

	it('throws when node text is empty', async () => {
		settingsStore.update({ apiKey: 'test-key' });
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		// root text is empty by default

		await expect(generationStore.generateForNode(rootId)).rejects.toThrow(
			'Node has no text to generate from'
		);
	});

	it('isGenerating flag is set during generation', async () => {
		settingsStore.update({ apiKey: 'test-key', numGenerations: 1 });
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'prompt');

		let resolveRequest: () => void;
		const pendingRequest = new Promise<void>((r) => (resolveRequest = r));

		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				() => pendingRequest.then(() => mockSSEResponse(' done'))
			)
		);

		const genPromise = generationStore.generateForNode(rootId);

		// During generation
		expect(graphStore.nodes[0].data.isGenerating).toBe(true);

		resolveRequest!();
		await genPromise;

		// After generation
		expect(graphStore.nodes.find((n) => n.id === rootId)!.data.isGenerating).toBe(false);
	});
});
