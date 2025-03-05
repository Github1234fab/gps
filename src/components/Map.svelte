<script>
	import { onMount } from 'svelte';
	import Header from '../components/Header.svelte';
	import { fade } from 'svelte/transition';

	let map;
	let polyline;
	let marker;
	let watchId = null;
	let isTracking = false;
	let isCalculating = false;
	let positions = [];
	let totalDistance = 0;
	let distanceDisplay = '0.000 km';
	let speedDisplay = '0.0 km/h';
	let lastPositionTime = null;
	let showPopup = false;
	let speedHistory = [];
	let maxSpeedHistory = 5;
	let deferredPrompt;
	let installButton = false;
	let currentMode = ''; // Initialiser à une chaîne vide

	// objet pour les seuils de vitesse pour chaque mode de transport
	const MODE_THRESHOLDS = {
		walk: 5,
		running: 12,
		bike: 25,
		car: 120,
		train: 200,
		plane: 800
	};

	// Fonction pour gérer l'état de la classe active
	function updateActiveClass() {
		const buttons = document.querySelectorAll('.button-modes');
		buttons.forEach(button => {
			button.classList.toggle('active', button.classList.contains(currentMode) && isCalculating);
		});
	}

	//fonction pour demander la permission de géolocalisation quuand elle n'est pas demandée par le navigateur
	async function requestGeolocationPermission() {
		if ('permissions' in navigator) {
			const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
			if (permissionStatus.state === 'denied') {
				alert(
					"La géolocalisation est désactivée. Veuillez l'activer dans les paramètres de votre navigateur."
				);
			} else if (permissionStatus.state === 'prompt') {
				navigator.geolocation.getCurrentPosition((position) => {
					const { latitude, longitude } = position.coords;
					const latlng = [latitude, longitude];
					marker = L.marker(latlng, { icon: customIcon }).addTo(map);
					map.setView(latlng, 13);
				}, onError);
			}
		} else {
			navigator.geolocation.getCurrentPosition((position) => {
				const { latitude, longitude } = position.coords;
				const latlng = [latitude, longitude];
				marker = L.marker(latlng, { icon: customIcon }).addTo(map);
				map.setView(latlng, 13);
			}, onError);
		}
	}

	//fonction pour changer le mode de transport en fonction de la vitesse

	function setMode(mode) {
		currentMode = mode;
		console.log('Mode sélectionné:', currentMode);
	}

	//fonction pour installer l'application
	function installApp() {
		if (deferredPrompt) {
			deferredPrompt.prompt();
			deferredPrompt.userChoice.then((choiceResult) => {
				if (choiceResult.outcome === 'accepted') {
					console.log('User accepted the install prompt');
				} else {
					console.log('User dismissed the install prompt');
				}
				deferredPrompt = null;
			});
		}
	}

	onMount(async () => {
		if (typeof window !== 'undefined') {
			// fonction pour vérifier si l'appareil est un appareil iOS
			function isIOS() {
				return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
			}

			if (isIOS()) {
				alert(
					"Pour installer votre application sur votre appareil iOS: \n 1. Appuyez sur le bouton 'Partager' au bas de votre écran (carré avec une flèche vers le haut). \n 2. Sélectionnez ensuite 'Ajouter à l'écran d'accueil'. \n 3. Retrouvez votre application sur votre page d'accueil et commencez à l'utiliser 😉!"
				);
			}

			// événement pour écouter l'événement beforeinstallprompt. Si il est déclenché, on empêche le comportement par défaut et on stocke l'événement dans une variable deferredPrompt
			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				deferredPrompt = e;
				installButton = true;
			});

			// ecooute de l'événement appinstalled pour afficher un message de confirmation
			window.addEventListener('appinstalled', (evt) => {
				installButton = false;
				alert(
					"L'application a été installée avec succès 👍 !  Vous pouvez désormais l'utiliser en tant qu'application et bénéficier de tout ces atouts. Retrouvez l'application sur votre écran d'accueil, elle vous attends 😉 ."
				);
			});

			// chargement de la carte et des dépendances
			const L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');

			map = L.map('map').setView([48.8566, 2.3522], 13);
			L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
				maxZoom: 20
			}).addTo(map);

			polyline = L.polyline([], { color: 'blue' }).addTo(map);

			const customIcon = L.icon({
				iconUrl: '/pointer2.png',
				iconSize: [25, 25],
				iconAnchor: [12, 35],
				popupAnchor: [1, -34],
				shadowSize: [41, 41]
			});

			//condition pour demander la permission de géolocalisation si elle n'est pas demandée par le navigateur
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

	// fonction pour démarrer le tracking
	async function startTracking() {
	if (typeof window !== 'undefined' && navigator.geolocation) {
		if (!marker) {
			alert("La géolocalisation n'a pas encore été activée. Veuillez activer la localisation avant de commencer le tracking.");
			return;
		}
		
		currentMode = 'walk'; // Activer le mode "walk" par défaut au démarrage
		isCalculating = true;
		watchId = navigator.geolocation.watchPosition(onPositionReceived, onError, {
			enableHighAccuracy: true,
			maximumAge: 0
		});
		updateActiveClass(); // Mettre à jour la classe active
	} else {
		alert("La géolocalisation n'est pas supportée par votre navigateur.");
	}
}

	// fonction pour mettre en pause le tracking
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
		updateActiveClass(); // Mettre à jour la classe active
	}

	// fonction pour réinitialiser le tracking
	function resetTracking() {
		positions = [];
		totalDistance = 0;
		distanceDisplay = '0.000 km';
		speedDisplay = '0.0 km/h';
		polyline.setLatLngs([]);
		if (marker) {
			marker.setLatLng([0, 0]);
		}
		lastPositionTime = null;
		speedHistory = [];
		currentMode = ''; // Réinitialiser le mode
		updateActiveClass(); // Mettre à jour la classe active
	}

	// fonction pour terminer le tracking
	function finishTracking() {
		if (watchId) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
		isCalculating = false;
		currentMode = ''; // Réinitialiser le mode
		updateActiveClass(); // Mettre à jour la classe active
		alert(`Distance totale parcourue : ${totalDistance.toFixed(3)} km`);
	}

	// Variables pour le calcul de la distance et de la vitesse
	let distanceSinceLastCheck = 0;
	const MIN_DISTANCE_TO_TRACK = 0.010; // 5 mètres en kilomètres

	// Fonction pour mettre à jour la position
	function onPositionReceived(position) {
		const { latitude, longitude } = position.coords;
		const latlng = [latitude, longitude];
		const currentTime = new Date().getTime();
		positions.push(latlng);

		// Mettre à jour le marqueur et la ligne
		if (marker) {
			marker.setLatLng(latlng);
		} else {
			marker = L.marker(latlng).addTo(map);
		}

		polyline.addLatLng(latlng);

		// Mettre à jour uniquement la position centrale sans changer le niveau de zoom
		map.panTo(latlng);

		// Calculer la distance parcourue
		if (positions.length > 1) {
			const prevLatLng = positions[positions.length - 2];
			const distance = getDistanceFromLatLonInKm(prevLatLng[0], prevLatLng[1], latitude, longitude);
			distanceSinceLastCheck += distance;

			// Mettre à jour la distance totale parcourue
			if (distanceSinceLastCheck >= MIN_DISTANCE_TO_TRACK) {
				totalDistance += distanceSinceLastCheck;
				distanceDisplay = totalDistance.toFixed(3) + ' km';

				// Calculer la vitesse
				if (lastPositionTime) {
					const timeDiff = (currentTime - lastPositionTime) / 1000; // en secondes
					const speed = (distanceSinceLastCheck / timeDiff) * 3600; // en km/h
					speedHistory.push(speed);

					// Garder un historique de vitesse pour calculer la vitesse moyenne
					if (speedHistory.length > maxSpeedHistory) {
						speedHistory.shift();
					}
					// Calculer la vitesse moyenne
					const avgSpeed =
						speedHistory.reduce((sum, speed) => sum + speed, 0) / speedHistory.length;
					speedDisplay = avgSpeed.toFixed(1) + ' km/h';

					// Mettre à jour le mode en fonction de la vitesse moyenne
					updateMode(avgSpeed);
				}

				lastPositionTime = currentTime;
				distanceSinceLastCheck = 0;
			}
		}
	}
	// fonction pour mettre à jour le mode de transport en fonction de la vitesse
	function updateMode(speed) {
		if (speed < MODE_THRESHOLDS.walk) {
			currentMode = 'walk';
		} else if (speed < MODE_THRESHOLDS.running) {
			currentMode = 'running';
		} else if (speed < MODE_THRESHOLDS.bike) {
			currentMode = 'bike';
		} else if (speed < MODE_THRESHOLDS.car) {
			currentMode = 'car';
		} else if (speed < MODE_THRESHOLDS.train) {
			currentMode = 'train';
		} else {
			currentMode = 'plane';
		}
		console.log('Mode détecté:', currentMode);
		updateActiveClass(); // Mettre à jour la classe active
	}
	// fonction pour gérer les erreurs de géolocalisation
	function onError(error) {
		console.error('Erreur de géolocalisation :', error);
	}
	// fonction pour calculer la distance entre deux points géographiques
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
	// fonction pour convertir les degrés en radians
	function deg2rad(deg) {
		return deg * (Math.PI / 180);
	}
	//fonction pour afficher le popup
	function display() {
		showPopup = false;
	}
	//fonction pour mettre à jour l'historique de vitesse
	function updateMaxSpeedHistory(newValue) {
		maxSpeedHistory = newValue;
		speedHistory = [];
		console.log('maxSpeedHistory:', maxSpeedHistory);
	}
