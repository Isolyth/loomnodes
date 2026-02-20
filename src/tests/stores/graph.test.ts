import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear()
});

// Dynamic import to get fresh store per test module
const { graphStore } = await import('$lib/stores/graph.svelte.js');

describe('graphStore', () => {
	beforeEach(() => {
		storage.clear();
		graphStore.clearAll();
	});

	it('initializes with a root node', () => {
		graphStore.init();
		expect(graphStore.nodes.length).toBe(1);
		expect(graphStore.nodes[0].data.isRoot).toBe(true);
		expect(graphStore.edges.length).toBe(0);
	});

	it('root node cannot be deleted', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.deleteNode(rootId);
		expect(graphStore.nodes.length).toBe(1);
		expect(graphStore.nodes[0].id).toBe(rootId);
	});

	it('adds child nodes', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		const childId = graphStore.addChild(rootId, 'child text', 0);

		expect(childId).toBeTruthy();
		expect(graphStore.nodes.length).toBe(2);
		expect(graphStore.edges.length).toBe(1);

		const child = graphStore.nodes.find((n) => n.id === childId)!;
		expect(child.data.text).toBe('child text');
		expect(child.data.parentId).toBe(rootId);
		expect(child.data.isRoot).toBe(false);

		const root = graphStore.nodes.find((n) => n.id === rootId)!;
		expect(root.data.childIds).toContain(childId);
	});

	it('cascade deletes descendants', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		const childId = graphStore.addChild(rootId, 'child', 0);
		const grandchildId = graphStore.addChild(childId, 'grandchild', 0);

		expect(graphStore.nodes.length).toBe(3);
		expect(graphStore.edges.length).toBe(2);

		graphStore.deleteNode(childId);
		expect(graphStore.nodes.length).toBe(1);
		expect(graphStore.edges.length).toBe(0);

		// Root should have empty childIds
		expect(graphStore.nodes[0].data.childIds).toEqual([]);
	});

	it('updates text', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'hello world');
		expect(graphStore.nodes[0].data.text).toBe('hello world');
	});

	it('getPrompt returns node text directly', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'Once upon');
		// Child holds full accumulated text
		const childId = graphStore.addChild(rootId, 'Once upon a time', 0);

		expect(graphStore.getPrompt(childId)).toBe('Once upon a time');
		expect(graphStore.getPrompt(rootId)).toBe('Once upon');
	});

	it('maintains edge consistency after delete', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		const c1 = graphStore.addChild(rootId, 'c1', 0);
		const c2 = graphStore.addChild(rootId, 'c2', 1);
		graphStore.addChild(c1, 'gc1', 0);

		expect(graphStore.nodes.length).toBe(4);
		expect(graphStore.edges.length).toBe(3);

		graphStore.deleteNode(c1);
		expect(graphStore.nodes.length).toBe(2); // root + c2
		expect(graphStore.edges.length).toBe(1); // root->c2

		// Verify remaining edge connects root to c2
		expect(graphStore.edges[0].source).toBe(rootId);
		expect(graphStore.edges[0].target).toBe(c2);
	});

	it('setGenerating flag', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		expect(graphStore.nodes[0].data.isGenerating).toBe(false);

		graphStore.setGenerating(rootId, true);
		expect(graphStore.nodes[0].data.isGenerating).toBe(true);

		graphStore.setGenerating(rootId, false);
		expect(graphStore.nodes[0].data.isGenerating).toBe(false);
	});

	it('clearAll resets to single root', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.addChild(rootId, 'c1', 0);
		graphStore.addChild(rootId, 'c2', 1);

		graphStore.clearAll();
		expect(graphStore.nodes.length).toBe(1);
		expect(graphStore.nodes[0].data.isRoot).toBe(true);
		expect(graphStore.edges.length).toBe(0);
	});
});
