<script>
	// import Map from '../components/Map.svelte';
	import './style.css';

    let deferredPrompt;
    let showInstallButton = false;
  
    // Capture l'événement beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
  
      // Affiche le bouton après 5 secondes
      setTimeout(() => {
        showInstallButton = true;
      }, 5000);
    });
  
    // Gestion du clic sur le bouton
    function installApp() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
  
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('L\'utilisateur a accepté l\'installation');
          } else {
            console.log('L\'utilisateur a refusé l\'installation');
          }
          deferredPrompt = null;
          showInstallButton = false;
        });
      }
    }
  
    // Gère le cas où l'application est déjà installée
    window.addEventListener('appinstalled', () => {
      console.log('L\'application a été installée');
      showInstallButton = false;
    });
  </script>
  
  <main>
    <h1>Bienvenue sur mon application PWA !</h1>
  
    <!-- {#if showInstallButton} -->
      <button on:click={installApp} style="position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; font-size: 16px;">
        Installer l'application
      </button>
    <!-- {/if} -->
  </main>
  
<style>
    main{
        height: 400px;
        width: 400px;
        background-color: white;
    }
</style>
<!-- <Map /> -->
