export interface LoomNodeData {
	id: string;
	text: string;
	parentId: string | null;
	childIds: string[];
	isRoot: boolean;
	isGenerating: boolean;
}
