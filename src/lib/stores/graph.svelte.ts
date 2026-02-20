import type { Node, Edge } from '@xyflow/svelte';
import type { LoomNodeData } from '$lib/types/node.js';
import { createId } from '$lib/utils/id.js';
import { saveGraph, loadGraph } from '$lib/utils/persistence.js';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;

interface SerializedGraph {
	nodes: Node<LoomNodeData>[];
	edges: Edge[];
}

function createGraphStore() {
	let nodes = $state.raw<Node<LoomNodeData>[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let nodeDataMap = $state.raw<Map<string, LoomNodeData>>(new Map());
	let structureVersion = $state(0);

	function rebuildIndex() {
		const map = new Map<string, LoomNodeData>();
		for (const node of nodes) {
			map.set(node.id, node.data);
		}
		nodeDataMap = map;
	}

	function createRootNode(): Node<LoomNodeData> {
		const id = createId();
		return {
			id,
			type: 'loomNode',
			position: { x: 0, y: 0 },
			data: {
				id,
				text: '',
				parentId: null,
				childIds: [],
				isRoot: true,
				isGenerating: false,
				generatedTextStart: 0
			},
			width: NODE_WIDTH,
			height: NODE_HEIGHT
		};
	}

	function init() {
		const saved = loadGraph<SerializedGraph>();
		if (saved && saved.nodes.length > 0) {
			nodes = saved.nodes.map((n) => ({
				...n,
				type: 'loomNode',
				data: { ...n.data, isGenerating: false }
			}));
			edges = saved.edges;
		} else {
			const root = createRootNode();
			nodes = [root];
			edges = [];
		}
		rebuildIndex();
		structureVersion++;
	}

	function persist() {
		saveGraph({ nodes, edges });
	}

	function addChild(parentId: string, text: string, generatedTextStart: number = 0): string {
		const parent = nodes.find((n) => n.id === parentId);
		if (!parent) return '';

		const childId = createId();

		const childNode: Node<LoomNodeData> = {
			id: childId,
			type: 'loomNode',
			position: { x: 0, y: 0 },  // dagre will compute actual position
			data: {
				id: childId,
				text,
				parentId,
				childIds: [],
				isRoot: false,
				isGenerating: false,
				generatedTextStart
			},
			width: NODE_WIDTH,
			height: NODE_HEIGHT
		};

		const newEdge: Edge = {
			id: `e-${parentId}-${childId}`,
			source: parentId,
			target: childId,
			type: 'default'
		};

		const updatedNodes = nodes.map((n) =>
			n.id === parentId
				? { ...n, data: { ...n.data, childIds: [...n.data.childIds, childId] } }
				: n
		);

		nodes = [...updatedNodes, childNode];
		edges = [...edges, newEdge];
		rebuildIndex();
		persist();
		structureVersion++;
		return childId;
	}

	function deleteNode(nodeId: string) {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node || node.data.isRoot) return;

		const toDelete = new Set<string>();
		const queue = [nodeId];
		while (queue.length > 0) {
			const current = queue.pop()!;
			toDelete.add(current);
			const currentNode = nodes.find((n) => n.id === current);
			if (currentNode) {
				queue.push(...currentNode.data.childIds);
			}
		}

		const parentId = node.data.parentId;

		nodes = nodes
			.filter((n) => !toDelete.has(n.id))
			.map((n) =>
				n.id === parentId
					? { ...n, data: { ...n.data, childIds: n.data.childIds.filter((c) => c !== nodeId) } }
					: n
			);

		edges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
		rebuildIndex();
		persist();
		structureVersion++;
	}

	function updateText(nodeId: string, text: string) {
		nodes = nodes.map((n) =>
			n.id === nodeId ? { ...n, data: { ...n.data, text } } : n
		);
		rebuildIndex();
		persist();
	}

	function setGenerating(nodeId: string, isGenerating: boolean) {
		nodes = nodes.map((n) =>
			n.id === nodeId ? { ...n, data: { ...n.data, isGenerating } } : n
		);
		rebuildIndex();
	}

	/** Update positions without persisting — used by the live simulation on each tick. */
	function updatePositionsSilent(positions: Map<string, { x: number; y: number }>) {
		nodes = nodes.map((n) => {
			const pos = positions.get(n.id);
			return pos ? { ...n, position: pos } : n;
		});
	}

	function getPrompt(nodeId: string): string {
		return nodeDataMap.get(nodeId)?.text ?? '';
	}

	function clearAll() {
		const root = createRootNode();
		nodes = [root];
		edges = [];
		rebuildIndex();
		persist();
		structureVersion++;
	}

	return {
		get nodes() { return nodes; },
		set nodes(v: Node<LoomNodeData>[]) { nodes = v; rebuildIndex(); },
		get edges() { return edges; },
		set edges(v: Edge[]) { edges = v; },
		get nodeDataMap() { return nodeDataMap; },
		get structureVersion() { return structureVersion; },
		init,
		addChild,
		deleteNode,
		updateText,
		setGenerating,
		updatePositionsSilent,
		persist,
		getPrompt,
		clearAll
	};
}

export const graphStore = createGraphStore();