</script>

<main>
	<!-- <Header /> -->

	{#if installButton}
		<button class="install-button" on:click={installApp}>Installer</button>
	{/if}

	<div id="map"></div>
	<!-- <div class="container__set-up"> -->
	<div class="wrapper__indicator">
		<div class="indicator" id="distance">
			<img src="/distance.png" alt="icon d'itinéraire" class="indicator-img" /> <br />
			{distanceDisplay}
		</div>
		<div class="indicator" id="speed">
			<img src="/vitesse.png" alt="icon d'un compteur de vitesse" class="indicator-img" />
			<br />{speedDisplay}
		</div>
	</div>
	<!-- </div> -->
	<div class="container__wrapper__buttons-modes">
		<div class="wrapper__buttons-modes">
			<button  class="button-modes {currentMode === 'walk' ? 'active' : ''}"  on:click={() => updateMaxSpeedHistory(10)}
				><img class="img-modes" src="/walk.png" alt="icone d'un marcheur" /></button
			>
			<button class="button-modes"  on:click={() => updateMaxSpeedHistory(5)}
				><img class="img-modes" src="/running.png" alt="icone d'un coureur" /></button
			>
			<button class="button-modes" on:click={() => updateMaxSpeedHistory(3)}
				><img class="img-modes" src="/bike.png" alt="icone d'une voiture" /></button
			>
		</div>
		<div class="wrapper__buttons-modes-B">
			<button class="button-modes" on:click={() => updateMaxSpeedHistory(7)}
				><img class="img-modes" src="/car.png" alt="icone d'un vélo" /></button
			>
			<button class="button-modes"  on:click={() => updateMaxSpeedHistory(3)}
				><img class="img-modes" src="/train.png" alt="icone d'un train" /></button
			>
			<button class="button-modes"  on:click={() => updateMaxSpeedHistory(1)}
				><img class="img-modes" src="/plane.png" alt="icone d'un avion" /></button
			>
		</div>
	</div>
	<div class="wrapper__buttons">
		<button class="buttons" on:click={startTracking} disabled={isCalculating}>Start</button>
		<button class="buttons" on:click={togglePauseTracking}
			>{isCalculating ? 'Continue' : 'Pause'}</button
		>
		<button class="buttons" on:click={resetTracking}>Reset</button>
		<button class="buttons" on:click={finishTracking} disabled={!positions.length}>Stop</button>
	</div>
</main>

<style>
	#map {
		width: 100%;
		height: 100vh;
		margin-bottom: 10px;
		z-index: 0;
		position: relative;
	}
	main {
		height: auto;
		width: auto;
	}

	.container__wrapper__buttons-modes {
		display: flex;
		flex-direction: column;
		margin-top: 25px;
		gap: 12px;
		position: absolute;
		top: min(65vh);
		left: 10%;
		transform: translate(-50%, -50%);
	}

	.wrapper__indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		position: absolute;
		top: 10px;
		left: 70%;
		transform: translate(-50%, 0);
	}
	.wrapper__buttons {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 10px;
		position: absolute;
		top: min(60vh);
		left: 62%;
	}

	.wrapper__buttons-modes,
	.wrapper__buttons-modes-B {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 5px;
		height: 100%;
		width: 100%;
	}

	.button-modes {
		background-color: #009687;
		border: none;
		cursor: pointer;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.36);
	}
