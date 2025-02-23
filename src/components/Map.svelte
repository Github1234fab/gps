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
	let currentMode = 'walk'; // Mode par défaut

	const MODE_THRESHOLDS = {
		walk: 6,
		running: 12,
		bike: 25,
		car: 120,
		train: 200,
		plane: 800
	};

	async function requestGeolocationPermission() {
		if ('permissions' in navigator) {
			const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
			if (permissionStatus.state === 'denied') {
				alert("La géolocalisation est désactivée. Veuillez l'activer dans les paramètres de votre navigateur.");
			} else if (permissionStatus.state === 'prompt') {
				navigator.geolocation.getCurrentPosition(
					(position) => {
						const { latitude, longitude } = position.coords;
						const latlng = [latitude, longitude];
						marker = L.marker(latlng, { icon: customIcon }).addTo(map);
						map.setView(latlng, 13);
					},
					onError
				);
			}
		} else {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const { latitude, longitude } = position.coords;
					const latlng = [latitude, longitude];
					marker = L.marker(latlng, { icon: customIcon }).addTo(map);
					map.setView(latlng, 13);
				},
				onError
			);
		}
	}

	function setMode(mode) {
		currentMode = mode;
		console.log('Mode sélectionné:', currentMode);
	}

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
			function isIOS() {
				return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
			}

			if (isIOS()) {
				alert(
					"Pour installer votre application sur votre appareil iOS: \n 1. Appuyez sur le bouton 'Partager' au bas de votre écran (carré avec une flèche vers le haut). \n 2. Sélectionnez ensuite 'Ajouter à l'écran d'accueil'. \n 3. Retrouvez votre application sur votre page d'accueil et commencez à l'utiliser 😉!"
				);
			}

			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				deferredPrompt = e;
				installButton = true;
			});

			window.addEventListener('appinstalled', (evt) => {
				installButton = false;
				alert(
					"L'application a été installée avec succès 👍 !  Vous pouvez désormais l'utiliser en tant qu'application et bénéficier de tout ces atouts. Retrouvez l'application sur votre écran d'accueil, elle vous attends 😉 ."
				);
			});

			const L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');

			map = L.map('map').setView([48.8566, 2.3522], 13);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxZoom: 18
			}).addTo(map);

			polyline = L.polyline([], { color: 'blue' }).addTo(map);

			const customIcon = L.icon({
				iconUrl: '/pointer2.png',
				iconSize: [25, 25],
				iconAnchor: [12, 41],
				popupAnchor: [1, -34],
				shadowSize: [41, 41]
			});

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
			marker.setLatLng([0, 0]);
		}
		lastPositionTime = null;
		speedHistory = [];
	}

	function finishTracking() {
		if (watchId) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
		isCalculating = false;
		alert(`Distance totale parcourue : ${totalDistance.toFixed(3)} km`);
	}

	let distanceSinceLastCheck = 0;
	const MIN_DISTANCE_TO_TRACK = 0.005; // 5 mètres en kilomètres

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
			distanceSinceLastCheck += distance;

			if (distanceSinceLastCheck >= MIN_DISTANCE_TO_TRACK) {
				totalDistance += distanceSinceLastCheck;
				distanceDisplay = totalDistance.toFixed(3) + ' km';

				if (lastPositionTime) {
					const timeDiff = (currentTime - lastPositionTime) / 1000; // en secondes
					const speed = (distanceSinceLastCheck / timeDiff) * 3600; // en km/h
					speedHistory.push(speed);

					if (speedHistory.length > maxSpeedHistory) {
						speedHistory.shift();
					}

					const avgSpeed = speedHistory.reduce((sum, speed) => sum + speed, 0) / speedHistory.length;
					speedDisplay = avgSpeed.toFixed(1) + ' km/h';

					// Mettre à jour le mode en fonction de la vitesse moyenne
					updateMode(avgSpeed);
				}

				lastPositionTime = currentTime;
				distanceSinceLastCheck = 0;
			}
		}
	}

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

	function updateMaxSpeedHistory(newValue) {
		maxSpeedHistory = newValue;
		speedHistory = [];
		console.log('maxSpeedHistory:', maxSpeedHistory);
	}

	async function zoomToPosition() {
		if (navigator.geolocation && marker) {
			const position = marker.getLatLng();
			map.setView(position, 24); // Ajustez le niveau de zoom ici (16 est un exemple)
		} else {
			alert("La position actuelle n'est pas disponible.");
		}
	}
