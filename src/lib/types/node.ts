export interface TokenLogprob {
	token: string;
	logprob: number;
	topLogprobs?: Record<string, number>; // alternative tokens and their logprobs
}

export interface LoomNodeData {
	id: string;
	text: string;
	parentId: string | null;
	childIds: string[];
	isRoot: boolean;
	isGenerating: boolean;
	generatedTextStart: number; // char index where generated text begins (0 = none)
	error?: string; // error message from generation failure
	logprobs?: TokenLogprob[]; // per-token logprobs for generated portion
}
