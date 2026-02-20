export interface LoomSettings {
	apiKey: string;
	apiBaseUrl: string;
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	frequencyPenalty: number;
	presencePenalty: number;
	numGenerations: number;
	maxParallelRequests: number;
	// Force simulation
	forceRepulsion: number;
	forceLinkDistance: number;
	forceLinkStrength: number;
	forceCenterStrength: number;
	forceAlphaDecay: number;
}

export const DEFAULT_SETTINGS: LoomSettings = {
	apiKey: '',
	apiBaseUrl: 'https://api.openai.com/v1',
	model: 'gpt-3.5-turbo-instruct',
	temperature: 0.7,
	topP: 1.0,
	maxTokens: 256,
	frequencyPenalty: 0,
	presencePenalty: 0,
	numGenerations: 3,
	maxParallelRequests: 5,
	forceRepulsion: 600,
	forceLinkDistance: 280,
	forceLinkStrength: 0.7,
	forceCenterStrength: 0.03,
	forceAlphaDecay: 0.03
};
