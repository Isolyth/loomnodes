export interface DBSCANResult {
	clusters: number[][];
	noise: number[];
}

/**
 * Precompute cosine distance matrix using flat Float32Arrays.
 * Precomputes norms to avoid redundant sqrt calls.
 */
function buildCosineDistanceMatrix(vectors: number[][], n: number): Float32Array {
	const dim = vectors[0].length;
	const dist = new Float32Array(n * n);

	// Precompute norms
	const norms = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		let s = 0;
		const v = vectors[i];
		for (let d = 0; d < dim; d++) s += v[d] * v[d];
		norms[i] = Math.sqrt(s);
	}

	// Upper triangle only, mirror
	for (let i = 0; i < n; i++) {
		const vi = vectors[i];
		const ni = norms[i];
		for (let j = i + 1; j < n; j++) {
			const vj = vectors[j];
			let dot = 0;
			for (let d = 0; d < dim; d++) dot += vi[d] * vj[d];
			const denom = ni * norms[j];
			const cosine = denom === 0 ? 0 : dot / denom;
			const d = 1 - cosine;
			dist[i * n + j] = d;
			dist[j * n + i] = d;
		}
	}

	return dist;
}

export function dbscan(
	vectors: number[][],
	epsilon: number,
	minPoints: number
): DBSCANResult {
	const n = vectors.length;
	if (n === 0) return { clusters: [], noise: [] };

	const labels = new Int32Array(n).fill(-1); // -1 = unvisited
	const NOISE = -2;
	let clusterId = 0;

	const dist = buildCosineDistanceMatrix(vectors, n);

	function regionQuery(idx: number): number[] {
		const neighbors: number[] = [];
		const offset = idx * n;
		for (let j = 0; j < n; j++) {
			if (dist[offset + j] <= epsilon) {
				neighbors.push(j);
			}
		}
		return neighbors;
	}

	for (let i = 0; i < n; i++) {
		if (labels[i] !== -1) continue;

		const neighbors = regionQuery(i);
		if (neighbors.length < minPoints) {
			labels[i] = NOISE;
			continue;
		}

		const cid = clusterId++;
		labels[i] = cid;

		const queue = neighbors.slice();
		let qi = 0;
		while (qi < queue.length) {
			const j = queue[qi++];
			if (labels[j] === NOISE) labels[j] = cid;
			if (labels[j] !== -1) continue;
			labels[j] = cid;

			const jNeighbors = regionQuery(j);
			if (jNeighbors.length >= minPoints) {
				for (const k of jNeighbors) {
					if (labels[k] <= -1) queue.push(k);
				}
			}
		}
	}

	const clusterMap = new Map<number, number[]>();
	const noise: number[] = [];
	for (let i = 0; i < n; i++) {
		if (labels[i] === NOISE) {
			noise.push(i);
		} else {
			let arr = clusterMap.get(labels[i]);
			if (!arr) {
				arr = [];
				clusterMap.set(labels[i], arr);
			}
			arr.push(i);
		}
	}

	return { clusters: [...clusterMap.values()], noise };
}
