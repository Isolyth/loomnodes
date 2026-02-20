<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { graphStore } from '$lib/stores/graph.svelte.js';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	let settings = $derived(settingsStore.current);

	function handleChange(key: string, value: string | number) {
		settingsStore.update({ [key]: value });
	}

	function handleNumberChange(key: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const val = parseFloat(input.value);
		if (!isNaN(val)) {
			handleChange(key, val);
		}
	}

	function handleClearTree() {
		if (confirm('Clear the entire tree? This cannot be undone.')) {
			graphStore.clearAll();
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/40 z-40"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Escape' && onclose()}
	></div>

	<!-- Panel -->
	<div class="fixed right-0 top-0 h-full w-96 bg-zinc-900 border-l border-zinc-700 z-50 overflow-y-auto shadow-2xl">
		<div class="flex items-center justify-between p-4 border-b border-zinc-700">
			<h2 class="text-lg font-semibold text-zinc-100">Settings</h2>
			<button
				class="rounded p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
				onclick={onclose}
				aria-label="Close settings"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="p-4 space-y-5">
			<!-- API Key -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="apiKey">API Key</label>
				<input
					id="apiKey"
					type="password"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.apiKey}
					oninput={(e) => handleChange('apiKey', (e.target as HTMLInputElement).value)}
					placeholder="sk-..."
				/>
			</div>

			<!-- API Base URL -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="apiBaseUrl">API Base URL</label>
				<input
					id="apiBaseUrl"
					type="text"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.apiBaseUrl}
					oninput={(e) => handleChange('apiBaseUrl', (e.target as HTMLInputElement).value)}
				/>
			</div>

			<!-- Model -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="model">Model</label>
				<input
					id="model"
					type="text"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.model}
					oninput={(e) => handleChange('model', (e.target as HTMLInputElement).value)}
				/>
			</div>

			<!-- Provider (OpenRouter) -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="provider">Provider (OpenRouter)</label>
				<input
					id="provider"
					type="text"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.provider}
					oninput={(e) => handleChange('provider', (e.target as HTMLInputElement).value)}
					placeholder="e.g. together, deepinfra, groq"
				/>
				<p class="text-xs text-zinc-500 mt-1">Optional. Forces a specific provider slug on OpenRouter.</p>
			</div>

			<!-- Temperature -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="temperature">
					Temperature: {settings.temperature}
				</label>
				<input
					id="temperature"
					type="range"
					min="0"
					max="2"
					step="0.05"
					class="w-full accent-indigo-500"
					value={settings.temperature}
					oninput={(e) => handleNumberChange('temperature', e)}
				/>
			</div>

			<!-- Top P -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="topP">
					Top P: {settings.topP}
				</label>
				<input
					id="topP"
					type="range"
					min="0"
					max="1"
					step="0.05"
					class="w-full accent-indigo-500"
					value={settings.topP}
					oninput={(e) => handleNumberChange('topP', e)}
				/>
			</div>

			<!-- Max Tokens -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="maxTokens">Max Tokens</label>
				<input
					id="maxTokens"
					type="number"
					min="1"
					max="4096"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.maxTokens}
					oninput={(e) => handleNumberChange('maxTokens', e)}
				/>
			</div>

			<!-- Frequency Penalty -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="frequencyPenalty">
					Frequency Penalty: {settings.frequencyPenalty}
				</label>
				<input
					id="frequencyPenalty"
					type="range"
					min="-2"
					max="2"
					step="0.1"
					class="w-full accent-indigo-500"
					value={settings.frequencyPenalty}
					oninput={(e) => handleNumberChange('frequencyPenalty', e)}
				/>
			</div>

			<!-- Presence Penalty -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="presencePenalty">
					Presence Penalty: {settings.presencePenalty}
				</label>
				<input
					id="presencePenalty"
					type="range"
					min="-2"
					max="2"
					step="0.1"
					class="w-full accent-indigo-500"
					value={settings.presencePenalty}
					oninput={(e) => handleNumberChange('presencePenalty', e)}
				/>
			</div>

			<!-- Num Generations -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="numGenerations">Generations per node</label>
				<input
					id="numGenerations"
					type="number"
					min="1"
					max="10"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.numGenerations}
					oninput={(e) => handleNumberChange('numGenerations', e)}
				/>
			</div>

			<!-- Max Parallel Requests -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="maxParallelRequests">Max parallel requests</label>
				<input
					id="maxParallelRequests"
					type="number"
					min="1"
					max="20"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.maxParallelRequests}
					oninput={(e) => handleNumberChange('maxParallelRequests', e)}
				/>
			</div>

			<!-- Max Leaf Generations -->
			<div>
				<label class="block text-xs font-medium text-zinc-400 mb-1" for="maxLeafGenerations">Max leaf generations</label>
				<input
					id="maxLeafGenerations"
					type="number"
					min="1"
					max="50"
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
					value={settings.maxLeafGenerations}
					oninput={(e) => handleNumberChange('maxLeafGenerations', e)}
				/>
				<p class="text-xs text-zinc-500 mt-1">Max leaves to generate for when using "Generate All Leaves".</p>
			</div>

			<!-- Display -->
			<div class="border-t border-zinc-700 pt-4">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Display</h3>

				<div class="space-y-4">
					<!-- Node Width -->
					<div>
						<label class="block text-xs font-medium text-zinc-400 mb-1" for="nodeWidth">
							Node width: {settings.nodeWidth}px
						</label>
						<input
							id="nodeWidth"
							type="range"
							min="200"
							max="600"
							step="10"
							class="w-full accent-indigo-500"
							value={settings.nodeWidth}
							oninput={(e) => handleNumberChange('nodeWidth', e)}
						/>
					</div>
				</div>
			</div>

			<!-- Force Simulation -->
			<div class="border-t border-zinc-700 pt-4">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Physics</h3>

				<div class="space-y-4">
					<!-- Repulsion -->
					<div>
						<label class="block text-xs font-medium text-zinc-400 mb-1" for="forceRepulsion">
							Repulsion: {settings.forceRepulsion}
						</label>
						<input
							id="forceRepulsion"
							type="range"
							min="0"
							max="2000"
							step="50"
							class="w-full accent-indigo-500"
							value={settings.forceRepulsion}
							oninput={(e) => handleNumberChange('forceRepulsion', e)}
						/>
					</div>

					<!-- Link Distance -->
					<div>
						<label class="block text-xs font-medium text-zinc-400 mb-1" for="forceLinkDistance">
							Link distance: {settings.forceLinkDistance}
						</label>
						<input
							id="forceLinkDistance"
							type="range"
							min="50"
							max="800"
							step="10"
							class="w-full accent-indigo-500"
							value={settings.forceLinkDistance}
							oninput={(e) => handleNumberChange('forceLinkDistance', e)}
						/>
					</div>

					<!-- Link Strength -->
					<div>
						<label class="block text-xs font-medium text-zinc-400 mb-1" for="forceLinkStrength">
							Link strength: {settings.forceLinkStrength}
						</label>
						<input
							id="forceLinkStrength"
							type="range"
							min="0"
							max="2"
							step="0.05"
							class="w-full accent-indigo-500"
							value={settings.forceLinkStrength}
							oninput={(e) => handleNumberChange('forceLinkStrength', e)}
						/>
					</div>

					<!-- Center Gravity -->
					<div>
						<label class="block text-xs font-medium text-zinc-400 mb-1" for="forceCenterStrength">
							Center gravity: {settings.forceCenterStrength}
						</label>
						<input
							id="forceCenterStrength"
							type="range"
							min="0"
							max="0.2"
							step="0.005"
							class="w-full accent-indigo-500"
							value={settings.forceCenterStrength}
							oninput={(e) => handleNumberChange('forceCenterStrength', e)}
						/>
					</div>

					<!-- Settling Speed -->
					<div>
						<label class="block text-xs font-medium text-zinc-400 mb-1" for="forceAlphaDecay">
							Settling speed: {settings.forceAlphaDecay}
						</label>
						<input
							id="forceAlphaDecay"
							type="range"
							min="0.005"
							max="0.1"
							step="0.005"
							class="w-full accent-indigo-500"
							value={settings.forceAlphaDecay}
							oninput={(e) => handleNumberChange('forceAlphaDecay', e)}
						/>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="border-t border-zinc-700 pt-4 space-y-2">
				<button
					class="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
					onclick={() => settingsStore.reset()}
				>
					Reset settings to defaults
				</button>
				<button
					class="w-full rounded bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-400 hover:bg-red-900/50 transition-colors"
					onclick={handleClearTree}
				>
					Clear entire tree
				</button>
			</div>
		</div>
	</div>
{/if}
