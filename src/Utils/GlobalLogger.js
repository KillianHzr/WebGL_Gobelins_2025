// Utils/DisableLogs.js
(() => {
    // Vérifier UNIQUEMENT si #debug est dans l'URL
    const hasDebugInUrl = typeof window !== 'undefined' &&
        window.location.hash.includes('debug');

    // Si pas de #debug dans l'URL, désactiver tous les logs
    if (!hasDebugInUrl) {
        console.log = () => {};
        console.info = () => {};
        console.debug = () => {};
        console.trace = () => {};
        console.table = () => {};
        console.group = () => {};
        console.groupEnd = () => {};
        console.time = () => {};
        console.timeEnd = () => {};

        // Garder warn et error pour les erreurs critiques
        // console.warn et console.error restent actifs
    }
})();