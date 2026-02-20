<script lang="ts">
	import Spinner from '$lib/components/ui/Spinner.svelte';

	interface Props {
		isRoot: boolean;
		isGenerating: boolean;
		ongenerate: () => void;
		oncopy: () => void;
		ondelete: () => void;
	}

	let { isRoot, isGenerating, ongenerate, oncopy, ondelete }: Props = $props();
</script>

<div class="flex items-center gap-0.5">
	<button
		class="rounded p-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
		onclick={ongenerate}
		disabled={isGenerating}
		title="Generate completions"
	>
		{#if isGenerating}
			<Spinner />
		{:else}
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
			</svg>
		{/if}
	</button>

	<button
		class="rounded p-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
		onclick={oncopy}
		title="Copy full text"
	>
		<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
		</svg>
	</button>

	{#if !isRoot}
		<button
			class="rounded p-1.5 text-red-400 hover:text-red-300 hover:bg-zinc-700 transition-colors"
			onclick={ondelete}
			title="Delete node and descendants"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="3,6 5,6 21,6"></polyline>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
			</svg>
		</button>
	{/if}
</div>
