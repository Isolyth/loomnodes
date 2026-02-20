import { describe, it, expect } from 'vitest';
import { getPathToRoot, getPromptForNode } from './tree.js';
import type { LoomNodeData } from '$lib/types/node.js';

function makeNode(id: string, text: string, parentId: string | null, childIds: string[] = []): LoomNodeData {
	return { id, text, parentId, childIds, isRoot: parentId === null, isGenerating: false };
}

function buildMap(nodes: LoomNodeData[]): Map<string, LoomNodeData> {
	return new Map(nodes.map((n) => [n.id, n]));
}

describe('getPathToRoot', () => {
	it('returns single node for root', () => {
		const root = makeNode('r', 'root', null);
		const path = getPathToRoot('r', buildMap([root]));
		expect(path).toEqual([root]);
	});

	it('returns path from root to leaf', () => {
		const root = makeNode('r', 'Hello', null, ['a']);
		const a = makeNode('a', ' world', 'r', ['b']);
		const b = makeNode('b', '!', 'a');
		const path = getPathToRoot('b', buildMap([root, a, b]));
		expect(path.map((n) => n.id)).toEqual(['r', 'a', 'b']);
	});

	it('returns empty array for unknown id', () => {
		const path = getPathToRoot('nope', new Map());
		expect(path).toEqual([]);
	});
});

describe('getPromptForNode', () => {
	it('concatenates text from root to node', () => {
		const root = makeNode('r', 'Once upon', null, ['a']);
		const a = makeNode('a', ' a time', 'r', ['b']);
		const b = makeNode('b', ' there was', 'a');
		const prompt = getPromptForNode('b', buildMap([root, a, b]));
		expect(prompt).toBe('Once upon a time there was');
	});

	it('returns single node text for root', () => {
		const root = makeNode('r', 'Start', null);
		expect(getPromptForNode('r', buildMap([root]))).toBe('Start');
	});
});
