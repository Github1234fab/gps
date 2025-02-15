<script>
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  let map;
  let startMarker, endMarker, polyline;
  let watchId; // ID pour arrêter la géolocalisation
  let positions = [];
  let distance = writable(0);

  // Fonction pour démarrer le suivi GPS
  function startTracking() {
    positions = []; // Reset du parcours
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          positions.push([lat, lng]);

          // Ajouter un marqueur au début
          if (positions.length === 1) {
            if (startMarker) map.removeLayer(startMarker);
            startMarker = L.marker([lat, lng]).addTo(map).bindPopup("Départ").openPopup();
          }

          // Mise à jour du tracé sur la carte
          if (polyline) map.removeLayer(polyline);
          polyline = L.polyline(positions, { color: "blue" }).addTo(map);

          // Centrer la carte sur la position actuelle
          map.setView([lat, lng], 15);
        },
        (err) => console.error("Erreur de géolocalisation:", err),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    } else {
      alert("La géolocalisation n'est pas supportée sur ce navigateur.");
    }
  }

  // Fonction pour arrêter et calculer la distance
  function stopTracking() {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (positions.length > 1) {
      const [startLat, startLng] = positions[0];
      const [endLat, endLng] = positions[positions.length - 1];

      // Ajouter un marqueur à l'arrivée
      if (endMarker) map.removeLayer(endMarker);
      endMarker = L.marker([endLat, endLng]).addTo(map).bindPopup("Arrivée").openPopup();

      // Calcul de la distance en ligne droite
      const R = 6371e3; // Rayon de la Terre en mètres
      const φ1 = (startLat * Math.PI) / 180;
      const φ2 = (endLat * Math.PI) / 180;
      const Δφ = ((endLat - startLat) * Math.PI) / 180;
      const Δλ = ((endLng - startLng) * Math.PI) / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      const distanceMeters = R * c;
      distance.set((distanceMeters / 1000).toFixed(2)); // Convertir en km
    }
  }

  onMount(async () => {
    if (typeof window !== "undefined") {
      const L = await import("leaflet");

      map = L.map("map").setView([48.8566, 2.3522], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      setTimeout(() => {
        map.invalidateSize(); // Corrige les tuiles mal affichées
      }, 500);
    }
  });
</script>

<style>
  #map {
    width: 100%;
    height: 400px;
    margin-bottom: 10px;
  }
  .controls {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-bottom: 10px;
  }
  button {
    padding: 10px;
    font-size: 16px;
    cursor: pointer;
  }
</style>

<div id="map"></div>

<div class="controls">
  <button on:click={startTracking}>Go</button>
  <button on:click={stopTracking}>Arrivé</button>
</div>

<p>Distance en ligne droite : {$distance} km</p>
