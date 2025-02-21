<!-- <script>
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';

    export let showPopup = false;

    const dbName = 'pwaDatabase';
    const dbVersion = 1;
    const storeName = 'appStore';
    let db;

    // Store pour l'état d'installation
    export const installationStatus = writable(false);

    // Ouvrir la base de données IndexedDB
    async function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = () => {
                reject('Erreur d\'ouverture de la base de données');
            };
        });
    }

    // Vérifier si l'application a été installée
    async function checkInstallationStatus() {
        await openDatabase();

        return new Promise((resolve) => {
            const transaction = db.transaction([storeName], 'readonly');
            const objectStore = transaction.objectStore(storeName);
            const request = objectStore.get('installed');

            request.onsuccess = () => {
                if (request.result) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
        });
    }

    // Marquer l'application comme installée
    function markAsInstalled() {
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put({ id: 'installed', value: true });

        request.onsuccess = () => {
            console.log('Application marquée comme installée');
            installationStatus.set(true);
        };

        request.onerror = () => {
            console.error('Erreur lors du marquage de l\'installation');
        };
    }

    onMount(async () => {
        const isInstalled = await checkInstallationStatus();
        installationStatus.set(isInstalled);
        if (!isInstalled) {
            showPopup = true;
        }

        window.addEventListener('appinstalled', () => {
            showPopup = false;
            markAsInstalled();
        });
    });
</script>

<style>
    /* Ajoutez ici le style pour votre popup si nécessaire */
</style> -->
