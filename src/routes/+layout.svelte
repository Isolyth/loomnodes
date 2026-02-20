<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Loomnodes</title>
</svelte:head>

<div class="h-screen w-screen bg-zinc-950">
	{@render children()}
</div>
