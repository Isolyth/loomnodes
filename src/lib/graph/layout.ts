import dagre from '@dagrejs/dagre';

interface CircleNode {
	id: string;
	data: { isRoot: boolean; parentId: string | null; childIds: string[] };
}

export function computeCircleLayout(
	nodes: CircleNode[],
	layerSpacing: number
): { positions: Map<string, { x: number; y: number }>; layerRadii: number[]; nodeRadii: Map<string, number> } {
	const positions = new Map<string, { x: number; y: number }>();
	const layerRadii: number[] = [];
	const nodeRadii = new Map<string, number>();

	if (nodes.length === 0) return { positions, layerRadii, nodeRadii };

	const nodeMap = new Map<string, CircleNode>();
	for (const n of nodes) nodeMap.set(n.id, n);

	const root = nodes.find((n) => n.data.isRoot);
	if (!root) return { positions, layerRadii, nodeRadii };
	nodeRadii.set(root.id, 0);

	// BFS to assign depths
	const depth = new Map<string, number>();
	const layers = new Map<number, string[]>();
	const angleMap = new Map<string, number>();

	depth.set(root.id, 0);
	layers.set(0, [root.id]);
	positions.set(root.id, { x: 0, y: 0 });
	angleMap.set(root.id, 0);

	const queue = [root.id];
	let maxDepth = 0;

	while (queue.length > 0) {
		const id = queue.shift()!;
		const node = nodeMap.get(id)!;
		const d = depth.get(id)!;

		for (const childId of node.data.childIds) {
			if (depth.has(childId)) continue;
			const cd = d + 1;
			depth.set(childId, cd);
			if (!layers.has(cd)) layers.set(cd, []);
			layers.get(cd)!.push(childId);
			queue.push(childId);
			if (cd > maxDepth) maxDepth = cd;
		}
	}

	// Minimum arc length between nodes so they don't overlap.
	// layerSpacing acts as both the min gap between rings and the desired arc gap.
	const minArcLen = layerSpacing;
	let prevRadius = 0;

	// Place each layer on a concentric circle
	for (let d = 1; d <= maxDepth; d++) {
		const ids = layers.get(d);
		if (!ids || ids.length === 0) continue;

		const count = ids.length;
		// Radius must be large enough that arc between adjacent nodes >= minArcLen
		// circumference = 2*PI*r, arc = circumference/count >= minArcLen
		// => r >= count * minArcLen / (2*PI)
		const radiusForFit = (count * minArcLen) / (2 * Math.PI);
		const radius = Math.max(prevRadius + layerSpacing, radiusForFit);
		prevRadius = radius;
		layerRadii.push(radius);

		// Sort nodes by parent's angle so siblings cluster near their parent
		ids.sort((a, b) => {
			const pa = nodeMap.get(a)!.data.parentId;
			const pb = nodeMap.get(b)!.data.parentId;
			const aa = pa ? (angleMap.get(pa) ?? 0) : 0;
			const ab = pb ? (angleMap.get(pb) ?? 0) : 0;
			return aa - ab;
		});

		const angleStep = (2 * Math.PI) / count;

		for (let i = 0; i < count; i++) {
			const angle = i * angleStep - Math.PI / 2; // start from top
			positions.set(ids[i], {
				x: radius * Math.cos(angle),
				y: radius * Math.sin(angle)
			});
			angleMap.set(ids[i], angle);
			nodeRadii.set(ids[i], radius);
		}
	}

	return { positions, layerRadii, nodeRadii };
}

export function computeLayout(
	nodes: { id: string }[],
	edges: { source: string; target: string }[],
	nodeWidth: number,
	nodeHeight: number
): Map<string, { x: number; y: number }> {
	const g = new dagre.graphlib.Graph();
	g.setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 20 });

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
