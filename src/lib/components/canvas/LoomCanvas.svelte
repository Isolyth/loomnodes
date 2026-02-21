<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
	import type { Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
	import LoomNode from './LoomNode.svelte';
	import { graphStore } from '$lib/stores/graph.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { computeLayout } from '$lib/graph/layout.js';

	// ---- Simulation types ----
	interface SimNode extends SimulationNodeDatum {
		id: string;
		fx?: number | null;
		fy?: number | null;
	}

	interface SimLink extends SimulationLinkDatum<SimNode> {
		source: string | SimNode;
		target: string | SimNode;
	}

	interface Props {
		resetKey?: number;
	}

	let { resetKey = 0 }: Props = $props();

	let NODE_W = $derived(Math.round(settingsStore.current.nodeSize * 0.862));
	let NODE_H = $derived(Math.round(settingsStore.current.nodeSize * 0.507));

	// ---- Viewport (pan / zoom) ----
	let vx = $state(0);
	let vy = $state(0);
	let vscale = $state(1);

	// ---- Container dimensions (for viewport culling) ----
	let containerW = $state(0);
	let containerH = $state(0);

	// ---- Level of detail: render lightweight placeholders when zoomed out ----
	let useLOD = $derived(NODE_W * vscale < settingsStore.current.lodThreshold);

	// ---- Viewport bounds in world coordinates (with margin for smooth pop-in) ----
	const CULL_MARGIN = 100;
	let viewLeft = $derived((-vx / vscale) - CULL_MARGIN);
	let viewTop = $derived((-vy / vscale) - CULL_MARGIN);
	let viewRight = $derived(((containerW - vx) / vscale) + CULL_MARGIN);
	let viewBottom = $derived(((containerH - vy) / vscale) + CULL_MARGIN);

	// ---- Positions coming out of d3-force ----
	let positions = $state.raw<Map<string, { x: number; y: number }>>(new Map());

	// ---- Simulation state ----
	let sim: Simulation<SimNode, SimLink> | null = null;
	let simNodes: SimNode[] = [];
	// Fast lookup for drag operations
	let simNodeMap = new Map<string, SimNode>();

	// ---- Refs ----
	let container: HTMLDivElement;

	// ---- Interaction state ----
	let isPanning = $state(false);
	let panAnchorX = 0;
	let panAnchorY = 0;
	let panStartVx = 0;
	let panStartVy = 0;

	let dragId: string | null = null;
	let hoveredId: string | null = null;

	// ---- Animation state ----
	let animFrameId: number | null = null;
	const ANIM_DURATION = 300; // ms

	function animateTo(target: Map<string, { x: number; y: number }>) {
		if (animFrameId != null) cancelAnimationFrame(animFrameId);

		const from = new Map<string, { x: number; y: number }>();
		for (const [id, pos] of target) {
			const old = positions.get(id);
			from.set(id, old ? { ...old } : { ...pos });
		}

		const start = performance.now();

		function tick(now: number) {
			const t = Math.min((now - start) / ANIM_DURATION, 1);
			// ease-out cubic
			const e = 1 - (1 - t) * (1 - t) * (1 - t);

			const m = new Map<string, { x: number; y: number }>();
			for (const [id, to] of target) {
				const f = from.get(id) ?? to;
				m.set(id, {
					x: f.x + (to.x - f.x) * e,
					y: f.y + (to.y - f.y) * e
				});
			}
			positions = m;

			if (t < 1) {
				animFrameId = requestAnimationFrame(tick);
			} else {
				animFrameId = null;
			}
		}

		animFrameId = requestAnimationFrame(tick);
	}

	// ---- Build / rebuild layout on structure or mode change ----
	let prevViewMode: 'graph' | 'tree' = 'graph';

	function rebuildLayout() {
		const nodes = graphStore.nodes;
		const edges = graphStore.edges;
		const s = settingsStore.current;

		if (s.viewMode === 'tree') {
			sim?.stop();
			sim = null;

			const newPositions = computeLayout(nodes, edges, NODE_W, NODE_H);
			const wasModeSwitch = prevViewMode !== 'tree';
			prevViewMode = 'tree';

			if (wasModeSwitch) {
				animateTo(newPositions);
			} else {
				const root = nodes.find((n) => n.data.isRoot);
				if (root) {
					const oldRoot = positions.get(root.id);
					const newRoot = newPositions.get(root.id);
					if (oldRoot && newRoot) {
						vx += (oldRoot.x - newRoot.x) * vscale;
						vy += (oldRoot.y - newRoot.y) * vscale;
					}
				}
				animateTo(newPositions);
			}
			return;
		}

		prevViewMode = 'graph';
		if (animFrameId != null) {
			cancelAnimationFrame(animFrameId);
			animFrameId = null;
		}

		// Graph mode: D3-force simulation
		const old = positions;

		const seed = new Map<string, { x: number; y: number }>();
		if (old.size === 0) {
			const queue: string[] = [];
			for (const n of nodes) {
				if (n.data.isRoot) {
					seed.set(n.id, { x: 0, y: 0 });
					queue.push(n.id);
				}
			}
			while (queue.length > 0) {
				const id = queue.shift()!;
				const parent = seed.get(id)!;
				const node = nodes.find((n) => n.id === id);
				if (!node) continue;
				for (const childId of node.data.childIds) {
					seed.set(childId, {
						x: parent.x + (Math.random() - 0.5) * 60,
						y: parent.y + 250
					});
					queue.push(childId);
				}
			}
		}

		simNodes = nodes.map((n) => {
			const prev = old.get(n.id) ?? seed.get(n.id);
			const parentPos = n.data.parentId ? old.get(n.data.parentId) : null;
			return {
				id: n.id,
				x: prev?.x ?? (parentPos ? parentPos.x + (Math.random() - 0.5) * 60 : 0),
				y: prev?.y ?? (parentPos ? parentPos.y + 250 : 0),
				...(n.data.isRoot ? { fx: 0, fy: 0 } : {})
			} satisfies SimNode;
		});

		// Rebuild simNode lookup map
		simNodeMap = new Map<string, SimNode>();
		for (const sn of simNodes) simNodeMap.set(sn.id, sn);

		const simLinks: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }));

		sim?.stop();

		const leafIds = new Set(nodes.filter((n) => n.data.childIds.length === 0).map((n) => n.id));
		const leafStrength = (d: SimNode) => leafIds.has(d.id) ? -s.forceLeafRepulsion : 0;

		sim = forceSimulation<SimNode, SimLink>(simNodes)
			.force(
				'link',
				forceLink<SimNode, SimLink>(simLinks)
					.id((d) => d.id)
					.distance(s.forceLinkDistance)
					.strength(s.forceLinkStrength)
			)
			.force('charge', forceManyBody().strength(-s.forceRepulsion))
			.force('collide', forceCollide(s.nodeSize * 0.5).strength(0.8))
			.force('x', forceX(0).strength(s.forceCenterStrength))
			.force('y', forceY(0).strength(s.forceCenterStrength))
			.force('leafX', forceX<SimNode>(0).strength(leafStrength))
			.force('leafY', forceY<SimNode>(0).strength(leafStrength))
			.alphaDecay(s.forceAlphaDecay)
			.on('tick', () => {
				const m = new Map<string, { x: number; y: number }>();
				for (const sn of simNodes) {
					m.set(sn.id, { x: sn.x ?? 0, y: sn.y ?? 0 });
				}
				positions = m;
			});
	}

	// Rebuild on structure change, view mode change, or position reset
	let lastResetKey = 0;
	$effect(() => {
		graphStore.structureVersion;
		settingsStore.current.viewMode;
		const rk = resetKey;
		untrack(() => {
			if (rk !== lastResetKey) {
				lastResetKey = rk;
				positions = new Map();
				if (container) {
					const rect = container.getBoundingClientRect();
					vx = rect.width / 2;
					vy = rect.height / 3;
					vscale = 1;
				}
			}
			rebuildLayout();
		});
	});

	// Update forces live when settings change (only in graph mode)
	$effect(() => {
		const s = settingsStore.current;
		s.forceRepulsion; s.forceLinkDistance; s.forceLinkStrength; s.forceCenterStrength; s.forceAlphaDecay; s.forceLeafRepulsion; s.nodeSize;

		untrack(() => {
			if (!sim || s.viewMode !== 'graph') return;
			const linkForce = sim.force('link') as ReturnType<typeof forceLink> | undefined;
			if (linkForce) {
				linkForce.distance(s.forceLinkDistance).strength(s.forceLinkStrength);
			}
			const chargeForce = sim.force('charge') as ReturnType<typeof forceManyBody> | undefined;
			if (chargeForce) {
				chargeForce.strength(-s.forceRepulsion);
			}
			const collideForce = sim.force('collide') as ReturnType<typeof forceCollide> | undefined;
			if (collideForce) {
				collideForce.radius(s.nodeSize * 0.5).strength(0.8);
			}
			const xForce = sim.force('x') as ReturnType<typeof forceX> | undefined;
			if (xForce) {
				xForce.strength(s.forceCenterStrength);
			}
			const yForce = sim.force('y') as ReturnType<typeof forceY> | undefined;
			if (yForce) {
				yForce.strength(s.forceCenterStrength);
			}
			const nodes = graphStore.nodes;
			const leafIds = new Set(nodes.filter((n) => n.data.childIds.length === 0).map((n) => n.id));
			const leafStrength = (d: SimNode) => leafIds.has(d.id) ? -s.forceLeafRepulsion : 0;
			const leafXForce = sim.force('leafX') as ReturnType<typeof forceX<SimNode>> | undefined;
			if (leafXForce) {
				leafXForce.strength(leafStrength);
			}
			const leafYForce = sim.force('leafY') as ReturnType<typeof forceY<SimNode>> | undefined;
			if (leafYForce) {
				leafYForce.strength(leafStrength);
			}
			sim.alphaDecay(s.forceAlphaDecay);
			sim.alpha(0.5).restart();
		});
	});

	// ---- Zoom (wheel) ----
	function onWheel(e: WheelEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('textarea, input, select')) return;

		e.preventDefault();
		const rect = container.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		const ns = Math.min(Math.max(vscale * factor, 0.05), 4);

		vx = mx - ((mx - vx) * ns) / vscale;
		vy = my - ((my - vy) * ns) / vscale;
		vscale = ns;
	}

	// ---- Pointer events (pan + drag) ----
	function onDown(e: PointerEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('button, textarea, input, select, a')) return;

		const nodeEl = t.closest('[data-node-id]') as HTMLElement | null;

		if (nodeEl && settingsStore.current.viewMode === 'graph') {
			dragId = nodeEl.dataset.nodeId!;
			const pos = clientToWorld(e.clientX, e.clientY);
			const sn = simNodeMap.get(dragId);
			if (sn) {
				sn.fx = pos.x;
				sn.fy = pos.y;
				sim?.alpha(0.3).restart();
			}
		} else if (!nodeEl) {
			isPanning = true;
			panAnchorX = e.clientX;
			panAnchorY = e.clientY;
			panStartVx = vx;
			panStartVy = vy;
		}
		container.setPointerCapture(e.pointerId);
	}

	function onMove(e: PointerEvent) {
		if (dragId) {
			const pos = clientToWorld(e.clientX, e.clientY);
			const sn = simNodeMap.get(dragId);
			if (sn) {
				sn.fx = pos.x;
				sn.fy = pos.y;
				sim?.alpha(0.3).restart();
			}
		} else if (isPanning) {
			vx = panStartVx + (e.clientX - panAnchorX);
			vy = panStartVy + (e.clientY - panAnchorY);
		}
	}

	function onUp(e: PointerEvent) {
		if (dragId) {
			const sn = simNodeMap.get(dragId);
			const nd = graphStore.nodes.find((n) => n.id === dragId);
			if (sn && nd && !nd.data.isRoot && hoveredId !== dragId) {
				sn.fx = null;
				sn.fy = null;
			}
			dragId = null;
		}
		if (isPanning) {
			isPanning = false;
		}
		container.releasePointerCapture(e.pointerId);
	}

	// ---- Hover pin (freeze hovered node in physics) ----
	function onNodeEnter(id: string) {
		if (settingsStore.current.viewMode !== 'graph') return;
		hoveredId = id;
		const sn = simNodeMap.get(id);
		if (sn && sn.fx == null) {
			sn.fx = sn.x;
			sn.fy = sn.y;
		}
	}

	function onNodeLeave(id: string) {
		if (hoveredId !== id) return;
		hoveredId = null;
		if (dragId === id) return; // still dragging, keep pinned
		const nd = graphStore.nodes.find((n) => n.id === id);
		if (nd?.data.isRoot) return; // root stays pinned
		const sn = simNodeMap.get(id);
		if (sn) {
			sn.fx = null;
			sn.fy = null;
		}
	}

	// ---- Helpers ----
	function clientToWorld(cx: number, cy: number) {
		const rect = container.getBoundingClientRect();
		return {
			x: (cx - rect.left - vx) / vscale,
			y: (cy - rect.top - vy) / vscale
		};
	}

	// Center viewport on mount + track container size
	let resizeObserver: ResizeObserver | null = null;

	onMount(() => {
		const rect = container.getBoundingClientRect();
		vx = rect.width / 2;
		vy = rect.height / 3;
		containerW = rect.width;
		containerH = rect.height;

		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerW = entry.contentRect.width;
				containerH = entry.contentRect.height;
			}
		});
		resizeObserver.observe(container);
	});

	onDestroy(() => {
		sim?.stop();
		if (animFrameId != null) cancelAnimationFrame(animFrameId);
		resizeObserver?.disconnect();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={container}
	class="absolute inset-0 overflow-hidden select-none"
	class:cursor-grabbing={isPanning}
	class:cursor-grab={!isPanning && !dragId}
	onwheel={onWheel}
	onpointerdown={onDown}
	onpointermove={onMove}
	onpointerup={onUp}
>
	<!-- Dot-grid background (moves with viewport) -->
	<div
		class="absolute inset-0 pointer-events-none"
		style="
			background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
			background-size: {20 * vscale}px {20 * vscale}px;
			background-position: {vx}px {vy}px;
		"
	></div>

	<!-- Viewport transform -->
	<div
		class="absolute top-0 left-0 origin-top-left"
		style="transform: translate({vx}px, {vy}px) scale({vscale})"
	>
		<!-- Edge layer (SVG) -->
		<svg class="absolute top-0 left-0 overflow-visible pointer-events-none" width="0" height="0">
			{#each graphStore.edges as edge (edge.id)}
				{@const sp = positions.get(edge.source)}
				{@const tp = positions.get(edge.target)}
				{#if sp && tp && (
					(sp.x >= viewLeft && sp.x <= viewRight && sp.y >= viewTop && sp.y <= viewBottom) ||
					(tp.x >= viewLeft && tp.x <= viewRight && tp.y >= viewTop && tp.y <= viewBottom)
				)}
					<line
						x1={sp.x}
						y1={sp.y}
						x2={tp.x}
						y2={tp.y}
						stroke="#525252"
						stroke-width={2}
					/>
				{/if}
			{/each}
		</svg>

		<!-- Node layer -->
		{#each graphStore.nodes as node (node.id)}
			{@const pos = positions.get(node.id)}
			{#if pos && pos.x >= viewLeft - NODE_W && pos.x <= viewRight + NODE_W && pos.y >= viewTop - NODE_H && pos.y <= viewBottom + NODE_H}
				{#if useLOD}
					<!-- Lightweight placeholder when zoomed out -->
					<div
						class="absolute rounded-lg border"
						class:border-indigo-500={node.data.isRoot}
						class:border-amber-500={node.data.isGenerating}
						class:border-zinc-600={!node.data.isRoot && !node.data.isGenerating}
						style="
							transform: translate({pos.x - NODE_W / 2}px, {pos.y - NODE_H / 2}px);
							width: {NODE_W}px;
							height: {NODE_H}px;
							background: {node.data.isGenerating ? '#78350f' : '#27272a'};
						"
						data-node-id={node.id}
						onpointerenter={() => onNodeEnter(node.id)}
						onpointerleave={() => onNodeLeave(node.id)}
					></div>
				{:else}
					<div
						class="absolute"
						style="transform: translate({pos.x - NODE_W / 2}px, {pos.y - NODE_H / 2}px)"
						data-node-id={node.id}
						onpointerenter={() => onNodeEnter(node.id)}
						onpointerleave={() => onNodeLeave(node.id)}
					>
						<LoomNode id={node.id} data={node.data} />
					</div>
				{/if}
			{/if}
		{/each}
	</div>
</div>
