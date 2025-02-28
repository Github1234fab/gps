if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      registerSync();
    }
  });
}

function registerSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      return registration.sync.register('sync-distance-calculation');
    }).then(() => {
      console.log('Synchronisation en arrière-plan enregistrée.');
    }).catch((error) => {
      console.error('Échec de l\'enregistrement de la synchronisation :', error);
    });
  }
}
