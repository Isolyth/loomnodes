<script lang="ts">
	import { onMount } from 'svelte';
	import type { LoomNodeData } from '$lib/types/node.js';
	import NodeToolbar from './NodeToolbar.svelte';
	import { graphStore } from '$lib/stores/graph.svelte.js';
	import { generationStore } from '$lib/stores/generation.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';

	interface Props {
		id: string;
		data: LoomNodeData;
	}

	let { id, data }: Props = $props();
	let nodeWidth = $derived(settingsStore.current.nodeWidth);
	let hovered = $state(false);
	let errorMessage = $state<string | null>(null);

	let textareaEl: HTMLTextAreaElement;
	let highlightEl: HTMLDivElement;

	let hasHighlight = $derived(data.generatedTextStart > 0 && data.generatedTextStart < data.text.length);

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
		syncScroll();
	}

	function syncScroll() {
		if (highlightEl && textareaEl) {
			highlightEl.scrollTop = textareaEl.scrollTop;
		}
	}

	onMount(() => {
		if (textareaEl && data.text.length > 0) {
			textareaEl.scrollTop = textareaEl.scrollHeight;
			syncScroll();
		}
	});

	let showToolbar = $derived(hovered || data.isGenerating);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative pt-9"
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
>
	<!-- Floating icon toolbar — top-right, above the card -->
	<div
		class="absolute top-0 right-0 z-10 transition-opacity"
		class:opacity-0={!showToolbar}
		class:pointer-events-none={!showToolbar}
	>
		<div class="flex items-center rounded-md bg-zinc-800/90 backdrop-blur-sm shadow-lg border border-zinc-700">
			<NodeToolbar
				isRoot={data.isRoot}
				isGenerating={data.isGenerating}
				ongenerate={handleGenerate}
				oncopy={handleCopy}
				ondelete={handleDelete}
			/>
		</div>
	</div>

	<!-- Card -->
	<div
		class="rounded-lg border bg-zinc-900 shadow-xl transition-shadow hover:shadow-2xl"
		class:border-indigo-500={data.isRoot}
		class:border-zinc-700={!data.isRoot}
		class:border-amber-500={data.isGenerating}
		style="width: {nodeWidth}px;"
	>
		<div class="p-3">
			{#if data.isRoot}
				<div class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
					Root
				</div>
			{/if}

			<div class="relative">
				{#if hasHighlight}
					<div
						bind:this={highlightEl}
						class="absolute inset-0 rounded p-2 text-sm font-mono whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
						style="color: transparent; line-height: 1.5; word-spacing: normal; letter-spacing: normal;"
						aria-hidden="true"
					><span>{data.text.slice(0, data.generatedTextStart)}</span><mark class="rounded" style="color: transparent; background: rgba(99, 102, 241, 0.15);">{data.text.slice(data.generatedTextStart)}</mark></div>
				{/if}

				<textarea
					bind:this={textareaEl}
					class="relative w-full resize-none rounded p-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
					class:bg-zinc-800={!hasHighlight}
					class:bg-transparent={hasHighlight}
					style="line-height: 1.5;"
					rows="7"
					placeholder={data.isRoot ? 'Enter your prompt...' : 'Generated text...'}
					value={data.text}
					oninput={handleTextInput}
					onscroll={syncScroll}
				></textarea>
			</div>

			{#if errorMessage}
				<div class="mt-1 text-xs text-red-400 truncate" title={errorMessage}>
					{errorMessage}
				</div>
			{/if}
		</div>
	</div>
</div>
