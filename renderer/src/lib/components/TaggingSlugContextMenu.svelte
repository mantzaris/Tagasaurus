<script lang="ts">
	//
	export let saveFile: () => void;

	//
	let show = false, x = 0, y = 0;
	let pressTimer: ReturnType<typeof setTimeout>;
	let menuEl: HTMLElement;
    let ignoreNextClick = false;

	import { onMount, onDestroy, tick } from 'svelte';

	//  open / close 
	async function open(cx: number, cy: number) {
		x = cx; y = cy; show = true;
        ignoreNextClick = true;
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

	/* ---------- global listeners ---------- */
	function context(e: MouseEvent) {
		e.preventDefault();
		open(e.clientX, e.clientY);
	}
	function down(e: PointerEvent) {
		pressTimer = setTimeout(() => open(e.clientX, e.clientY), 600);
	}
	const cancel = () => clearTimeout(pressTimer);

	function clickOutside(e: MouseEvent) {
		// const el = e.target as HTMLElement | null;        
		// if (show && !el?.closest('.ctx-menu')) close();

    if (ignoreNextClick) {       
        ignoreNextClick = false;
        return;
    }
    const el = e.target as HTMLElement | null;
    if (show && !el?.closest('.ctx-menu')) close();


	}
	const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();

	onMount(() => {
		addEventListener('contextmenu', context);
		addEventListener('pointerdown', down);
		addEventListener('pointerup', cancel);
		addEventListener('pointerleave', cancel);
		addEventListener('click', clickOutside);
		addEventListener('keydown', esc);
	});
	onDestroy(() => {
		removeEventListener('contextmenu', context);
		removeEventListener('pointerdown', down);
		removeEventListener('pointerup', cancel);
		removeEventListener('pointerleave', cancel);
		removeEventListener('click', clickOutside);
		removeEventListener('keydown', esc);
	});
</script>

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
