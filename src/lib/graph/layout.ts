import dagre from '@dagrejs/dagre';

export function computeLayout(
	nodes: { id: string }[],
	edges: { source: string; target: string }[],
	nodeWidth: number,
	nodeHeight: number
): Map<string, { x: number; y: number }> {
	const g = new dagre.graphlib.Graph();
	g.setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 60 });

	for (const node of nodes) {
		g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
	}
	for (const edge of edges) {
		g.setEdge(edge.source, edge.target);
	}

	dagre.layout(g);

	const positions = new Map<string, { x: number; y: number }>();
	for (const node of nodes) {
		const n = g.node(node.id);
		positions.set(node.id, { x: n.x, y: n.y });
	}
	return positions;
}
