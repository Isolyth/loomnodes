<script lang="ts">
	import type { LoomNodeData } from '$lib/types/node.js';
	import NodeToolbar from './NodeToolbar.svelte';
	import { graphStore } from '$lib/stores/graph.svelte.js';
	import { generationStore } from '$lib/stores/generation.svelte.js';

	interface Props {
		id: string;
		data: LoomNodeData;
	}

	let { id, data }: Props = $props();
	let hovered = $state(false);
	let errorMessage = $state<string | null>(null);

	function handleGenerate() {
		errorMessage = null;
		generationStore.generateForNode(id).catch((err: Error) => {
			errorMessage = err.message;
		});
	}

	function handleCopy() {
		const prompt = graphStore.getPrompt(id);
		navigator.clipboard.writeText(prompt).catch(() => {});
	}

	function handleDelete() {
		graphStore.deleteNode(id);
	}

	function handleTextInput(e: Event) {
		const textarea = e.target as HTMLTextAreaElement;
		graphStore.updateText(id, textarea.value);
	}

	let showToolbar = $derived(hovered || data.isGenerating);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="rounded-lg border bg-zinc-900 shadow-xl transition-shadow hover:shadow-2xl"
	class:border-indigo-500={data.isRoot}
	class:border-zinc-700={!data.isRoot}
	class:border-amber-500={data.isGenerating}
	style="width: 280px;"
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
>
	<!-- Toolbar -->
	<div
		class="flex justify-center p-1.5 border-b border-zinc-700/50 transition-opacity"
		class:opacity-0={!showToolbar}
		class:pointer-events-none={!showToolbar}
	>
		<NodeToolbar
			isRoot={data.isRoot}
			isGenerating={data.isGenerating}
			ongenerate={handleGenerate}
			oncopy={handleCopy}
			ondelete={handleDelete}
		/>
	</div>

	<div class="p-2">
		{#if data.isRoot}
			<div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
				Root
			</div>
		{/if}

		<textarea
			class="w-full resize-none rounded bg-zinc-800 p-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
			rows="5"
			placeholder={data.isRoot ? 'Enter your prompt...' : 'Generated text...'}
			value={data.text}
			oninput={handleTextInput}
		></textarea>

		{#if errorMessage}
			<div class="mt-1 text-xs text-red-400 truncate" title={errorMessage}>
				{errorMessage}
			</div>
		{/if}
	</div>
</div>
