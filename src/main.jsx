// Dans main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './scss/style.scss'

import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'

// Function to check if debug is enabled in URL
const isDebugEnabled = () => {
    // Check if running in browser environment
    if (typeof window !== 'undefined') {
        // Check if URL hash contains #debug
        return window.location.hash.includes('#debug');
    }
    return false;
}

// Préparation de Theatre.js au démarrage de l'application
if (typeof window !== 'undefined') {
    // Étendre Theatre.js avec l'extension R3F
    studio.extend(extension);

    // Ne pas initialiser l'interface UI si #debug n'est pas présent
    if (isDebugEnabled()) {
        // Initialiser normalement avec UI visible
        studio.initialize();
        console.log('Theatre.js initialized with UI visible');
    } else {
        // Initialiser avec UI cachée
        studio.initialize({ __experimental_hideUI: true });
        console.log('Theatre.js initialized with UI hidden');
    }

    // Exposer l'instance globalement pour un accès facile
    window.__theatreStudio = studio;

    // Gérer le changement de hash URL
    window.addEventListener('hashchange', () => {
        const debugEnabled = isDebugEnabled();

        // Si aucune instance de Theatre.js n'existe, ne rien faire
        if (!window.__theatreStudio) return;

        try {
            if (debugEnabled) {
                // Afficher l'UI si #debug est présent
                window.__theatreStudio.ui.restore();
                console.log('Theatre.js UI restored due to #debug in URL');
            } else {
                // Cacher l'UI si #debug est absent
                window.__theatreStudio.ui.hide();
                console.log('Theatre.js UI hidden due to removal of #debug from URL');

                // Solution de secours: placer un style CSS qui force le masquage
                const style = document.createElement('style');
                style.id = 'theatre-hide-override';
                style.textContent = '.theatre-studio-root { display: none !important; }';
                document.head.appendChild(style);
            }
        } catch (error) {
            console.error('Error handling Theatre.js UI visibility:', error);
        }
    });

    // Si #debug n'est pas présent au chargement, ajouter un style CSS pour forcer le masquage
    if (!isDebugEnabled()) {
        // Solution supplémentaire: ajouter un style CSS qui masque l'interface de Theatre
        const style = document.createElement('style');
        style.id = 'theatre-hide-override';
        style.textContent = '.theatre-studio-root { display: none !important; }';
        document.head.appendChild(style);
    }

    // Empêcher la propagation des événements de défilement dans Theatre.js
    document.addEventListener('wheel', (e) => {
        if (!e.target.closest('.theatre-studio-root')) {
            e.preventDefault();
        }
    }, { passive: false });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);