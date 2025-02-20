<!-- <script>
	import { onMount } from 'svelte';

	let deferredPrompt = null;
	let showInstallPopup = false;

	onMount(() => {
		window.addEventListener('beforeinstallprompt', (e) => {
			// Empêche l'affichage automatique de l'invite
			e.preventDefault();
			// Stocke l'événement pour pouvoir l'appeler plus tard
			deferredPrompt = e;
			// Affiche la pop-up d'installation
			showInstallPopup = true;
		});
	});

	function handleInstallClick() {
		if (deferredPrompt) {
			// Affiche l'invite d'installation
			deferredPrompt.prompt();
			// Attendre le choix de l'utilisateur
			deferredPrompt.userChoice.then((choiceResult) => {
				if (choiceResult.outcome === 'accepted') {
					console.log('User accepted the install prompt');
				} else {
					console.log('User dismissed the install prompt');
				}
				deferredPrompt = null;
				showInstallPopup = false; // Cache la pop-up après l'interaction
			});
		}
	}

	function closePopup() {
		showInstallPopup = false;
	}
</script>

<div>
	<!-- Autres éléments de votre application -->

	<!-- {#if showInstallPopup}
		<div class="popup">
			<div class="popup-content">
				<p>Installez notre application pour une meilleure expérience !</p>
				<button on:click={handleInstallClick}>Installer</button>
				<button class="close-button" on:click={closePopup}>Fermer</button>
			</div>
		</div>
	{/if}
</div>

<h1>Installation</h1>

<style>
	.popup {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
    height: 400px;
    width: 100%;
	}

	.popup-content {
		background-color: white;
		padding: 20px;
		border-radius: 10px;
		text-align: center;
    height: 400px;
    width: 100%;
	}

	.popup-content button {
		padding: 10px 20px;
		font-size: 16px;
		cursor: pointer;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 5px;
		margin-top: 10px;
	}

	.popup-content .close-button {
		background-color: #ccc;
		margin-top: 10px;
	}
</style> --> -->
