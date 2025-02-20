<script>
	import { onMount } from 'svelte';
	import Header from '../components/Header.svelte';
	import { fade } from 'svelte/transition';

	let map;
	let polyline;
	let marker;
	let watchId = null;
	let isTracking = false;
	let isCalculating = false; // Initialisé à false
	let positions = [];
	let totalDistance = 0;
	let distanceDisplay = '0.000 km'; // Affichage de la distance avec trois décimales
	let speedDisplay = '0.0 km/h'; // Affichage de la vitesse
	let lastPositionTime = null;
	let showPopup = false;
	let speedHistory = [];
	const maxSpeedHistory = 5; // Nombre de valeurs à conserver pour le lissage
	let deferredPrompt; // Allows to show the install prompt
	let installButton = false;



  function installApp() {
    console.log(1);
		if (deferredPrompt) {
			deferredPrompt.prompt(); // Affiche le prompt
			deferredPrompt.userChoice.then((choiceResult) => {
				if (choiceResult.outcome === 'accepted') {
					console.log('User accepted the install prompt');
				} else {
					console.log('User dismissed the install prompt');
				}
				deferredPrompt = null; // Nettoie l'événement après usage
			});
		}
	}


	onMount(async () => {
		if (typeof window !== 'undefined') {

      window.addEventListener('beforeinstallprompt', (e) => {
		console.log('beforeinstallprompt fired');
		e.preventDefault(); // Empêche l'affichage automatique de la bannière
		deferredPrompt = e; // Stocke l'événement
		installButton = true; // Déclenche la réactivité dans Svelte
	});

  window.addEventListener("appinstalled", evt => {
  console.log("appinstalled fired", evt);
  alert("L'application a été installée avec succès !");
  installButton = false;
});


	

			// Vérifiez si l'application a déjà été installée
			const isInstalled = localStorage.getItem('pwa-installed');
			if (!isInstalled) {
				showPopup = true;
			}

			// Écoutez l'événement appinstalled
			window.addEventListener('appinstalled', () => {
				hidePopup();
			});

			function hidePopup() {
				showPopup = false;
				// Marquer l'application comme installée
				localStorage.setItem('pwa-installed', 'true');
			}

			const L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');

			map = L.map('map').setView([48.8566, 2.3522], 13);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxZoom: 18
			}).addTo(map);

			polyline = L.polyline([], { color: 'blue' }).addTo(map);

			// Définir une icône personnalisée pour le marqueur
			const customIcon = L.icon({
				iconUrl: '/pointer2.png', // Remplacez par le chemin de votre icône
				iconSize: [25, 25],
				iconAnchor: [12, 41],
				popupAnchor: [1, -34],
				shadowSize: [41, 41]
			});

			// Afficher la position de l'utilisateur sans démarrer le calcul
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition((position) => {
					const { latitude, longitude } = position.coords;
					const latlng = [latitude, longitude];
					marker = L.marker(latlng, { icon: customIcon }).addTo(map);
					map.setView(latlng, 13);
				}, onError);
			}
		}
	});

	async function startTracking() {
		if (typeof window !== 'undefined' && navigator.geolocation) {
			isCalculating = true;
			watchId = navigator.geolocation.watchPosition(onPositionReceived, onError, {
				enableHighAccuracy: true,
				maximumAge: 0
			});
		} else {
			alert("La géolocalisation n'est pas supportée par votre navigateur.");
		}
	}

	function togglePauseTracking() {
		if (isCalculating) {
			if (watchId) {
				navigator.geolocation.clearWatch(watchId);
				watchId = null;
			}
		} else {
			startTracking();
		}
		isCalculating = !isCalculating;
	}

	function resetTracking() {
		positions = [];
		totalDistance = 0;
		distanceDisplay = '0.000 km';
		speedDisplay = '0.0 km/h';
		polyline.setLatLngs([]);
		if (marker) {
			marker.setLatLng([0, 0]); // Réinitialiser la position du marqueur
		}
		lastPositionTime = null;
		speedHistory = []; // Réinitialiser l'historique des vitesses
	}

	function finishTracking() {
		if (watchId) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
		isCalculating = false;
		alert(`Distance totale parcourue : ${totalDistance.toFixed(3)} km`);
	}

	function onPositionReceived(position) {
		const { latitude, longitude } = position.coords;
		const latlng = [latitude, longitude];
		const currentTime = new Date().getTime();
		positions.push(latlng);

		if (marker) {
			marker.setLatLng(latlng);
		} else {
			marker = L.marker(latlng).addTo(map);
		}

		polyline.addLatLng(latlng);
		map.setView(latlng, 13);

		if (positions.length > 1) {
			const prevLatLng = positions[positions.length - 2];
			const distance = getDistanceFromLatLonInKm(prevLatLng[0], prevLatLng[1], latitude, longitude);
			totalDistance += distance;
			distanceDisplay = totalDistance.toFixed(3) + ' km'; // Mettre à jour l'affichage de la distance

			if (lastPositionTime) {
				const timeDiff = (currentTime - lastPositionTime) / 1000; // en secondes
				const speed = (distance / timeDiff) * 3600; // en km/h
				speedHistory.push(speed);

				if (speedHistory.length > maxSpeedHistory) {
					speedHistory.shift(); // Retirer la valeur la plus ancienne
				}

				// Calculer la moyenne des vitesses
				const avgSpeed = speedHistory.reduce((sum, speed) => sum + speed, 0) / speedHistory.length;
				speedDisplay = avgSpeed.toFixed(1) + ' km/h';
			}

			lastPositionTime = currentTime;
		}
	}

	function onError(error) {
		console.error('Erreur de géolocalisation :', error);
	}

	function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
		const R = 6371; // Rayon de la Terre en km
		const dLat = deg2rad(lat2 - lat1);
		const dLon = deg2rad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c; // Distance en km
	}

	function deg2rad(deg) {
		return deg * (Math.PI / 180);
	}

	function display() {
		showPopup = false;
	}
