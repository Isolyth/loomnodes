<script lang="ts">
	import { onMount } from 'svelte';
	import LoomCanvas from '$lib/components/canvas/LoomCanvas.svelte';
	import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
	import { graphStore } from '$lib/stores/graph.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { generationStore } from '$lib/stores/generation.svelte.js';

	let settingsOpen = $state(false);

	let totalNodes = $derived(graphStore.nodes.length);
	let leafNodes = $derived(graphStore.nodes.filter((n) => n.data.childIds.length === 0));
	let leafCount = $derived(leafNodes.length);
	let nonLeafCount = $derived(totalNodes - leafCount);
	let totalWords = $derived(
		graphStore.nodes.reduce((sum, n) => {
			const words = n.data.text.trim().split(/\s+/).filter(Boolean);
			return sum + words.length;
		}, 0)
	);

	onMount(() => {
		settingsStore.init();
		graphStore.init();
	});

	function handleGenerateAllLeaves() {
		generationStore.generateAllLeaves().catch(() => {});
	}

	function handleExport() {
		const json = graphStore.exportGraph();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `loomnodes-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	let fileInput: HTMLInputElement;

	function handleImport() {
		fileInput.click();
	}

	function toggleViewMode() {
		settingsStore.update({
			viewMode: settingsStore.current.viewMode === 'graph' ? 'tree' : 'graph'
		});
	}

	function handleFileSelected(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				graphStore.importGraph(reader.result as string);
			} catch (err) {
				alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
			}
		};
		reader.readAsText(file);
		(e.target as HTMLInputElement).value = '';
	}
</script>

<div class="relative h-full w-full">
	<LoomCanvas />

	<!-- Stats counters -->
	<div class="fixed top-4 left-4 z-30 rounded-lg bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 px-3 py-2 shadow-lg">
		<div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-zinc-400">
			<span>Leaves</span>       <span class="text-zinc-200 text-right">{leafCount}</span>
			<span>Non-leaf</span>     <span class="text-zinc-200 text-right">{nonLeafCount}</span>
			<span>Total nodes</span>  <span class="text-zinc-200 text-right">{totalNodes}</span>
			<span>Total words</span>  <span class="text-zinc-200 text-right">{totalWords.toLocaleString()}</span>
		</div>
	</div>

	<!-- Hidden file input for import -->
	<input
		bind:this={fileInput}
		type="file"
		accept=".json"
		class="hidden"
		onchange={handleFileSelected}
	/>

	<!-- Top-right toolbar -->
	<div class="fixed top-4 right-4 z-30 flex items-center gap-2">
		<!-- Import -->
		<button
			class="rounded-lg bg-zinc-800 border border-zinc-700 p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 shadow-lg transition-colors"
			onclick={handleImport}
			title="Import graph"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
		</button>

		<!-- Export -->
		<button
			class="rounded-lg bg-zinc-800 border border-zinc-700 p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 shadow-lg transition-colors"
			onclick={handleExport}
			title="Export graph"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
		</button>

		<!-- View Mode Toggle -->
		<button
			class="rounded-lg bg-zinc-800 border border-zinc-700 p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 shadow-lg transition-colors"
			onclick={toggleViewMode}
			title={settingsStore.current.viewMode === 'graph' ? 'Switch to tree view' : 'Switch to graph view'}
		>
			{#if settingsStore.current.viewMode === 'graph'}
				<!-- Tree icon -->
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="9" y="2" width="6" height="4" rx="1" />
					<rect x="2" y="18" width="6" height="4" rx="1" />
					<rect x="9" y="18" width="6" height="4" rx="1" />
					<rect x="16" y="18" width="6" height="4" rx="1" />
					<line x1="12" y1="6" x2="12" y2="12" />
					<line x1="5" y1="12" x2="19" y2="12" />
					<line x1="5" y1="12" x2="5" y2="18" />
					<line x1="12" y1="12" x2="12" y2="18" />
					<line x1="19" y1="12" x2="19" y2="18" />
				</svg>
			{:else}
				<!-- Graph icon -->
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="6" y1="6" x2="18" y2="8" />
					<line x1="6" y1="6" x2="12" y2="18" />
					<line x1="18" y1="8" x2="12" y2="18" />
					<circle cx="6" cy="6" r="3" fill="currentColor" />
					<circle cx="18" cy="8" r="3" fill="currentColor" />
					<circle cx="12" cy="18" r="3" fill="currentColor" />
				</svg>
			{/if}
		</button>

		<!-- Generate All Leaves -->
		<button
			class="rounded-lg bg-zinc-800 border border-zinc-700 p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 shadow-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
			onclick={handleGenerateAllLeaves}
			disabled={generationStore.isBulkGenerating}
			title="Generate all leaves (max {settingsStore.current.maxLeafGenerations})"
		>
			{#if generationStore.isBulkGenerating}
				<svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
				</svg>
			{:else}
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
				</svg>
			{/if}
		</button>

		<!-- Settings toggle -->
		<button
			class="rounded-lg bg-zinc-800 border border-zinc-700 p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 shadow-lg transition-colors"
			onclick={() => (settingsOpen = !settingsOpen)}
			title="Settings"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="3"></circle>
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
			</svg>
		</button>
	</div>

	<!-- API key warning -->
	{#if !settingsStore.current.apiKey && settingsStore.current.apiBaseUrl === 'https://api.openai.com/v1'}
		<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-lg bg-amber-900/80 border border-amber-700 px-4 py-2.5 text-sm text-amber-200 shadow-lg">
			No API key set.
			<button class="underline ml-1 hover:text-amber-100" onclick={() => (settingsOpen = true)}>
				Open settings
			</button>
		</div>
	{/if}

	<SettingsPanel open={settingsOpen} onclose={() => (settingsOpen = false)} />
</div>
