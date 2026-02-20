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

describe('graphStore export/import', () => {
	beforeEach(() => {
		storage.clear();
		graphStore.clearAll();
	});

	it('exports graph as valid JSON with nodes and edges', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'hello');
		graphStore.addChild(rootId, 'hello world', 5);

		const json = graphStore.exportGraph();
		const parsed = JSON.parse(json);

		expect(parsed).toHaveProperty('nodes');
		expect(parsed).toHaveProperty('edges');
		expect(parsed.nodes).toHaveLength(2);
		expect(parsed.edges).toHaveLength(1);
	});

	it('round-trips: export then import restores same graph', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'prompt text');
		const c1 = graphStore.addChild(rootId, 'prompt text completion A', 11);
		const c2 = graphStore.addChild(rootId, 'prompt text completion B', 11);
		graphStore.addChild(c1, 'prompt text completion A deeper', 25);

		const json = graphStore.exportGraph();
		const originalNodeCount = graphStore.nodes.length;
		const originalEdgeCount = graphStore.edges.length;

		// Clear and reimport
		graphStore.clearAll();
		expect(graphStore.nodes.length).toBe(1);

		graphStore.importGraph(json);
		expect(graphStore.nodes.length).toBe(originalNodeCount);
		expect(graphStore.edges.length).toBe(originalEdgeCount);

		// Verify root text preserved
		const root = graphStore.nodes.find((n) => n.data.isRoot);
		expect(root).toBeTruthy();
		expect(root!.data.text).toBe('prompt text');

		// Verify child relationships preserved
		expect(root!.data.childIds).toContain(c1);
		expect(root!.data.childIds).toContain(c2);
	});

	it('import resets isGenerating to false', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.setGenerating(rootId, true);

		const json = graphStore.exportGraph();
		graphStore.clearAll();
		graphStore.importGraph(json);

		expect(graphStore.nodes[0].data.isGenerating).toBe(false);
	});

	it('import preserves generatedTextStart', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.updateText(rootId, 'hello');
		const childId = graphStore.addChild(rootId, 'hello world', 5);

		const json = graphStore.exportGraph();
		graphStore.clearAll();
		graphStore.importGraph(json);

		const child = graphStore.nodes.find((n) => n.id === childId);
		expect(child).toBeTruthy();
		expect(child!.data.generatedTextStart).toBe(5);
	});

	it('import persists to localStorage', () => {
		graphStore.init();
		const rootId = graphStore.nodes[0].id;
		graphStore.addChild(rootId, 'child', 0);

		const json = graphStore.exportGraph();
		graphStore.clearAll();
		graphStore.importGraph(json);

		const saved = storage.get('loomnodes:graph');
		expect(saved).toBeTruthy();
		const parsed = JSON.parse(saved!);
		expect(parsed.nodes).toHaveLength(2);
	});

	it('rejects invalid JSON', () => {
		expect(() => graphStore.importGraph('not json')).toThrow();
	});

	it('rejects missing nodes array', () => {
		expect(() => graphStore.importGraph(JSON.stringify({ edges: [] }))).toThrow('missing nodes or edges');
	});

	it('rejects missing edges array', () => {
		expect(() => graphStore.importGraph(JSON.stringify({ nodes: [] }))).toThrow('missing nodes or edges');
	});

	it('rejects empty nodes array', () => {
		expect(() => graphStore.importGraph(JSON.stringify({ nodes: [], edges: [] }))).toThrow('no nodes');
	});

	it('rejects graph with no root node', () => {
		const noRoot = {
			nodes: [{
				id: 'a',
				type: 'loomNode',
				position: { x: 0, y: 0 },
				data: {
					id: 'a',
					text: 'hello',
					parentId: null,
					childIds: [],
					isRoot: false,
					isGenerating: false,
					generatedTextStart: 0
				}
			}],
			edges: []
		};
		expect(() => graphStore.importGraph(JSON.stringify(noRoot))).toThrow('no root node');
	});

	it('rejects node with missing data', () => {
		const badNode = {
			nodes: [
				{
					id: 'root',
					type: 'loomNode',
					position: { x: 0, y: 0 },
					data: { id: 'root', text: 'hi', parentId: null, childIds: ['a'], isRoot: true, isGenerating: false, generatedTextStart: 0 }
				},
				{ id: 'a', type: 'loomNode', position: { x: 0, y: 0 } }
			],
			edges: []
		};
		expect(() => graphStore.importGraph(JSON.stringify(badNode))).toThrow('malformed node data');
	});

	it('rejects node with non-string text', () => {
		const badText = {
			nodes: [{
				id: 'a',
				type: 'loomNode',
				position: { x: 0, y: 0 },
				data: {
					id: 'a',
					text: 123,
					parentId: null,
					childIds: [],
					isRoot: true,
					isGenerating: false,
					generatedTextStart: 0
				}
			}],
			edges: []
		};
		expect(() => graphStore.importGraph(JSON.stringify(badText))).toThrow('malformed node data');
	});

	it('export of empty graph (just root) works', () => {
		graphStore.init();
		const json = graphStore.exportGraph();
		const parsed = JSON.parse(json);
		expect(parsed.nodes).toHaveLength(1);
		expect(parsed.edges).toHaveLength(0);
		expect(parsed.nodes[0].data.isRoot).toBe(true);
	});

	it('import updates structureVersion', () => {
		graphStore.init();
		const versionBefore = graphStore.structureVersion;

		const rootId = graphStore.nodes[0].id;
		graphStore.addChild(rootId, 'child', 0);
		const json = graphStore.exportGraph();

		graphStore.clearAll();
		const versionAfterClear = graphStore.structureVersion;
		expect(versionAfterClear).toBeGreaterThan(versionBefore);

		graphStore.importGraph(json);
		expect(graphStore.structureVersion).toBeGreaterThan(versionAfterClear);
	});
});
