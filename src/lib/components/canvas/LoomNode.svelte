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
	let nodeWidth = $derived(Math.round(settingsStore.current.nodeSize * 0.862));
	let nodeHeight = $derived(Math.round(settingsStore.current.nodeSize * 0.507));
	let fontSize = $derived(settingsStore.current.fontSize);
	let textareaRows = $derived(Math.max(3, Math.round((nodeHeight - 50) / (fontSize * 1.5))));
	let hovered = $state(false);
	let errorMessage = $state<string | null>(null);

	let textareaEl: HTMLTextAreaElement;
	let highlightEl: HTMLDivElement;

	let hasHighlight = $derived(data.generatedTextStart > 0 && data.generatedTextStart < data.text.length);
	let hasLogprobs = $derived(!data.isGenerating && data.logprobs && data.logprobs.length > 0);
	let showLogprobs = $state(false);

	function logprobToColor(logprob: number): string {
		// logprob 0 = 100% confident (bright green), -5+ = very uncertain (red)
		const p = Math.exp(logprob); // convert to probability [0,1]
		if (p >= 0.9) return 'rgba(74, 222, 128, 0.25)';   // green
		if (p >= 0.7) return 'rgba(163, 230, 53, 0.25)';    // lime
		if (p >= 0.5) return 'rgba(250, 204, 21, 0.25)';    // yellow
		if (p >= 0.3) return 'rgba(251, 146, 60, 0.25)';    // orange
		return 'rgba(248, 113, 113, 0.25)';                  // red
	}

	function handleGenerate() {
		errorMessage = null;
		graphStore.setError(id, undefined);
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

	$effect(() => {
		data.text; // track text changes
		if (data.isGenerating && textareaEl) {
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
		class:border-indigo-500={data.isRoot && !data.isGenerating && !data.error}
		class:border-zinc-700={!data.isRoot && !data.isGenerating && !data.error}
		class:border-amber-500={data.isGenerating && !data.error}
		class:border-red-500={!!data.error}
		style="width: {nodeWidth}px;"
	>
		{#if data.error}
			<div class="flex items-start gap-1.5 rounded-t-lg bg-red-950/80 px-3 py-1.5 text-xs text-red-300 border-b border-red-500/30">
				<span class="shrink-0 mt-px">&#x26A0;</span>
				<span class="truncate" title={data.error}>{data.error}</span>
			</div>
		{/if}
		<div class="p-3">
			<div class="flex items-center justify-between mb-1.5">
				{#if data.isRoot}
					<div class="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
						Root
					</div>
				{:else}
					<div></div>
				{/if}
				{#if hasLogprobs}
					<button
						class="text-[10px] px-1.5 py-0.5 rounded transition-colors"
						class:bg-zinc-700={!showLogprobs}
						class:text-zinc-400={!showLogprobs}
						class:bg-indigo-600={showLogprobs}
						class:text-indigo-100={showLogprobs}
						onclick={() => showLogprobs = !showLogprobs}
						title="Toggle logprobs view"
					>lp</button>
				{/if}
			</div>

			<div class="relative">
				{#if showLogprobs && hasLogprobs && data.logprobs}
					<!-- Logprobs view: tokens with hover tooltips -->
					<div
						class="w-full rounded p-2 bg-zinc-800 font-mono overflow-y-auto text-zinc-100"
						style="font-size: {fontSize}px; line-height: 1.5; height: {textareaRows * fontSize * 1.5 + 16}px;"
					><span class="text-zinc-400">{data.text.slice(0, data.generatedTextStart)}</span>{#each data.logprobs as lp}<span
							class="relative cursor-default rounded-sm hover:ring-1 hover:ring-indigo-400 group"
							style="background: {logprobToColor(lp.logprob)};"
						>{lp.token}<span
								class="pointer-events-none invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 min-w-[140px] max-w-[200px] rounded bg-zinc-950 border border-zinc-600 p-2 text-[10px] shadow-xl"
							><div class="font-semibold text-zinc-200 mb-1">{lp.logprob.toFixed(3)} ({(Math.exp(lp.logprob) * 100).toFixed(1)}%)</div>{#if lp.topLogprobs}{#each Object.entries(lp.topLogprobs).sort((a, b) => b[1] - a[1]).slice(0, 5) as [tok, prob]}<div class="flex justify-between gap-2 text-zinc-400"><span class="truncate text-zinc-300" title={JSON.stringify(tok)}>{tok.replace(/\n/g, '\\n')}</span><span>{(Math.exp(prob) * 100).toFixed(1)}%</span></div>{/each}{/if}</span></span>{/each}</div>
				{:else}
					{#if hasHighlight}
						<div
							bind:this={highlightEl}
							class="absolute inset-0 rounded p-2 font-mono whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
							style="color: transparent; font-size: {fontSize}px; line-height: 1.5; word-spacing: normal; letter-spacing: normal;"
							aria-hidden="true"
						><span>{data.text.slice(0, data.generatedTextStart)}</span><mark class="rounded" style="color: transparent; background: rgba(99, 102, 241, 0.15);">{data.text.slice(data.generatedTextStart)}</mark></div>
					{/if}

					<textarea
						bind:this={textareaEl}
						class="relative w-full resize-none rounded p-2 text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
						class:bg-zinc-800={!hasHighlight}
						class:bg-transparent={hasHighlight}
						style="font-size: {fontSize}px; line-height: 1.5;"
						rows={textareaRows}
						placeholder={data.isRoot ? 'Enter your prompt...' : 'Generated text...'}
						value={data.text}
						oninput={handleTextInput}
						onscroll={syncScroll}
					></textarea>
				{/if}
			</div>

			{#if errorMessage}
				<div class="mt-1 text-xs text-red-400 truncate" title={errorMessage}>
					{errorMessage}
				</div>
			{/if}
		</div>
	</div>
</div>
