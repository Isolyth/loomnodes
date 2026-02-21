export class EmbeddingServiceError extends Error {
	constructor(
		message: string,
		public status?: number
	) {
		super(message);
		this.name = 'EmbeddingServiceError';
	}
}

export interface EmbeddingResult {
	index: number;
	embedding: number[];
}

export async function fetchEmbeddings(
	texts: string[],
	settings: { embeddingApiBaseUrl: string; embeddingApiKey: string; embeddingModel: string }
): Promise<EmbeddingResult[]> {
	const response = await fetch('/api/embeddings', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			apiBaseUrl: settings.embeddingApiBaseUrl,
			apiKey: settings.embeddingApiKey,
			model: settings.embeddingModel,
			input: texts
		})
	});

	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new EmbeddingServiceError(
			data?.error?.message || `Embedding request failed: ${response.status}`,
			response.status
		);
	}

	const data = await response.json();

	// OpenAI format: { data: [{ embedding: number[], index: number }] }
	const results: EmbeddingResult[] = (data.data || []).map(
		(item: { embedding: number[]; index: number }) => ({
			index: item.index,
			embedding: item.embedding
		})
	);

	return results.sort((a, b) => a.index - b.index);
}
