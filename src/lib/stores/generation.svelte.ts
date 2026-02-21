import { graphStore } from './graph.svelte.js';
import { settingsStore } from './settings.svelte.js';
import { embeddingStore } from './embedding.svelte.js';
import {
	fetchCompletionStreamBatch,
	CompletionServiceError
} from '$lib/services/completion.js';
import type { BatchStreamRequest } from '$lib/services/completion.js';

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function createGenerationStore() {
	let activeRequests = $state(0);
	let isBulkGenerating = $state(false);

	async function runBatchGeneration(
		entries: { parentId: string; prompt: string; count: number }[],
		settings: typeof settingsStore.current
	): Promise<void> {
		const requests: BatchStreamRequest[] = [];
		const buffers = new Map<string, string>();
		const prompts = new Map<string, string>();
		const rafScheduled = new Map<string, boolean>();
		const completed = new Set<string>();

		for (const entry of entries) {
			for (let i = 0; i < entry.count; i++) {
				const childId = graphStore.addChildStreaming(
					entry.parentId,
					entry.prompt,
					entry.prompt.length
				);
				if (childId) {
					requests.push({ id: childId, prompt: entry.prompt });
					buffers.set(childId, entry.prompt);
					prompts.set(childId, entry.prompt);
					rafScheduled.set(childId, false);
				}
			}
		}

		if (requests.length === 0) return;

		activeRequests += requests.length;

		function markError(id: string, message: string) {
			if (completed.has(id)) return;
			completed.add(id);
			rafScheduled.set(id, false);
			// Restore prompt text if no tokens were received
			const buf = buffers.get(id) ?? '';
			const prompt = prompts.get(id) ?? '';
			if (buf.length <= prompt.length) {
				graphStore.updateTextSilent(id, prompt);
			} else {
				graphStore.updateTextSilent(id, buf);
			}
			graphStore.setError(id, message);
			graphStore.setGenerating(id, false);
			activeRequests--;
		}

		function markDone(id: string) {
			if (completed.has(id)) return;
			completed.add(id);
			rafScheduled.set(id, false);
			const buf = buffers.get(id);
			if (buf != null) {
				graphStore.updateTextSilent(id, buf);
			}
			graphStore.setGenerating(id, false);
			activeRequests--;

			// Auto-embed the new node if enabled
			if (settingsStore.current.autoEmbedOnGenerate && settingsStore.current.embeddingApiKey) {
				setTimeout(() => embeddingStore.embedNode(id), 0);
			}
		}

		try {
			await fetchCompletionStreamBatch(requests, settings, {
				onToken(id: string, token: string) {
					const buf = buffers.get(id);
					if (buf == null) return;
					buffers.set(id, buf + token);
					if (!rafScheduled.get(id)) {
						rafScheduled.set(id, true);
						requestAnimationFrame(() => {
							rafScheduled.set(id, false);
							const current = buffers.get(id);
							if (current != null) {
								graphStore.updateTextSilent(id, current);
							}
						});
					}
				},
				onDone(id: string) {
					markDone(id);
					graphStore.persist();
				},
				onError(id: string, error: Error) {
					markError(id, error.message);
					graphStore.persist();
				}
			});
		} catch (err) {
			const message =
				err instanceof CompletionServiceError
					? err.message
					: err instanceof Error
						? err.message
						: 'Unknown error';
			for (const req of requests) {
				markError(req.id, message);
			}
		}

		// Catch orphaned requests that never received done/error
		let hadOrphans = false;
		for (const req of requests) {
			if (!completed.has(req.id)) {
				markError(req.id, 'Stream ended without response');
				hadOrphans = true;
			}
		}
		if (hadOrphans) graphStore.persist();
	}

	async function generateForNode(nodeId: string): Promise<void> {
		const settings = settingsStore.current;

		if (!settings.apiKey && settings.apiBaseUrl === 'https://api.openai.com/v1') {
			throw new Error('API key is required');
		}

		const prompt = graphStore.getPrompt(nodeId);
		if (!prompt.trim()) {
			throw new Error('Node has no text to generate from');
		}

		graphStore.setGenerating(nodeId, true);
		graphStore.setError(nodeId, undefined);

		await runBatchGeneration(
			[{ parentId: nodeId, prompt, count: settings.numGenerations }],
			settings
		);

		graphStore.setGenerating(nodeId, false);
	}

	async function generateAllLeaves(): Promise<void> {
		const settings = settingsStore.current;
		const nodes = graphStore.nodes;

		let leaves = nodes.filter(
			(n) => n.data.childIds.length === 0 && n.data.text.trim().length > 0
		);

		if (leaves.length === 0) return;

		const max = settings.maxLeafGenerations;
		if (leaves.length > max) {
			leaves = shuffle(leaves).slice(0, max);
		}

		isBulkGenerating = true;
		try {
			for (const leaf of leaves) {
				graphStore.setGenerating(leaf.id, true);
				graphStore.setError(leaf.id, undefined);
			}

			const entries = leaves.map((leaf) => ({
				parentId: leaf.id,
				prompt: graphStore.getPrompt(leaf.id),
				count: settings.numGenerations
			}));

			await runBatchGeneration(entries, settings);

			for (const leaf of leaves) {
				graphStore.setGenerating(leaf.id, false);
			}
		} finally {
			isBulkGenerating = false;
		}
	}

	return {
		get activeRequests() {
			return activeRequests;
		},
		get isBulkGenerating() {
			return isBulkGenerating;
		},
		generateForNode,
		generateAllLeaves
	};
}

export const generationStore = createGenerationStore();
