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
	const body: Record<string, unknown> = {
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

	if (settings.provider) {
		body.provider = {
			only: [settings.provider],
			allow_fallbacks: false
		};
	}

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

export interface StreamCallbacks {
	onToken: (token: string) => void;
	onDone: () => void;
	onError: (error: Error) => void;
}

export async function fetchCompletionStream(
	prompt: string,
	settings: LoomSettings,
	callbacks: StreamCallbacks,
	signal?: AbortSignal
): Promise<void> {
	const body: Record<string, unknown> = {
		apiBaseUrl: settings.apiBaseUrl,
		apiKey: settings.apiKey,
		model: settings.model,
		prompt,
		max_tokens: settings.maxTokens,
		temperature: settings.temperature,
		top_p: settings.topP,
		frequency_penalty: settings.frequencyPenalty,
		presence_penalty: settings.presencePenalty,
		stream: true
	};

	if (settings.provider) {
		body.provider = {
			only: [settings.provider],
			allow_fallbacks: false
		};
	}

	const response = await fetch('/api/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
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

	if (!response.body) {
		throw new CompletionServiceError('No response body for stream', 200);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			const lines = buffer.split('\n');
			// Keep the last potentially incomplete line in the buffer
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith(':')) continue;

				if (trimmed === 'data: [DONE]') {
					callbacks.onDone();
					return;
				}

				if (trimmed.startsWith('data: ')) {
					try {
						const data = JSON.parse(trimmed.slice(6));
						// OpenAI format
						if (data.choices?.[0]?.text != null) {
							callbacks.onToken(data.choices[0].text);
						}
						// llama.cpp format
						else if (typeof data.content === 'string') {
							callbacks.onToken(data.content);
						}
					} catch {
						// skip malformed JSON lines
					}
				}
			}
		}

		// Process any remaining buffer
		if (buffer.trim()) {
			const trimmed = buffer.trim();
			if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
				try {
					const data = JSON.parse(trimmed.slice(6));
					if (data.choices?.[0]?.text != null) {
						callbacks.onToken(data.choices[0].text);
					} else if (typeof data.content === 'string') {
						callbacks.onToken(data.content);
					}
				} catch {
					// skip
				}
			}
		}

		callbacks.onDone();
	} catch (err) {
		if (signal?.aborted) return;
		callbacks.onError(err instanceof Error ? err : new Error(String(err)));
	}
}

export interface BatchStreamRequest {
	id: string;
	prompt: string;
}

export interface BatchStreamCallbacks {
	onToken: (id: string, token: string) => void;
	onDone: (id: string) => void;
	onError: (id: string, error: Error) => void;
}

export async function fetchCompletionStreamBatch(
	requests: BatchStreamRequest[],
	settings: LoomSettings,
	callbacks: BatchStreamCallbacks,
	signal?: AbortSignal
): Promise<void> {
	const body: Record<string, unknown> = {
		requests,
		apiBaseUrl: settings.apiBaseUrl,
		apiKey: settings.apiKey,
		model: settings.model,
		max_tokens: settings.maxTokens,
		temperature: settings.temperature,
		top_p: settings.topP,
		frequency_penalty: settings.frequencyPenalty,
		presence_penalty: settings.presencePenalty,
		maxParallel: settings.maxParallelRequests
	};

	if (settings.provider) {
		body.provider = {
			only: [settings.provider],
			allow_fallbacks: false
		};
	}

	const response = await fetch('/api/completions/batch', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
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

	if (!response.body) {
		throw new CompletionServiceError('No response body for batch stream', 200);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith(':')) continue;
				if (trimmed === 'data: [DONE]') return;

				if (trimmed.startsWith('data: ')) {
					try {
						const event = JSON.parse(trimmed.slice(6));
						switch (event.type) {
							case 'token':
								callbacks.onToken(event.id, event.text);
								break;
							case 'done':
								callbacks.onDone(event.id);
								break;
							case 'error':
								callbacks.onError(
									event.id,
									new Error(event.text || 'Unknown error')
								);
								break;
						}
					} catch {
						// skip malformed
					}
				}
			}
		}
	} catch (err) {
		if (signal?.aborted) return;
		throw err;
	}
}
