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

/**
 * Builds a graph with the given number of children off the root,
 * each with the given text length. Returns root id and child ids.
 */
function buildGraph(numChildren: number, textLength: number = 100) {
	graphStore.clearAll();
	graphStore.init();
	const rootId = graphStore.nodes[0].id;
	const text = 'a'.repeat(textLength);
	graphStore.updateText(rootId, text);

	const childIds: string[] = [];
	for (let i = 0; i < numChildren; i++) {
		const childId = graphStore.addChild(rootId, `child ${i} ` + text, 0);
		childIds.push(childId);
	}
	return { rootId, childIds };
}

/**
 * Builds a deeper tree: root -> chain of depth nodes, each with `breadth` siblings.
 */
function buildTree(depth: number, breadth: number, textLength: number = 100) {
	graphStore.clearAll();
	graphStore.init();
	const rootId = graphStore.nodes[0].id;
	const text = 'a'.repeat(textLength);
	graphStore.updateText(rootId, text);

	let parentIds = [rootId];
	const allIds: string[] = [rootId];

	for (let d = 0; d < depth; d++) {
		const nextParents: string[] = [];
		for (const pid of parentIds) {
			for (let b = 0; b < breadth; b++) {
				const childId = graphStore.addChild(pid, `d${d}b${b} ` + text, 0);
				nextParents.push(childId);
				allIds.push(childId);
			}
		}
		parentIds = nextParents;
	}
	return { rootId, allIds, leafIds: parentIds };
}

