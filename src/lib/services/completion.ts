import type { CompletionError } from '$lib/types/api.js';
import type { LoomSettings } from '$lib/types/settings.js';

export class CompletionServiceError extends Error {
	constructor(
		message: string,
		public status: number,
		public code: string | null = null
	) {
		super(message);
		this.name = 'CompletionServiceError';
	}
}

export async function fetchCompletion(
	prompt: string,
	settings: LoomSettings
): Promise<string> {
	const body = {
		apiBaseUrl: settings.apiBaseUrl,
		apiKey: settings.apiKey,
		model: settings.model,
		prompt,
		max_tokens: settings.maxTokens,
		temperature: settings.temperature,
		top_p: settings.topP,
		frequency_penalty: settings.frequencyPenalty,
		presence_penalty: settings.presencePenalty
	};

	const response = await fetch('/api/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		let message = `API error: ${response.status}`;
		try {
			const err = (await response.json()) as CompletionError;
			message = err.error.message;
		} catch {
			// use default message
		}
		throw new CompletionServiceError(message, response.status);
	}

	const data = await response.json();

	// OpenAI format: { choices: [{ text: "..." }] }
	if (data.choices?.length > 0) {
		return data.choices[0].text;
	}

	// llama.cpp native format: { content: "..." }
	if (typeof data.content === 'string') {
		return data.content;
	}

	throw new CompletionServiceError('No completion text in response', 200);
}
