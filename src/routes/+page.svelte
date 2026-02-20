<script lang="ts">
	import { onMount } from 'svelte';
	import LoomCanvas from '$lib/components/canvas/LoomCanvas.svelte';
	import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
	import { graphStore } from '$lib/stores/graph.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';

	let settingsOpen = $state(false);

	onMount(() => {
		settingsStore.init();
		graphStore.init();
	});
</script>

<div class="relative h-full w-full">
	<LoomCanvas />

	<!-- Settings toggle -->
	<button
		class="fixed top-4 right-4 z-30 rounded-lg bg-zinc-800 border border-zinc-700 p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 shadow-lg transition-colors"
		onclick={() => (settingsOpen = !settingsOpen)}
		title="Settings"
	>
		<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="3"></circle>
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
		</svg>
	</button>

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
