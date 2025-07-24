<!-- SpinnerSimple.svelte -->
<script lang="ts">
	/* props */
	let {
		message = 'Processing…',
		color   = '#00ff88',  // any CSS color
		busy    = false,
		block   = true
	} = $props();

	/* pointer‑events toggled by prop */
	const overlayStyle = $derived(`pointer-events:${block ? 'auto' : 'none'};`);

	/* make colour & size available to CSS via custom properties */
	const cssVars = $derived(`--sp-color:${color}; --sp-size:25vmin;`);
</script>

{#if busy}
	<div class="overlay" style={overlayStyle + cssVars}>
		<div class="spinner"></div>
		<p class="msg">{message}</p>
	</div>
{/if}

<style>
	.overlay{
		position:fixed; inset:0;
		display:flex; flex-direction:column;
		justify-content:center; align-items:center;
		background:rgba(0,0,0,.25);   /* dim backdrop */
		z-index:9999;
	}

	.spinner{
		width:var(--sp-size); height:var(--sp-size);
		border-radius:50%;
		border:8px solid transparent;          /* faint ring */
		border-top-color:var(--sp-color);      /* coloured cap */
		animation:spin .8s linear infinite, flash 1.2s ease-in-out infinite;
	}

	.msg{
		margin-top:1rem;
		font-weight:600;
		color:var(--sp-color);
		animation:flash 1.2s ease-in-out infinite;   /* same pulse as ring */
		text-align:center;
	}

	@keyframes spin  { to { transform:rotate(360deg); } }
	@keyframes flash { 0%,100%{opacity:1;} 50%{opacity:.3;} }
</style>
