import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear()
});

const { graphStore } = await import('$lib/stores/graph.svelte.js');

describe('graph operations integration', () => {
	beforeEach(() => {
		storage.clear();
		graphStore.clearAll();
	});

	it('each node holds full accumulated text as its prompt', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'The quick ');

		// Children hold full text (parent prompt + completion)
		const c1 = graphStore.addChild(rootId, 'The quick brown fox ', 0);
		const c2 = graphStore.addChild(rootId, 'The quick red dog ', 1);
		const gc1 = graphStore.addChild(c1, 'The quick brown fox jumps over', 0);

		expect(graphStore.getPrompt(gc1)).toBe('The quick brown fox jumps over');
		expect(graphStore.getPrompt(c2)).toBe('The quick red dog ');
		expect(graphStore.getPrompt(rootId)).toBe('The quick ');
	});

	it('deleting a mid-tree node preserves other branches', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'root');

		const branch1 = graphStore.addChild(rootId, 'b1', 0);
		const branch2 = graphStore.addChild(rootId, 'b2', 1);
		graphStore.addChild(branch1, 'b1-child', 0);

		expect(graphStore.nodes.length).toBe(4);

		graphStore.deleteNode(branch1);

		expect(graphStore.nodes.length).toBe(2); // root + branch2
		const nodeIds = graphStore.nodes.map((n) => n.id);
		expect(nodeIds).toContain(rootId);
		expect(nodeIds).toContain(branch2);
	});

	it('persists and restores graph state', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'persisted root');
		const childId = graphStore.addChild(rootId, 'persisted child', 0);

		// Simulate page reload by re-initializing
		graphStore.init();

		expect(graphStore.nodes.length).toBe(2);
		const root = graphStore.nodes.find((n) => n.data.isRoot)!;
		expect(root.data.text).toBe('persisted root');

		const child = graphStore.nodes.find((n) => n.id === childId)!;
		expect(child.data.text).toBe('persisted child');
	});

	it('getPrompt returns node own text at each level', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'Hello');

		const c1 = graphStore.addChild(rootId, 'Hello world', 0);
		const gc1 = graphStore.addChild(c1, 'Hello world!', 0);

		expect(graphStore.getPrompt(rootId)).toBe('Hello');
		expect(graphStore.getPrompt(c1)).toBe('Hello world');
		expect(graphStore.getPrompt(gc1)).toBe('Hello world!');
	});
});
