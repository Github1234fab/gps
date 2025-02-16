<script>
  import { onMount } from "svelte";

  let map;
  let polyline;
  let marker;
  let watchId = null;
  let isTracking = false;
  let positions = [];
  let totalDistance = 0;
  let distanceDisplay = "0.00 km"; // Variable pour afficher la distance

  onMount(async () => {
    if (typeof window !== "undefined") {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      map = L.map("map").setView([48.8566, 2.3522], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      polyline = L.polyline([], { color: "blue" }).addTo(map);
    }
  });

  async function startTracking() {
    if (typeof window !== "undefined" && navigator.geolocation) {
      isTracking = true;
      watchId = navigator.geolocation.watchPosition(onPositionReceived, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
      });
    } else {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
    }
  }

  function togglePauseTracking() {
    if (isTracking) {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    } else {
      startTracking();
    }
    isTracking = !isTracking;
  }

  function finishTracking() {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    isTracking = false;
    alert(`Distance totale parcourue : ${totalDistance.toFixed(2)} km`);
  }

  function onPositionReceived(position) {
    const { latitude, longitude } = position.coords;
    const latlng = [latitude, longitude];
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
      distanceDisplay = totalDistance.toFixed(2) + " km"; // Mettre à jour l'affichage de la distance
    }
  }

  function onError(error) {
    console.error("Erreur de géolocalisation :", error);
  }

  function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance en km
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
</script>

<style>
  #map {
    width: 100%;
    height: 400px;
    margin-bottom: 10px;
  }
  button {
    margin: 5px;
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
  }
  #distance {
    font-size: 1.5em;
    margin-top: 10px;
  }
</style>

<div id="map"></div>
<div id="distance">Distance parcourue : {distanceDisplay}</div>

<button on:click={startTracking} disabled={isTracking}>Start</button>
<button on:click={togglePauseTracking}>{isTracking ? 'Pause' : 'Reprendre'}</button>
<button on:click={finishTracking} disabled={!positions.length}>Stop</button>
