import { graphStore } from './graph.svelte.js';
import { settingsStore } from './settings.svelte.js';
import { fetchCompletion, CompletionServiceError } from '$lib/services/completion.js';

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
		const numGenerations = settings.numGenerations;
		const maxParallel = settings.maxParallelRequests;

		const errors: string[] = [];

		// Process in batches respecting concurrency limit
		const tasks: (() => Promise<void>)[] = [];
		for (let i = 0; i < numGenerations; i++) {
			const index = i;
			tasks.push(async () => {
				activeRequests++;
				try {
					const text = await fetchCompletion(prompt, settings);
					graphStore.addChild(nodeId, prompt + text, prompt.length);
				} catch (err) {
					const message =
						err instanceof CompletionServiceError
							? err.message
							: err instanceof Error
								? err.message
								: 'Unknown error';
					errors.push(message);
					graphStore.addChild(nodeId, `[Error: ${message}]`, 0);
				} finally {
					activeRequests--;
				}
			});
		}

		// Run with concurrency limit
		const executing = new Set<Promise<void>>();
		for (const task of tasks) {
			const p = task();
			executing.add(p);
			p.finally(() => executing.delete(p));
			if (executing.size >= maxParallel) {
				await Promise.race(executing);
			}
		}
		await Promise.all(executing);

		graphStore.setGenerating(nodeId, false);
	}

	async function generateAllLeaves(): Promise<void> {
		const settings = settingsStore.current;
		const nodes = graphStore.nodes;

		// Find leaf nodes with non-empty text
		let leaves = nodes.filter(
			(n) => n.data.childIds.length === 0 && n.data.text.trim().length > 0
		);

		if (leaves.length === 0) return;

		// Randomly select up to maxLeafGenerations
		const max = settings.maxLeafGenerations;
		if (leaves.length > max) {
			leaves = shuffle(leaves).slice(0, max);
		}

		isBulkGenerating = true;
		try {
			await Promise.all(
				leaves.map((leaf) =>
					generateForNode(leaf.id).catch(() => {})
				)
			);
		} finally {
			isBulkGenerating = false;
		}
	}

	return {
		get activeRequests() { return activeRequests; },
		get isBulkGenerating() { return isBulkGenerating; },
		generateForNode,
		generateAllLeaves
	};
}

export const generationStore = createGenerationStore();
