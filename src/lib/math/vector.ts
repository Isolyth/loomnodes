export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}

export function cosineDistance(a: number[], b: number[]): number {
	return 1 - cosineSimilarity(a, b);
}

export function centroid(vectors: number[][]): number[] {
	if (vectors.length === 0) return [];
	const dim = vectors[0].length;
	const sum = new Array(dim).fill(0);
	for (const v of vectors) {
		for (let i = 0; i < dim; i++) {
			sum[i] += v[i];
		}
	}
	const n = vectors.length;
	return sum.map((s) => s / n);
}

/** Fast non-cryptographic hash (FNV-1a) for cache invalidation */
export function textHash(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = (hash * 0x01000193) >>> 0;
	}
	return hash.toString(36);
}