</script>



<main>
	<Header />

	{#if installButton}
		<button class="install-button" on:click={installApp}>Installer</button>
	{/if}

	<div id="map"></div>
	<button class="zoom-button" on:click={zoomToPosition}>Zoom sur ma position</button>

	<div class="container__set-up">
		<div class="wrapper__indicator">
			<div class="indicator" id="distance">
				<span>Distance parcourue :</span> <br />
				{distanceDisplay}
			</div>
			<div class="indicator" id="speed"><span>Vitesse actuelle : </span> <br />{speedDisplay}</div>
		</div>
	</div>
  <div class="container__wrapper__buttons-modes">
	<div class="wrapper__buttons-modes">
		<button class="button-modes" on:click={() => updateMaxSpeedHistory(10)}
			><img class="img-modes" src="/walk.png" alt="icone d'un marcheur" /></button
		>
		<button class="button-modes" on:click={() => updateMaxSpeedHistory(5)}
			><img class="img-modes" src="/running.png" alt="icone d'un coureur" /></button
		>
		<button class="button-modes" on:click={() => updateMaxSpeedHistory(7)}
			><img class="img-modes" src="/car.png" alt="icone d'un vélo" /></button
		>
	</div>
	<div class="wrapper__buttons-modes-B">
		<button class="button-modes" on:click={() => updateMaxSpeedHistory(3)}
			><img class="img-modes" src="/bike.png" alt="icone d'une voiture" /></button
		>
		<button class="button-modes" on:click={() => updateMaxSpeedHistory(3)}
			><img class="img-modes" src="/train.png" alt="icone d'un train" /></button
		>
		<button class="button-modes" on:click={() => updateMaxSpeedHistory(1)}
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
		<button class="buttons" on:click={finishTracking} disabled={!positions.length}>Finish</button>
	</div>
</main>

<style>
	#map {
		width: 100%;
		height: 350px;
		margin-bottom: 10px;
		z-index: 0;
	}
	main {
		height: auto;
		width: auto;
	}
	.container__set-up {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.wrapper__indicator {
		display: flex;
		align-items: center;
		flex-direction: column;
		justify-content: space-around;
		width: 50%;
		gap: 5px;
		margin-top: 10px;
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
		margin-top: 40px;
		background-color: rgb(56, 55, 55);
	}
  .container__wrapper__buttons-modes {
    display: flex;
    flex-direction: column;
    margin-top: 25px;
    gap: 12px;
  }
	.wrapper__buttons-modes,
	.wrapper__buttons-modes-B {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 15px;
		height: 100%;
		width: 100%;

	}

	.button-modes {
		background-color:  #ffc107bb ;
		border: none;
		cursor: pointer;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		box-shadow: 0px 0px 10px black;
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
		background-color: #4caf50;
		border: none;
		color: rgb(255, 255, 255);
		padding: 10px 25px;
		text-align: center;
		text-decoration: none;
		display: inline-block;
		font-size: 16px;
		cursor: pointer;
		border-radius: 15px;
		width: 110px;
		box-shadow: 0px 0px 10px #000000;
	}
	.buttons:active {
		background-color: #275a28;
	}
	.indicator {
		width: 90%;
		text-align: center;
		align-self: flex-end;
		border-radius: 15px;
		padding: 15px;
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
			height: 240px;
		}
		.wrapper__buttons {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 25px;
		}
		.wrapper__indicator {
			margin-top: 5px;
			gap: 5px;
			width: 100%;
		}
		.buttons {
			background-color: #4caf50;
			border: none;
			color: white;
			padding: 10px 25px;
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
			padding: 8px 10px;
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