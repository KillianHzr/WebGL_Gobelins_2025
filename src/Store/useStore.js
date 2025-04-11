import { create } from 'zustand'

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
const useStore = create((set) => ({
    // Asset loading state
    loaded: false,
    setLoaded: (loaded) => set({ loaded }),

    // Debug state - initially set based on URL hash
    debug: {
        active: isDebugEnabled(),     // Enable debug features only if #debug in URL
        showStats: isDebugEnabled(),  // Show performance statistics
        showGui: isDebugEnabled()     // Show control panel
    },
    setDebug: (debugSettings) => set(state => ({
        debug: { ...state.debug, ...debugSettings }
    })),

    // GUI instance (shared among all components)
    gui: null,
    setGui: (gui) => set({ gui }),

    // Add more state as needed
}))

// Listen for hash changes to toggle debug mode
if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
        const debugEnabled = isDebugEnabled();
        useStore.getState().setDebug({
            active: debugEnabled,
            showStats: debugEnabled,
            showGui: debugEnabled
        });
    });
}

export default useStore