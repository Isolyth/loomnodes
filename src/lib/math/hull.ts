import { polygonHull } from 'd3-polygon';

export function computeConvexHull(points: [number, number][]): [number, number][] | null {
	if (points.length < 3) return null;
	return polygonHull(points);
}

/** Offset each hull edge outward by `padding` pixels */
export function expandHull(hull: [number, number][], padding: number): [number, number][] {
	const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
	const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;

	return hull.map(([x, y]) => {
		const dx = x - cx;
		const dy = y - cy;
		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		return [x + (dx / len) * padding, y + (dy / len) * padding] as [number, number];
	});
}

/** Generate a smooth SVG path with rounded corners from hull vertices */
export function hullToSmoothPath(hull: [number, number][], cornerRadius: number): string {
	const n = hull.length;
	if (n < 3) return '';

	const r = cornerRadius;
	const parts: string[] = [];

	for (let i = 0; i < n; i++) {
		const prev = hull[(i - 1 + n) % n];
		const curr = hull[i];
		const next = hull[(i + 1) % n];

		// Vectors from current to prev and next
		const dx1 = prev[0] - curr[0];
		const dy1 = prev[1] - curr[1];
		const dx2 = next[0] - curr[0];
		const dy2 = next[1] - curr[1];

		const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
		const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;

		// Clamp radius so it doesn't exceed half the edge length
		const maxR = Math.min(len1 / 2, len2 / 2, r);

		// Points where the curve starts and ends
		const startX = curr[0] + (dx1 / len1) * maxR;
		const startY = curr[1] + (dy1 / len1) * maxR;
		const endX = curr[0] + (dx2 / len2) * maxR;
		const endY = curr[1] + (dy2 / len2) * maxR;

		if (i === 0) {
			parts.push(`M ${startX} ${startY}`);
		} else {
			parts.push(`L ${startX} ${startY}`);
		}

		// Quadratic Bezier through the corner vertex
		parts.push(`Q ${curr[0]} ${curr[1]} ${endX} ${endY}`);
	}

	// Close: line back to the start curve point
	const first = hull[0];
	const last = hull[n - 1];
	const next = hull[1];
	const dx1 = last[0] - first[0];
	const dy1 = last[1] - first[1];
	const dx2 = next[0] - first[0];
	const dy2 = next[1] - first[1];
	const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
	const maxR = Math.min(len1 / 2, r);
	const closeX = first[0] + (dx1 / len1) * maxR;
	const closeY = first[1] + (dy1 / len1) * maxR;
	parts.push(`L ${closeX} ${closeY}`);
	parts.push('Z');

	return parts.join(' ');
}
