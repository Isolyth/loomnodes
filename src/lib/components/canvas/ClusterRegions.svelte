<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { embeddingStore } from '$lib/stores/embedding.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { computeConvexHull, expandHull, hullToSmoothPath } from '$lib/math/hull.js';

	interface Props {
		positions: Map<string, { x: number; y: number }>;
		viewLeft: number;
		viewTop: number;
		viewRight: number;
		viewBottom: number;
	}

	let { positions, viewLeft, viewTop, viewRight, viewBottom }: Props = $props();

	const PADDING = 80;

	interface RegionData {
		id: string;
		label: string;
		color: string;
		// For 3+ nodes: smooth hull path
		path: string | null;
		// For 1-2 nodes: circle/ellipse fallback
		cx: number;
		cy: number;
		rx: number;
		ry: number;
		labelX: number;
		labelY: number;
		bounds: { minX: number; minY: number; maxX: number; maxY: number };
	}

	let cachedRegions = $state.raw<RegionData[]>([]);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function recomputeRegions() {
		const show = untrack(() => settingsStore.current.showRegions);
		const cls = untrack(() => embeddingStore.clusters);
		const pos = untrack(() => positions);

		if (!show || cls.length === 0) {
			if (cachedRegions.length > 0) cachedRegions = [];
			return;
		}

		const regions: RegionData[] = [];

		for (const cluster of cls) {
			const points: [number, number][] = [];
			for (const nodeId of cluster.memberNodeIds) {
				const p = pos.get(nodeId);
				if (p) points.push([p.x, p.y]);
			}

			if (points.length === 0) continue;

			if (points.length === 1) {
				// Single node: draw a circle
				const [x, y] = points[0];
				const r = PADDING;
				regions.push({
					id: cluster.id,
					label: cluster.label,
					color: cluster.color,
					path: null,
					cx: x, cy: y, rx: r, ry: r,
					labelX: x,
					labelY: y - r - 12,
					bounds: { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r }
				});
				continue;
			}

			if (points.length === 2) {
				// Two nodes: draw an ellipse around both
				const [x1, y1] = points[0];
				const [x2, y2] = points[1];
				const cx = (x1 + x2) / 2;
				const cy = (y1 + y2) / 2;
				const dx = x2 - x1;
				const dy = y2 - y1;
				const half = Math.sqrt(dx * dx + dy * dy) / 2;
				const rx = half + PADDING;
				const ry = PADDING;
				regions.push({
					id: cluster.id,
					label: cluster.label,
					color: cluster.color,
					path: null,
					cx, cy, rx, ry,
					labelX: cx,
					labelY: cy - ry - 12,
					bounds: { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry }
				});
				continue;
			}

			// 3+ nodes: convex hull
			const hull = computeConvexHull(points);
			if (!hull) continue;

			const expanded = expandHull(hull, PADDING);
			const path = hullToSmoothPath(expanded, 30);

			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const [x, y] of expanded) {
				if (x < minX) minX = x;
				if (y < minY) minY = y;
				if (x > maxX) maxX = x;
				if (y > maxY) maxY = y;
			}

			regions.push({
				id: cluster.id,
				label: cluster.label,
				color: cluster.color,
				path,
				cx: 0, cy: 0, rx: 0, ry: 0,
				labelX: (minX + maxX) / 2,
				labelY: minY - 12,
				bounds: { minX, minY, maxX, maxY }
			});
		}

		cachedRegions = regions;
	}

	$effect(() => {
		embeddingStore.clusters;
		settingsStore.current.showRegions;
		recomputeRegions();
	});

	onMount(() => {
		intervalId = setInterval(recomputeRegions, 500);
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
</script>

{#each cachedRegions as region (region.id)}
	{#if region.bounds.maxX >= viewLeft && region.bounds.minX <= viewRight && region.bounds.maxY >= viewTop && region.bounds.minY <= viewBottom}
		<g>
			{#if region.path}
				<path
					d={region.path}
					fill={region.color}
					fill-opacity={settingsStore.current.regionOpacity}
					stroke={region.color}
					stroke-opacity={0.3}
					stroke-width={2}
				/>
			{:else}
				<ellipse
					cx={region.cx}
					cy={region.cy}
					rx={region.rx}
					ry={region.ry}
					fill={region.color}
					fill-opacity={settingsStore.current.regionOpacity}
					stroke={region.color}
					stroke-opacity={0.3}
					stroke-width={2}
				/>
			{/if}
			<text
				x={region.labelX}
				y={region.labelY}
				text-anchor="middle"
				fill={region.color}
				fill-opacity={0.6}
				font-size="14"
				font-weight="600"
				font-family="system-ui, sans-serif"
			>
				{region.label}
			</text>
		</g>
	{/if}
{/each}
