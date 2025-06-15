<script lang="ts">
	export let saveFile: () => void;

	let show = false, x = 0, y = 0;
	let pressTimer: ReturnType<typeof setTimeout>;
	let ignoreNextClick = false;
	let menuEl: HTMLElement;

	import { tick } from 'svelte';

	//
	async function open(cx: number, cy: number, skipFirstClick = false) {
		x = cx; y = cy; show = true;
		ignoreNextClick = skipFirstClick;        
		await tick();
		clampIntoViewport();
	}
	const close = () => (show = false);

	function clampIntoViewport() {
		if (!menuEl) return;
		const W = innerWidth,  H = innerHeight;
		const w = menuEl.offsetWidth, h = menuEl.offsetHeight;
		if (x + w > W) x = Math.max(0, W - w);
		if (y + h > H) y = Math.max(0, H - h);
	}

	//
	function down(e: PointerEvent) {
		pressTimer = setTimeout(
			() => open(e.clientX, e.clientY, true),   // skip first click
			600
		);
	}
	const cancel = () => clearTimeout(pressTimer);

	function clickOutside(e: MouseEvent) {
		if (ignoreNextClick) { ignoreNextClick = false; return; }
		const el = e.target as HTMLElement | null;
		if (show && !el?.closest('.ctx-menu')) close();
	}
</script>

<svelte:window
	on:contextmenu|preventDefault={(e) => open(e.clientX, e.clientY)}
	on:pointerdown={down}
	on:pointerup={cancel}
	on:pointerleave={cancel}
	on:click={clickOutside}
	on:keydown={(e) => e.key === 'Escape' && close()}
/>

{#if show}
	<div class="ctx-menu border rounded bg-light shadow-sm"
	     bind:this={menuEl}
	     style="position:fixed; left:{x}px; top:{y}px; z-index:9999;">
		<button class="dropdown-item"
		        on:click={() => { saveFile(); close(); }}>
			💾 Save file
		</button>
	</div>
{/if}

<style>
	.ctx-menu{min-width:140px;padding:.25rem 0;background:#fff;}
</style>
