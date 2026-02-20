<div class="spinner" role="status" aria-label="Loading">
	<div class="spinner-ring"></div>
</div>

<style>
	.spinner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.spinner-ring {
		width: 16px;
		height: 16px;
		border: 2px solid #e5e7eb;
		border-top-color: #6366f1;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
