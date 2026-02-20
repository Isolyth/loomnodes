export interface CompletionRequest {
	model: string;
	prompt: string;
	max_tokens: number;
	temperature: number;
	top_p: number;
	frequency_penalty: number;
	presence_penalty: number;
}

export interface CompletionChoice {
	text: string;
	index: number;
	finish_reason: string | null;
}

export interface CompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: CompletionChoice[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface CompletionError {
	error: {
		message: string;
		type: string;
		code: string | null;
	};
}
