import type { Cluster, QualityDefinition } from '$lib/types/embedding.js';
import { graphStore } from './graph.svelte.js';
import { settingsStore } from './settings.svelte.js';
import { getPromptForNode } from '$lib/graph/tree.js';
import { fetchEmbeddings } from '$lib/services/embedding.js';
import { textHash, cosineSimilarity, centroid } from '$lib/math/vector.js';
import { dbscan } from '$lib/math/dbscan.js';
import { createId } from '$lib/utils/id.js';
import { saveEmbeddings, loadEmbeddings } from '$lib/utils/persistence.js';

const CLUSTER_COLORS = [
	'#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
	'#ef4444', '#06b6d4', '#84cc16', '#f97316', '#a855f7',
	'#10b981', '#e11d48'
];

// Texts per single API call
const BATCH_SIZE = 128;
// Concurrent API calls in flight
const MAX_CONCURRENT = 8;

interface StoredEmbedding {
	vector: number[];
	textHash: string;
}

interface SerializedState {
	embeddings: Record<string, StoredEmbedding>;
	clusters: Cluster[];
	qualities: QualityDefinition[];
}

function createEmbeddingStore() {
	let embeddings = $state.raw<Map<string, StoredEmbedding>>(new Map());
	let clusters = $state.raw<Cluster[]>([]);
	let qualities = $state.raw<QualityDefinition[]>([]);
	let isEmbedding = $state(false);
	let embeddingProgress = $state({ done: 0, total: 0 });

	// Derived: nodeId -> clusterId for fast lookup
	let nodeClusterMap = $derived.by(() => {
		const map = new Map<string, string>();
		for (const cluster of clusters) {
			for (const nodeId of cluster.memberNodeIds) {
				map.set(nodeId, cluster.id);
			}
		}
		return map;
	});

	// --- Persistence (debounced, skips embeddings to keep it small) ---
	let persistTimer: ReturnType<typeof setTimeout> | null = null;
	let persistEmbeddingsTimer: ReturnType<typeof setTimeout> | null = null;

	/** Persist clusters + qualities (small, frequent) */
	function persistMeta() {
		if (persistTimer !== null) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			persistTimer = null;
			const data: SerializedState = {
				embeddings: Object.fromEntries(embeddings),
				clusters,
				qualities
			};
			saveEmbeddings(data);
		}, 500);
	}

	/** Persist everything including embeddings (large, infrequent) */
	function persistAll() {
		if (persistEmbeddingsTimer !== null) clearTimeout(persistEmbeddingsTimer);
		persistEmbeddingsTimer = setTimeout(() => {
			persistEmbeddingsTimer = null;
			const data: SerializedState = {
				embeddings: Object.fromEntries(embeddings),
				clusters,
				qualities
			};
			saveEmbeddings(data);
		}, 2000);
	}

	function init() {
		const saved = loadEmbeddings<SerializedState>();
		if (saved) {
			embeddings = new Map(Object.entries(saved.embeddings || {}));
			clusters = saved.clusters || [];
			qualities = saved.qualities || [];
		}
	}

	/** Find all nodes whose path text has changed since last embedding */
	function getDirtyNodeIds(): string[] {
		const dirty: string[] = [];
		const nodesMap = graphStore.nodeDataMap;
		for (const [nodeId] of nodesMap) {
			const pathText = getPromptForNode(nodeId, nodesMap);
			if (!pathText.trim()) continue;
			const hash = textHash(pathText);
			const existing = embeddings.get(nodeId);
			if (!existing || existing.textHash !== hash) {
				dirty.push(nodeId);
			}
		}
		return dirty;
	}

	/** Embed all nodes that need updating, with concurrent API calls */
	async function embedAllDirty(): Promise<void> {
		const settings = settingsStore.current;
		const nodesMap = graphStore.nodeDataMap;
		const dirty = getDirtyNodeIds();

		if (dirty.length === 0) return;

		isEmbedding = true;
		embeddingProgress = { done: 0, total: dirty.length };

		// Build all batches upfront
		const batches: { ids: string[]; texts: string[]; hashes: string[] }[] = [];
		for (let i = 0; i < dirty.length; i += BATCH_SIZE) {
			const ids = dirty.slice(i, i + BATCH_SIZE);
			const texts = ids.map((id) => getPromptForNode(id, nodesMap));
			const hashes = texts.map((t) => textHash(t));
			batches.push({ ids, texts, hashes });
		}

		let done = 0;
		const workingMap = new Map(embeddings);

		// Process batches with concurrency limit
		let batchIndex = 0;

		async function processBatch() {
			while (batchIndex < batches.length) {
				const idx = batchIndex++;
				const batch = batches[idx];
				const results = await fetchEmbeddings(batch.texts, settings);
				for (let j = 0; j < batch.ids.length; j++) {
					workingMap.set(batch.ids[j], {
						vector: results[j].embedding,
						textHash: batch.hashes[j]
					});
				}
				done += batch.ids.length;
				embeddingProgress = { done, total: dirty.length };
			}
		}

		try {
			const workers = Math.min(MAX_CONCURRENT, batches.length);
			await Promise.all(Array.from({ length: workers }, () => processBatch()));
			embeddings = workingMap;
			persistAll();
		} finally {
			isEmbedding = false;
		}
	}

	/** Embed a single node (e.g., after generation completes) */
	async function embedNode(nodeId: string): Promise<void> {
		const settings = settingsStore.current;
		if (!settings.embeddingApiKey && !settings.embeddingApiBaseUrl) return;

		const nodesMap = graphStore.nodeDataMap;
		const pathText = getPromptForNode(nodeId, nodesMap);
		if (!pathText.trim()) return;

		const hash = textHash(pathText);
		const existing = embeddings.get(nodeId);
		if (existing && existing.textHash === hash) return;

		try {
			const results = await fetchEmbeddings([pathText], settings);
			if (results.length > 0) {
				const newMap = new Map(embeddings);
				newMap.set(nodeId, { vector: results[0].embedding, textHash: hash });
				embeddings = newMap;
				persistAll();
			}
		} catch {
			// Silently fail for auto-embed
		}
	}

	/** Run DBSCAN auto-clustering on current embeddings */
	function runAutoClustering(): void {
		const settings = settingsStore.current;
		const entries = [...embeddings.entries()];
		if (entries.length < settings.dbscanMinPoints) {
			clusters = [];
			persistMeta();
			return;
		}

		const nodeIds = entries.map(([id]) => id);
		const vectors = entries.map(([, e]) => e.vector);

		const result = dbscan(vectors, settings.dbscanEpsilon, settings.dbscanMinPoints);

		clusters = result.clusters.map((memberIndices, i) => ({
			id: createId(),
			label: `Cluster ${i + 1}`,
			color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
			memberNodeIds: memberIndices.map((idx) => nodeIds[idx]),
			centroid: centroid(memberIndices.map((idx) => vectors[idx])),
			isUserDefined: false
		}));

		persistMeta();
	}

	// Common English stop words to skip when extracting keywords
	const STOP_WORDS = new Set([
		'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
		'of', 'with', 'by', 'from', 'is', 'it', 'as', 'was', 'are', 'be',
		'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
		'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
		'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him',
		'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
		'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
		'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very',
		'just', 'about', 'up', 'out', 'all', 'also', 'into', 'over',
		'after', 'before', 'between', 'each', 'more', 'some', 'such',
		'only', 'other', 'new', 'now', 'way', 'because', 'any', 'there',
		'here', 'both', 'through', 'during', 'most', 'same', 'well',
		'back', 'even', 'still', 'own', 'said', 'one', 'two', 'like',
	]);

	/** Extract top keywords from cluster member texts as a label */
	function labelClusters(): void {
		const nodesMap = graphStore.nodeDataMap;

		clusters = clusters.map((cluster) => {
			if (cluster.isUserDefined) return cluster;

			// Collect words from member node texts (own text, not full path)
			const wordFreq = new Map<string, number>();
			for (const nodeId of cluster.memberNodeIds) {
				const data = nodesMap.get(nodeId);
				if (!data) continue;
				const words = data.text
					.toLowerCase()
					.replace(/[^a-z0-9\s'-]/g, ' ')
					.split(/\s+/)
					.filter((w) => w.length > 2 && !STOP_WORDS.has(w));

				const seen = new Set<string>();
				for (const w of words) {
					if (!seen.has(w)) {
						seen.add(w);
						wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
					}
				}
			}

			// Sort by frequency, take top 2-3
			const sorted = [...wordFreq.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([w]) => w[0].toUpperCase() + w.slice(1));

			const label = sorted.length > 0 ? sorted.join(', ') : cluster.label;
			return { ...cluster, label };
		});

		persistMeta();
	}

	/** Add a user-defined quality and embed its description */
	async function addQuality(description: string): Promise<void> {
		const settings = settingsStore.current;

		const results = await fetchEmbeddings([description], settings);
		if (results.length === 0) throw new Error('Failed to embed quality description');

		const colorIndex = qualities.length % CLUSTER_COLORS.length;
		const quality: QualityDefinition = {
			id: createId(),
			description,
			embedding: results[0].embedding,
			color: CLUSTER_COLORS[colorIndex]
		};

		qualities = [...qualities, quality];
		persistMeta();
	}

	function removeQuality(qualityId: string): void {
		qualities = qualities.filter((q) => q.id !== qualityId);
		clusters = clusters.filter((c) => !c.isUserDefined || c.id !== qualityId);
		persistMeta();
	}

	/** Score all nodes against all qualities and build quality-based clusters */
	function assignQualityClusters(): void {
		const settings = settingsStore.current;
		const threshold = settings.qualityThreshold;

		const qualityClusters = new Map<string, string[]>();

		for (const [nodeId, emb] of embeddings) {
			let bestQuality: QualityDefinition | null = null;
			let bestScore = -Infinity;

			for (const quality of qualities) {
				const score = cosineSimilarity(emb.vector, quality.embedding);
				if (score > bestScore && score >= threshold) {
					bestScore = score;
					bestQuality = quality;
				}
			}

			if (bestQuality) {
				const members = qualityClusters.get(bestQuality.id) || [];
				members.push(nodeId);
				qualityClusters.set(bestQuality.id, members);
			}
		}

		clusters = qualities
			.filter((q) => qualityClusters.has(q.id))
			.map((q) => {
				const memberNodeIds = qualityClusters.get(q.id)!;
				const memberVectors = memberNodeIds
					.map((id) => embeddings.get(id)?.vector)
					.filter((v): v is number[] => v != null);
				return {
					id: q.id,
					label: q.description,
					color: q.color,
					memberNodeIds,
					centroid: centroid(memberVectors),
					isUserDefined: true
				};
			});

		persistMeta();
	}

	function removeNode(nodeId: string): void {
		if (!embeddings.has(nodeId)) return;
		const newMap = new Map(embeddings);
		newMap.delete(nodeId);
		embeddings = newMap;

		clusters = clusters
			.map((c) => ({
				...c,
				memberNodeIds: c.memberNodeIds.filter((id) => id !== nodeId)
			}))
			.filter((c) => c.memberNodeIds.length > 0);

		persistMeta();
	}

	function clearAll(): void {
		embeddings = new Map();
		clusters = [];
		qualities = [];
		persistMeta();
	}

	return {
		get embeddings() { return embeddings; },
		get clusters() { return clusters; },
		get qualities() { return qualities; },
		get nodeClusterMap() { return nodeClusterMap; },
		get isEmbedding() { return isEmbedding; },
		get embeddingProgress() { return embeddingProgress; },
		init,
		embedAllDirty,
		embedNode,
		runAutoClustering,
		labelClusters,
		addQuality,
		removeQuality,
		assignQualityClusters,
		removeNode,
		clearAll
	};
}

export const embeddingStore = createEmbeddingStore();
