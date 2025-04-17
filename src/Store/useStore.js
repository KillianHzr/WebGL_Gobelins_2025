import { create } from 'zustand'
import { createAudioSlice } from './AudioSlice'
import { createInteractionSlice } from './interactionSlice'
import { createClickListenerSlice } from './clickListenerSlice'

// Function to check if debug is enabled in URL
const isDebugEnabled = () => {
    // Check if running in browser environment
    if (typeof window !== 'undefined') {
        // Check if URL hash contains #debug
        return window.location.hash.includes('#debug');
    }
    return false;
}

// Central Store for application state
const useStore = create((set, get) => ({
    // Asset loading state
    loaded: false,
    setLoaded: (loaded) => set({ loaded }),

    // Debug state - initially set based on URL hash
    debug: {
        active: isDebugEnabled(),     // Enable debug features only if #debug in URL
        showStats: isDebugEnabled(),  // Show performance statistics
        showGui: isDebugEnabled(),    // Show control panel
        showTheatre: isDebugEnabled() // Show Theatre.js Studio interface
    },
    setDebug: (debugSettings) => set(state => ({
        debug: { ...state.debug, ...debugSettings }
    })),

    // Theatre.js Studio instance
    theatreStudio: null,
    setTheatreStudio: (studio) => set({ theatreStudio: studio }),

    // GUI instance (shared among all components)
    gui: null,
    setGui: (gui) => set({ gui }),

    // Debug configuration (for export/import)
    debugConfig: null,
    setDebugConfig: (config) => set({ debugConfig: config }),

    // Update specific part of debug config
    updateDebugConfig: (path, value) => {
        const config = { ...get().debugConfig };
        let current = config;
        const parts = path.split('.');

        // Navigate to the second-to-last part of the path
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        // Set the value at the final path
        current[parts[parts.length - 1]] = value;
        set({ debugConfig: config });
    },

    // Get value from debug config
    getDebugConfigValue: (path, defaultValue) => {
        const config = get().debugConfig;
        if (!config) return defaultValue;

        let current = config;
        const parts = path.split('.');

        // Navigate through the path
        for (let i = 0; i < parts.length; i++) {
            if (!current[parts[i]]) {
                return defaultValue;
            }
            current = current[parts[i]];
        }

        return current;
    },

    updateDebugConfigWithoutRender: (path, value) => {
        const config = { ...get().debugConfig };
        let current = config;
        const parts = path.split('.');

        // Naviguer jusqu'à l'avant-dernière partie du chemin
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        // Définir la valeur au chemin final
        current[parts[parts.length - 1]] = value;

        // Mettre à jour la config sans déclencher de re-rendu
        get().setDebugConfig(config);
    },

    // Intégration des tranches
    ...createClickListenerSlice(set, get),
    ...createInteractionSlice(set, get),
    ...createAudioSlice(set, get)
}));

// Listen for hash changes to toggle debug mode
if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
        const debugEnabled = isDebugEnabled();

        // Mise à jour du mode debug
        useStore.getState().setDebug({
            active: debugEnabled,
            showStats: debugEnabled,
            showGui: debugEnabled,
            showTheatre: debugEnabled
        });

        // Gestion de l'interface Theatre.js si elle a été initialisée
        if (window.__theatreStudio) {
            if (debugEnabled) {
                // Restaurer l'interface Theatre.js
                window.__theatreStudio.ui.restore();
            } else {
                // Masquer l'interface Theatre.js
                window.__theatreStudio.ui.hide();
            }
        }
    });
}

export default useStore