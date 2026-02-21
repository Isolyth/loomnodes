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

	// Fast index lookup: id -> array index (non-reactive, rebuilt alongside nodeDataMap)
	let nodeIndexMap = new Map<string, number>();

	function rebuildIndex() {
		const dataMap = new Map<string, LoomNodeData>();
		const idxMap = new Map<string, number>();
		for (let i = 0; i < nodes.length; i++) {
			dataMap.set(nodes[i].id, nodes[i].data);
			idxMap.set(nodes[i].id, i);
		}
		nodeDataMap = dataMap;
		nodeIndexMap = idxMap;
	}

	// --- Debounced persistence ---
	let persistTimer: ReturnType<typeof setTimeout> | null = null;

	function persist() {
		if (persistTimer !== null) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			persistTimer = null;
			saveGraph({ nodes, edges });
		}, 500);
	}

	function persistImmediate() {
		if (persistTimer !== null) {
			clearTimeout(persistTimer);
			persistTimer = null;
		}
		saveGraph({ nodes, edges });
	}

	// --- Coalesced structureVersion ---
	let structureScheduled = false;

	function incrementStructure() {
		if (!structureScheduled) {
			structureScheduled = true;
			queueMicrotask(() => {
				structureScheduled = false;
				structureVersion++;
			});
		}
	}

	// --- Patched single-node update (avoids full .map + rebuildIndex) ---
	function patchNode(nodeId: string, patchData: Partial<LoomNodeData>) {
		const idx = nodeIndexMap.get(nodeId);
		if (idx === undefined) return;
		const node = nodes[idx];
		const updatedNode = { ...node, data: { ...node.data, ...patchData } };
		const newNodes = nodes.slice();
		newNodes[idx] = updatedNode;
		nodes = newNodes;
		// Patch nodeDataMap for just this entry
		const newMap = new Map(nodeDataMap);
		newMap.set(nodeId, updatedNode.data);
		nodeDataMap = newMap;
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
		incrementStructure();
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
		persistImmediate();
		incrementStructure();
		return childId;
	}

	function addChildStreaming(parentId: string, initialText: string, generatedTextStart: number = 0): string {
		const parent = nodes.find((n) => n.id === parentId);
		if (!parent) return '';

		const childId = createId();

		const childNode: Node<LoomNodeData> = {
			id: childId,
			type: 'loomNode',
			position: { x: 0, y: 0 },
			data: {
				id: childId,
				text: initialText,
				parentId,
				childIds: [],
				isRoot: false,
				isGenerating: true,
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
		incrementStructure();
		return childId;
	}

	function updateTextSilent(nodeId: string, text: string) {
		patchNode(nodeId, { text });
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
		persistImmediate();
		incrementStructure();
	}

	function updateText(nodeId: string, text: string) {
		patchNode(nodeId, { text });
		persist();
	}

	function setGenerating(nodeId: string, isGenerating: boolean) {
		patchNode(nodeId, { isGenerating });
	}

	function setError(nodeId: string, error: string | undefined) {
		patchNode(nodeId, { error });
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

	function exportGraph(): string {
		return JSON.stringify({ nodes, edges }, null, 2);
	}

	function importGraph(json: string): void {
		const data = JSON.parse(json) as SerializedGraph;
		if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
			throw new Error('Invalid graph format: missing nodes or edges arrays');
		}
		if (data.nodes.length === 0) {
			throw new Error('Invalid graph: no nodes');
		}
		const hasRoot = data.nodes.some((n) => n.data?.isRoot);
		if (!hasRoot) {
			throw new Error('Invalid graph: no root node');
		}
		for (const n of data.nodes) {
			if (!n.id || !n.data || typeof n.data.text !== 'string') {
				throw new Error('Invalid graph: malformed node data');
			}
		}
		nodes = data.nodes.map((n) => ({
			...n,
			type: 'loomNode',
			data: { ...n.data, isGenerating: false }
		}));
		edges = data.edges;
		rebuildIndex();
		persistImmediate();
		incrementStructure();
	}

	function clearAll() {
		const root = createRootNode();
		nodes = [root];
		edges = [];
		rebuildIndex();
		persistImmediate();
		incrementStructure();
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
		addChildStreaming,
		deleteNode,
		updateText,
		updateTextSilent,
		setGenerating,
		setError,
		updatePositionsSilent,
		persist,
		getPrompt,
		exportGraph,
		importGraph,
		clearAll
	};
}

export const graphStore = createGraphStore();
