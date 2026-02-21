export interface LoomSettings {
	apiKey: string;
	apiBaseUrl: string;
	model: string;
	provider: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	frequencyPenalty: number;
	presencePenalty: number;
	numGenerations: number;
	maxParallelRequests: number;
	maxLeafGenerations: number;
	// Display
	viewMode: 'graph' | 'tree' | 'circle';
	nodeSize: number;
	fontSize: number;
	lodThreshold: number;
	circleLayerSpacing: number;
	// Force simulation
	forceRepulsion: number;
	forceLinkDistance: number;
	forceLinkStrength: number;
	forceCenterStrength: number;
	forceAlphaDecay: number;
	forceLeafRepulsion: number;
	// Embedding API
	embeddingApiKey: string;
	embeddingApiBaseUrl: string;
	embeddingModel: string;
	autoEmbedOnGenerate: boolean;
	// Clustering
	clusterMode: 'auto' | 'qualities';
	dbscanEpsilon: number;
	dbscanMinPoints: number;
	qualityThreshold: number;
	// Regions
	showRegions: boolean;
	regionOpacity: number;
}

export const DEFAULT_SETTINGS: LoomSettings = {
	apiKey: '',
	apiBaseUrl: 'https://api.openai.com/v1',
	model: 'gpt-3.5-turbo-instruct',
	provider: '',
	temperature: 0.7,
	topP: 1.0,
	maxTokens: 256,
	frequencyPenalty: 0,
	presencePenalty: 0,
	numGenerations: 3,
	maxParallelRequests: 5,
	maxLeafGenerations: 10,
	viewMode: 'graph',
	nodeSize: 395,
	fontSize: 14,
	lodThreshold: 120,
	circleLayerSpacing: 350,
	forceRepulsion: 600,
	forceLinkDistance: 280,
	forceLinkStrength: 0.7,
	forceCenterStrength: 0.03,
	forceAlphaDecay: 0.03,
	forceLeafRepulsion: 0.02,
	embeddingApiKey: '',
	embeddingApiBaseUrl: 'https://api.openai.com/v1',
	embeddingModel: 'text-embedding-3-small',
	autoEmbedOnGenerate: true,
	clusterMode: 'auto',
	dbscanEpsilon: 0.15,
	dbscanMinPoints: 2,
	qualityThreshold: 0.15,
	showRegions: true,
	regionOpacity: 0.08
};
