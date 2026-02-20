import type { LoomNodeData } from '$lib/types/node.js';

/**
 * Walk from a node up to the root, returning the path ordered root-first.
 */
export function getPathToRoot(
	nodeId: string,
	nodesMap: Map<string, LoomNodeData>
): LoomNodeData[] {
	const path: LoomNodeData[] = [];
	let current = nodesMap.get(nodeId);
	while (current) {
		path.push(current);
		current = current.parentId ? nodesMap.get(current.parentId) : undefined;
	}
	return path.reverse();
}

/**
 * Build a prompt string by concatenating all text from root to the given node.
 */
export function getPromptForNode(
	nodeId: string,
	nodesMap: Map<string, LoomNodeData>
): string {
	const path = getPathToRoot(nodeId, nodesMap);
	return path.map((n) => n.text).join('');
}