</script>

<main>
	<Header />
	<div id="map"></div>

	{#if installButton}
		<button on:click={installApp}>Install</button>
	{/if}

	<!-- {#if showPopup}
		<div class="pop-up__container" in:fade={{ duration: 6000 }} out:fade={{ duration: 2000 }}>
			<div class="pop-up">
				<h2>Comment installer votre application ?</h2>
				<p>
					L'invitation d'installation de votre smartphone ne s'est pas déclenchée ?
					<br /> Pas de panique, nous allons installer votre appli manuellement.
					<br /><br> Cliquez sur les trois petis points 	<img src="menu-points.png" alt="icone de l'application" width="25px" height="25px" />, en haut à droite de votre page et
					choisissez dans le menu déroulant, selon votre navigateur:
					<br /> "Ouvrir l'application" ou "Application" ou encore "Ajouter à l'écran d'accueil".
					<br />L'icone qui accompagne le texte doit ressembler à celui-ci:
					<img src="share2.png" alt="icone de l'application" width="25px" height="25px" />
          <br><br> Cliquez, attendez quelques secondes et le tour est joué !
          <br> Vous pouvez maintenant retrouver votre application sur votre écran d'accueil et commencer à l'utiliser.
  
				</p>
				<button class="pop-up__erase-button" on:click={display}> x</button>
			</div>
		</div>
	{/if} -->
	<div class="container__set-up">
		<div class="wrapper__indicator">
			<div class="indicator" id="distance">
				<span>Distance parcourue :</span> <br />
				{distanceDisplay}
			</div>
			<div class="indicator" id="speed"><span>Vitesse actuelle : </span> <br />{speedDisplay}</div>
		</div>
	</div>
	<div class="wrapper__buttons">
		<button class="buttons" on:click={startTracking} disabled={isCalculating}>Start</button>
		<button class="buttons" on:click={togglePauseTracking}
			>{isCalculating ? 'Pause' : 'Reprendre'}</button
		>
		<button class="buttons" on:click={resetTracking}>Reset</button>
		<button class="buttons" on:click={finishTracking} disabled={!positions.length}>Finish</button>
	</div>
</main>

<style>
	#map {
		width: 100%;
		height: 600px;
		margin-bottom: 10px;
		z-index: 0;
	}
	main {
		height: auto;
		position: relative;
	}
	.container__set-up {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	/* .pop-up__container {
		display: flex;
		align-items: center;
		justify-content: center;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 255, 0);
		z-index: 2;
	}

	.pop-up {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90%;
		height: auto;
		background-color: rgb(255, 255, 255);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-radius: 20px;
		z-index: 2;
	}
	.pop-up__erase-button {
		content: 'x';
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		top: 0%;
		left: 95%;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		padding: 10px;
		background-color: rgb(0, 0, 0);
		z-index: 3;
	}

	.pop-up__erase-button:hover {
		cursor: pointer;
	}
  .pop-up h2, p {
    text-align: center;
    color: rgb(13, 13, 13);
    padding: 20px;
    line-height: 20px;
  }
  img{
    width: 20px;
    height: 20px;
  } */

	.wrapper__indicator {
		display: flex;
		align-items: center;
		flex-direction: column;
		justify-content: space-around;
		width: 100%;
		gap: 10px;
		margin-top: 30px;
		background-color: rgb(56, 55, 55);
		color: white;
	}
	.wrapper__buttons {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 10px;
		height: 100%;
		width: 100%;
		margin-top: 30px;
		background-color: rgb(56, 55, 55);
	}
	.buttons {
		background-color: #4caf50;
		border: none;
		color: white;
		padding: 15px 25px;
		text-align: center;
		text-decoration: none;
		display: inline-block;
		font-size: 16px;
		cursor: pointer;
		border-radius: 15px;
		width: 150px;
		box-shadow: 0px 0px 10px #000000;
	}
	.buttons:active {
		background-color: #275a28;
		/* border: 1px solid rgb(221, 210, 210); */
	}
	.indicator {
		width: 90%;
		text-align: center;
		align-self: flex-end;
		border-radius: 15px;
		padding: 20px;
		margin: 0 auto;
		background-color: #2b2828;
		text-shadow: 0px 0px 1px #fdfdfd;
		font-weight: bolder;
		box-shadow: inset 0px 0px 5px 2px #000000;
		font-size: 1.5rem;
	}
	.indicator span {
		font-weight: 100;
		font-size: 1rem;
		align-self: flex-start;
	}

	@media screen and (max-width: 600px) {
		#map {
			width: 100%;
			height: 220px;
		}
		.wrapper__buttons {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 50px;
		}
		.wrapper__indicator {
			margin-top: 20px;
			gap: 5px;
		}
		.buttons {
			background-color: #4caf50;
			border: none;
			color: white;
			padding: 15px 25px;
			text-align: center;
			text-decoration: none;
			display: inline-block;
			font-size: 16px;
			cursor: pointer;
			border-radius: 15px;
			width: 120px;
			box-shadow: 0px 0px 10px #000000;
		}

		.buttons:active {
			background-color: #275a28;
			/* border: 1px solid rgb(221, 210, 210); */
		}
		.indicator {
			width: 70%;
			text-align: center;
			align-self: flex-end;
			border-radius: 15px;
			padding: 10px;
			margin: 0 auto;
			background-color: #2b2828;
			text-shadow: 0px 0px 1px #fdfdfd;
			font-weight: bolder;
			box-shadow: inset 0px 0px 5px 2px #000000;
			font-size: 1.5rem;
		}
		.indicator span {
			font-weight: 100;
			font-size: 1rem;
			align-self: flex-start;
		}
	}
</style>
