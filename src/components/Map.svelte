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
	let maxSpeedHistory = 5; // Nombre de valeurs à conserver pour le lissage
	let deferredPrompt; // Allows to show the install prompt
	let installButton = false;

	// fonction pour installer l'application
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
			//fonction pour vérifier si l'utilisateur est sur un appareil iOS
			function isIOS() {
				return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
			}

			if (isIOS()) {
				console.log("L'utilisateur est sur un appareil iOS.");
				alert(
					"Pour installer votre application sur votre appareil iOS: \n 1. Appuyez sur le bouton 'Partager' au bas de votre écran (carré avec une flèche vers le haut). \n 2. Sélectionnez ensuite 'Ajouter à l'écran d'accueil'. \n 3. Retrouvez votre application sur votre page d'accueil et commencez à l'utiliser 😉!"
				);
			} else {
				console.log("L'utilisateur n'est pas sur un appareil iOS.");
			}

			//écoute de l'événement beforeinstallprompt
			window.addEventListener('beforeinstallprompt', (e) => {
				console.log('beforeinstallprompt fired');
				e.preventDefault(); // Empêche l'affichage automatique de la bannière
				deferredPrompt = e; // Stocke l'événement
				installButton = true; // Déclenche la réactivité dans Svelte
			});

			//écoute de l'événement appinstalled et génère une confirmation d'intallation
			window.addEventListener('appinstalled', (evt) => {
				installButton = false;
				console.log('appinstalled fired', evt);
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
			isCalculating = !isCalculating;
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
			// Si le suivi est en cours, le mettre en pause
			if (watchId) {
				navigator.geolocation.clearWatch(watchId);
				watchId = null;
			}
		} else {
			// Si le suivi est en pause, le reprendre
			startTracking();
		}
		// Inverser l'état de isCalculating
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
    const { latitude, longitude, accuracy } = position.coords;
    const currentTime = new Date().getTime();
    const latlng = [latitude, longitude];

    // Éviter les positions trop imprécises (> 20m)
    if (accuracy > 20) return;

    // Vérifier le mouvement réel
    if (positions.length > 0) {
        const prevLatLng = positions[positions.length - 1];
        const distance = getDistanceFromLatLonInKm(prevLatLng[0], prevLatLng[1], latitude, longitude);

        // Seuil de validation du mouvement selon l'activité
        const movementThreshold = isRunning ? 3 : isWalking ? 5 : 1; // ajustable
        if (distance < movementThreshold) return;
    }

    positions.push(latlng);

    // Calcul de la moyenne des 5 dernières positions pour lisser
    if (positions.length > 5) {
        positions.shift(); // Retirer l'ancienne valeur
    }

    const avgLat = positions.reduce((sum, p) => sum + p[0], 0) / positions.length;
    const avgLng = positions.reduce((sum, p) => sum + p[1], 0) / positions.length;
    const smoothedLatLng = [avgLat, avgLng];

    // Mise à jour du marqueur et de la carte
    if (marker) {
        marker.setLatLng(smoothedLatLng);
    } else {
        marker = L.marker(smoothedLatLng).addTo(map);
    }

    polyline.addLatLng(smoothedLatLng);
    map.setView(smoothedLatLng, 13);

    // Calcul de la distance
    if (positions.length > 1) {
        const prevLatLng = positions[positions.length - 2];
        const distance = getDistanceFromLatLonInKm(prevLatLng[0], prevLatLng[1], avgLat, avgLng);
        totalDistance += distance;
        distanceDisplay = totalDistance.toFixed(3) + ' km';

        // Calcul de la vitesse
        if (lastPositionTime) {
            const timeDiff = (currentTime - lastPositionTime) / 1000; // secondes
            const speed = (distance / timeDiff) * 3600; // km/h
            speedHistory.push(speed);

            if (speedHistory.length > maxSpeedHistory) {
                speedHistory.shift();
            }

            const avgSpeed = speedHistory.reduce((sum, s) => sum + s, 0) / speedHistory.length;
            speedDisplay = avgSpeed.toFixed(1) + ' km/h';
        }
    }

    lastPositionTime = currentTime;
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
		// Vous pouvez également réinitialiser l'historique des vitesses ici si nécessaire
		speedHistory = [];
		console.log('maxSpeedHistory:', maxSpeedHistory);
	}
</script>

<main>
	<Header />

	{#if installButton}
		<button class="install-button" on:click={installApp}>Installer</button>
	{/if}

	<div id="map"></div>

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
		height: 650px;
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
		width: 100%;
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
		background-color: #8796e126;
		border: none;
		cursor: pointer;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		box-shadow: 0px 0px 10px #7879d7;
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
