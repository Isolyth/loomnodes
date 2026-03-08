import { graphStore } from './graph.svelte.js';
import { settingsStore } from './settings.svelte.js';
import { embeddingStore } from './embedding.svelte.js';
import {
	fetchCompletionStreamBatch,
	CompletionServiceError
} from '$lib/services/completion.js';
import type { BatchStreamRequest, TokenLogprobData } from '$lib/services/completion.js';
import type { TokenLogprob } from '$lib/types/node.js';

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
		entries: { parentId: string; prompt: string; count: number; generatedTextStart?: number; cooldownStart?: number }[],
		settings: typeof settingsStore.current
	): Promise<void> {
		const requests: BatchStreamRequest[] = [];
		const buffers = new Map<string, string>();
		const prompts = new Map<string, string>();
		const rafScheduled = new Map<string, boolean>();
		const completed = new Set<string>();
		const logprobBuffers = new Map<string, TokenLogprob[]>();
		// Auto-loom tracking
		const parentIds = new Map<string, string>();
		const genStarts = new Map<string, number>();
		const tokenCounters = new Map<string, number>();

		for (const entry of entries) {
			for (let i = 0; i < entry.count; i++) {
				const genStart = entry.generatedTextStart ?? entry.prompt.length;
				const childId = graphStore.addChildStreaming(
					entry.parentId,
					entry.prompt,
					genStart
				);
				if (childId) {
					requests.push({ id: childId, prompt: entry.prompt });
					buffers.set(childId, entry.prompt);
					prompts.set(childId, entry.prompt);
					rafScheduled.set(childId, false);
					logprobBuffers.set(childId, []);
					parentIds.set(childId, entry.parentId);
					genStarts.set(childId, genStart);
					tokenCounters.set(childId, entry.cooldownStart ?? 0);
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
			// Store accumulated logprobs
			const lps = logprobBuffers.get(id);
			if (lps && lps.length > 0) {
				graphStore.setLogprobs(id, lps);
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
				onToken(id: string, token: string, logprobData?: TokenLogprobData) {
					const buf = buffers.get(id);
					if (buf == null) return;
					const newBuf = buf + token;
					buffers.set(id, newBuf);
					// Accumulate logprob data for this token
					if (logprobData) {
						const lpBuf = logprobBuffers.get(id);
						if (lpBuf) {
							lpBuf.push({
								token,
								logprob: logprobData.logprob,
								topLogprobs: logprobData.topLogprobs
							});
						}
					}

					// Auto-loom: cooldown primes, then next uncertain token triggers
					// Read autoLoom live from settingsStore so toggling it off takes effect immediately
					if (settingsStore.current.autoLoom && logprobData?.topLogprobs) {
						const count = (tokenCounters.get(id) ?? 0) + 1;
						tokenCounters.set(id, count);
						const primed = count >= settings.autoLoomCooldown;

						if (primed) {
							const threshold = settings.autoLoomThreshold / 100;
							const genStart = genStarts.get(id)!;

							const branches: { parentId: string; prompt: string; count: number; generatedTextStart: number }[] = [];
							for (const [altToken, altLogprob] of Object.entries(logprobData.topLogprobs)) {
								if (altToken === token) continue;
								const altProb = Math.exp(altLogprob);
								if (altProb >= threshold) {
									// Branch is a child of THIS node, with text up to this point + alt token
									branches.push({
										parentId: id,
										prompt: buf + altToken,
										count: 1,
										generatedTextStart: newBuf.length
									});
								}
							}

							if (branches.length > 0) {
								// Reset cooldown only when we actually branch
								tokenCounters.set(id, 0);
								// Fire-and-forget branch generations
								runBatchGeneration(branches, settings).catch(() => {});
							}
						}
					}

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
