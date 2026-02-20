import dagre from '@dagrejs/dagre';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 200;

export function computeLayout(
	nodes: { id: string }[],
	edges: { source: string; target: string }[]
): Map<string, { x: number; y: number }> {
	const g = new dagre.graphlib.Graph();
	g.setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 60 });

	for (const node of nodes) {
		g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
	}
	for (const edge of edges) {
		g.setEdge(edge.source, edge.target);
	}

	dagre.layout(g);

	const positions = new Map<string, { x: number; y: number }>();
	for (const node of nodes) {
		const n = g.node(node.id);
		// dagre returns center positions, SvelteFlow uses top-left
		positions.set(node.id, {
			x: n.x - NODE_WIDTH / 2,
			y: n.y - NODE_HEIGHT / 2
		});
	}
	return positions;
}
