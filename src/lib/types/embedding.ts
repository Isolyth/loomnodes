export interface NodeEmbedding {
	nodeId: string;
	vector: number[];
	textHash: string;
}

export interface Cluster {
	id: string;
	label: string;
	color: string;
	memberNodeIds: string[];
	centroid: number[];
	isUserDefined: boolean;
}

export interface QualityDefinition {
	id: string;
	description: string;
	embedding: number[];
	color: string;
}
