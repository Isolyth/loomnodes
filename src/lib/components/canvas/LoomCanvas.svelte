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

	let NODE_W = $derived(Math.round(settingsStore.current.nodeSize * 0.862));
	let NODE_H = $derived(Math.round(settingsStore.current.nodeSize * 0.507));

	// ---- Viewport (pan / zoom) ----
	let vx = $state(0);
	let vy = $state(0);
	let vscale = $state(1);

	// ---- Positions coming out of d3-force ----
	let positions = $state.raw<Map<string, { x: number; y: number }>>(new Map());

	// ---- Simulation state ----
	let sim: Simulation<SimNode, SimLink> | null = null;
	let simNodes: SimNode[] = [];

	// ---- Refs ----
	let container: HTMLDivElement;

	// ---- Interaction state ----
	let isPanning = $state(false);
	let panAnchorX = 0;
	let panAnchorY = 0;
	let panStartVx = 0;
	let panStartVy = 0;

	let dragId: string | null = null;

	// ---- Build / rebuild layout on structure or mode change ----
	function rebuildLayout() {
		const nodes = graphStore.nodes;
		const edges = graphStore.edges;
		const s = settingsStore.current;

		if (s.viewMode === 'tree') {
			sim?.stop();
			sim = null;
			positions = computeLayout(nodes, edges, NODE_W, NODE_H);
			return;
		}

		// Graph mode: D3-force simulation
		const old = positions;

		simNodes = nodes.map((n) => {
			const prev = old.get(n.id);
			const parentPos = n.data.parentId ? old.get(n.data.parentId) : null;
			return {
				id: n.id,
				x: prev?.x ?? (parentPos ? parentPos.x + (Math.random() - 0.5) * 60 : 0),
				y: prev?.y ?? (parentPos ? parentPos.y + 250 : 0),
				...(n.data.isRoot ? { fx: 0, fy: 0 } : {})
			} satisfies SimNode;
		});

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

	// Rebuild on structure change or view mode change
	$effect(() => {
		graphStore.structureVersion;
		settingsStore.current.viewMode;
		untrack(() => rebuildLayout());
	});

	// Update forces live when settings change (only in graph mode)
	$effect(() => {
		const s = settingsStore.current;
		// Touch all force settings to subscribe
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

		// Zoom toward cursor
		vx = mx - ((mx - vx) * ns) / vscale;
		vy = my - ((my - vy) * ns) / vscale;
		vscale = ns;
	}

	// ---- Pointer events (pan + drag) ----
	function onDown(e: PointerEvent) {
		// Ignore if on interactive element
		const t = e.target as HTMLElement;
		if (t.closest('button, textarea, input, select, a')) return;

		const nodeEl = t.closest('[data-node-id]') as HTMLElement | null;

		if (nodeEl && settingsStore.current.viewMode === 'graph') {
			// Start dragging a node (graph mode only)
			dragId = nodeEl.dataset.nodeId!;
			const pos = clientToWorld(e.clientX, e.clientY);
			const sn = simNodes.find((n) => n.id === dragId);
			if (sn) {
				sn.fx = pos.x;
				sn.fy = pos.y;
				sim?.alpha(0.3).restart();
			}
		} else if (!nodeEl) {
			// Start panning (on empty canvas)
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
			const sn = simNodes.find((n) => n.id === dragId);
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
			const sn = simNodes.find((n) => n.id === dragId);
			const nd = graphStore.nodes.find((n) => n.id === dragId);
			if (sn && nd && !nd.data.isRoot) {
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

	// ---- Helpers ----
	function clientToWorld(cx: number, cy: number) {
		const rect = container.getBoundingClientRect();
		return {
			x: (cx - rect.left - vx) / vscale,
			y: (cy - rect.top - vy) / vscale
		};
	}

	// Center viewport on mount
	onMount(() => {
		const rect = container.getBoundingClientRect();
		vx = rect.width / 2;
		vy = rect.height / 3;
	});

	onDestroy(() => {
		sim?.stop();
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
				{#if sp && tp}
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
			{#if pos}
				<div
					class="absolute"
					style="transform: translate({pos.x - NODE_W / 2}px, {pos.y - NODE_H / 2}px)"
					data-node-id={node.id}
				>
					<LoomNode id={node.id} data={node.data} />
				</div>
			{/if}
		{/each}
	</div>
</div>