function median(arr: number[]): number {
	const sorted = [...arr].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function bench(fn: () => void, iterations: number = 100): { median: number; total: number } {
	// Warmup
	for (let i = 0; i < 5; i++) fn();

	const times: number[] = [];
	for (let i = 0; i < iterations; i++) {
		const start = performance.now();
		fn();
		times.push(performance.now() - start);
	}
	return { median: median(times), total: times.reduce((a, b) => a + b, 0) };
}

describe('graph store performance', () => {
	beforeEach(() => {
		storage.clear();
	});

	describe('updateTextSilent', () => {
		it('100 nodes: measure time per call', () => {
			const { childIds } = buildGraph(100);
			const targetId = childIds[50]; // update a node in the middle

			const result = bench(() => {
				graphStore.updateTextSilent(targetId, 'updated text ' + Math.random());
			}, 500);

			console.log(`updateTextSilent (100 nodes): median=${result.median.toFixed(4)}ms, total=${result.total.toFixed(2)}ms for 500 calls`);
			// Baseline expectation: should complete within reasonable time
			expect(result.median).toBeLessThan(5);
		});

		it('500 nodes: measure time per call', () => {
			const { childIds } = buildGraph(500);
			const targetId = childIds[250];

			const result = bench(() => {
				graphStore.updateTextSilent(targetId, 'updated text ' + Math.random());
			}, 200);

			console.log(`updateTextSilent (500 nodes): median=${result.median.toFixed(4)}ms, total=${result.total.toFixed(2)}ms for 200 calls`);
			expect(result.median).toBeLessThan(10);
		});

		it('simulated streaming: 100 nodes, 200 token updates to one node', () => {
			const { childIds } = buildGraph(100);
			const targetId = childIds[0];
			let text = 'initial prompt text';

			const start = performance.now();
			for (let i = 0; i < 200; i++) {
				text += ' token' + i;
				graphStore.updateTextSilent(targetId, text);
			}
			const elapsed = performance.now() - start;

			console.log(`streaming sim (100 nodes, 200 tokens): total=${elapsed.toFixed(2)}ms, per-token=${(elapsed / 200).toFixed(4)}ms`);
			expect(elapsed).toBeLessThan(2000);
		});
	});

	describe('setGenerating', () => {
		it('100 nodes: measure time per call', () => {
			const { childIds } = buildGraph(100);
			const targetId = childIds[50];

			const result = bench(() => {
				graphStore.setGenerating(targetId, true);
			}, 500);

			console.log(`setGenerating (100 nodes): median=${result.median.toFixed(4)}ms, total=${result.total.toFixed(2)}ms for 500 calls`);
			expect(result.median).toBeLessThan(5);
		});
	});

	describe('updateText (with persist)', () => {
		it('100 nodes: measure time per call including localStorage write', () => {
			const { childIds } = buildGraph(100);
			const targetId = childIds[50];

			const result = bench(() => {
				graphStore.updateText(targetId, 'updated text ' + Math.random());
			}, 200);

			console.log(`updateText+persist (100 nodes): median=${result.median.toFixed(4)}ms, total=${result.total.toFixed(2)}ms for 200 calls`);
			expect(result.median).toBeLessThan(10);
		});

		it('500 nodes: measure persist cost at scale', () => {
			const { childIds } = buildGraph(500, 500);
			const targetId = childIds[250];

			const result = bench(() => {
				graphStore.updateText(targetId, 'updated text ' + Math.random());
			}, 50);

			console.log(`updateText+persist (500 nodes, 500char text): median=${result.median.toFixed(4)}ms, total=${result.total.toFixed(2)}ms for 50 calls`);
			expect(result.median).toBeLessThan(50);
		});
	});

	describe('addChildStreaming', () => {
		it('measure cost of adding streaming children', () => {
			graphStore.clearAll();
			graphStore.init();
			const rootId = graphStore.nodes[0].id;
			graphStore.updateText(rootId, 'root text');

			const times: number[] = [];
			for (let i = 0; i < 50; i++) {
				const start = performance.now();
				graphStore.addChildStreaming(rootId, 'child text ' + i, 10);
				times.push(performance.now() - start);
			}

			const med = median(times);
			const total = times.reduce((a, b) => a + b, 0);
			console.log(`addChildStreaming (growing to 51 nodes): median=${med.toFixed(4)}ms, total=${total.toFixed(2)}ms for 50 calls`);
			expect(med).toBeLessThan(10);
		});
	});

	describe('rebuildIndex (via nodes setter)', () => {
		it('100 nodes: measure index rebuild cost', () => {
			const { childIds } = buildGraph(100);

			const result = bench(() => {
				// Trigger rebuildIndex through the nodes setter
				graphStore.nodes = [...graphStore.nodes];
			}, 500);

			console.log(`rebuildIndex via setter (100 nodes): median=${result.median.toFixed(4)}ms, total=${result.total.toFixed(2)}ms for 500 calls`);
			expect(result.median).toBeLessThan(5);
		});

		it('500 nodes: measure index rebuild cost', () => {
			buildGraph(500);

			const result = bench(() => {
				graphStore.nodes = [...graphStore.nodes];
			}, 200);

			console.log(`rebuildIndex via setter (500 nodes): median=${result.median.toFixed(4)}ms, total=${result.total.toFixed(2)}ms for 200 calls`);
			expect(result.median).toBeLessThan(10);
		});
	});

	describe('combined streaming scenario', () => {
		it('5 nodes generating simultaneously: simulate 100 token updates each', () => {
			const { childIds } = buildGraph(50);
			// Pick 5 "generating" nodes
			const generatingIds = childIds.slice(0, 5);
			const buffers = new Map<string, string>();
			for (const id of generatingIds) {
				graphStore.setGenerating(id, true);
				buffers.set(id, 'initial prompt ');
			}

			const tokensPerNode = 100;
			const start = performance.now();
			// Simulate round-robin token arrival
			for (let t = 0; t < tokensPerNode; t++) {
				for (const id of generatingIds) {
					const buf = buffers.get(id)! + `tok${t} `;
					buffers.set(id, buf);
					graphStore.updateTextSilent(id, buf);
				}
			}
			const elapsed = performance.now() - start;
			const totalUpdates = tokensPerNode * generatingIds.length;

			console.log(`combined streaming (50 nodes, 5 generating, ${totalUpdates} updates): total=${elapsed.toFixed(2)}ms, per-update=${(elapsed / totalUpdates).toFixed(4)}ms`);
			expect(elapsed).toBeLessThan(5000);
		});
	});

	describe('structural operations at scale', () => {
		it('structureVersion: coalesces increments during bulk addChildStreaming', async () => {
			graphStore.clearAll();
			graphStore.init();
			// Wait for microtask coalescing from init/clearAll
			await new Promise<void>((r) => queueMicrotask(() => r()));

			const rootId = graphStore.nodes[0].id;
			graphStore.updateText(rootId, 'root');

			const versionBefore = graphStore.structureVersion;
			const numChildren = 20;

			const start = performance.now();
			for (let i = 0; i < numChildren; i++) {
				graphStore.addChildStreaming(rootId, 'child ' + i, 6);
			}
			const elapsed = performance.now() - start;

			// structureVersion is coalesced via microtask — not yet incremented
			const versionImmediate = graphStore.structureVersion;
			expect(versionImmediate - versionBefore).toBe(0);

			// After microtask, should have coalesced to just 1 increment
			await new Promise<void>((r) => queueMicrotask(() => r()));
			const versionAfter = graphStore.structureVersion;

			console.log(`bulk addChildStreaming (${numChildren} children): total=${elapsed.toFixed(2)}ms, structureVersion increments=${versionAfter - versionBefore} (coalesced from ${numChildren})`);
			expect(versionAfter - versionBefore).toBe(1);
		});
	});

	describe('persist cost isolation', () => {
		it('measure JSON.stringify cost for various graph sizes', () => {
			for (const size of [10, 50, 100, 500]) {
				buildGraph(size, 200);
				const data = { nodes: graphStore.nodes, edges: graphStore.edges };

				const result = bench(() => {
					JSON.stringify(data);
				}, 50);

				console.log(`JSON.stringify (${size + 1} nodes, 200char): median=${result.median.toFixed(4)}ms`);
			}
			expect(true).toBe(true); // informational test
		});
	});
});