.active {
		background-color: #8796e1;
	}
	.button-modes:active {
		background-color: #8796e1;
	}
	.button-modes:hover {
		background-color: #8796e1;
	}
	.img-modes {
		width: 30px;
		height: 30px;
	}
	.install-button {
		color: rgb(220, 148, 13);
		font-weight: 500;
		background-color: #ffffff;
		padding: 6px 20px;
		border: none;
		border-radius: 25px;
		margin: 20px auto;
	}
	.install-button:active {
		background-color: #191919;
		color: white;
	}
	.install-button:hover {
		background-color: #191919;
		color: white;
	}

	.buttons {
		background-color: #227aff;
		border: none;
		color: rgb(255, 255, 255);
		padding: 15px 25px;
		text-align: center;
		text-decoration: none;
		display: inline-block;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		border-radius: 15px;
		width: 110px;
		box-shadow: 0px 0px 10px #00000058;
	}
	.buttons:hover {
		border: 2px solid white;
	}
	.buttons:active {
		border: 2px solid white;
	}
	.indicator {
		text-align: center;
		border-radius: 15px;
		padding: 8px;
		background-color: rgba(255, 255, 255, 0.851);
		text-shadow: 0px 0px 1px #fdfdfd;
		font-weight: bolder;
		box-shadow: inset 0px 0px 2px #000000;
		font-size: 1rem;
		color: #161616;
		min-width: 80%;
	}

	.indicator-img {
		width: 30px;
		height: 30px;
	}

	@media screen and (min-width: 768px) {
		.wrapper__buttons {
			top: min(75vh);
			left: min(80vw);
		}

		.wrapper__indicator {
			left: min(80vw);
		}
		.container__wrapper__buttons-modes {
			top: min(70vh);
		}
	}
</style>
