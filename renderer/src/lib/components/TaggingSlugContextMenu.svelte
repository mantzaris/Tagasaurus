<!-- <script lang="ts">
	//
	const { saveFile } = $props<{ saveFile: () => void }>();

	//
	let menu = $state({ visible:false, x:0, y:0 });
	let menuEl = $state<HTMLElement | null>(null);     
	let pressTimer: ReturnType<typeof setTimeout>;
	let skipNextClick = false;                           

	import { tick } from 'svelte';

	/* --- open / close --- */
	async function open(cx: number, cy: number, swallowClick = false) {
		menu.visible = true;
		menu.x = cx; menu.y = cy;
		skipNextClick = swallowClick;
		await tick();            // DOM ready
		keepInsideViewport();
	}
	const close = () => (menu.visible = false);

	function keepInsideViewport() {
		if (!menuEl) return;
		const W = innerWidth, H = innerHeight;
		const w = menuEl.offsetWidth, h = menuEl.offsetHeight;
		if (menu.x + w > W) menu.x = Math.max(0, W - w);
		if (menu.y + h > H) menu.y = Math.max(0, H - h);
	}

	/* --- pointer helpers --- */
	function pointerDown(e: PointerEvent) {
		pressTimer = setTimeout(
			() => open(e.clientX, e.clientY, true),   // long-press swallows 1st click
			600
		);
	}
	const cancelPress = () => clearTimeout(pressTimer);

	function clickOutside(e: MouseEvent) {
		if (skipNextClick) { skipNextClick = false; return; }
		const el = e.target as HTMLElement | null;
		if (menu.visible && !el?.closest('.ctx-menu')) close();
	}
</script> -->

<!-- global listeners: use classic on:  to keep language servers happy -->
<!-- <svelte:window
	on:contextmenu|preventDefault={(e) => open(e.clientX, e.clientY)}
	on:pointerdown={pointerDown}
	on:pointerup={cancelPress}
	on:pointerleave={cancelPress}
	on:click={clickOutside}
	on:keydown={(e) => e.key === 'Escape' && close()}
/> -->

<!-- {#if menu.visible}
	<div  class="ctx-menu border rounded bg-light shadow-sm"
	      bind:this={menuEl}
	      style="position:fixed; left:{menu.x}px; top:{menu.y}px; z-index:9999;">
		<button class="dropdown-item"
		        onclick={() => { saveFile(); close(); }}>
			💾 Save file
		</button>
	</div>
{/if} -->

<!-- <style>
	.ctx-menu{min-width:140px;padding:.25rem 0;background:#fff;}
</style> -->
