/**
 * Store slice for managing the ending landing state
 */
export const createEndingLandingSlice = (set, get) => ({
    // State for the ending landing
    endingLandingVisible: false,

    // Actions
    setEndingLandingVisible: (visible) => set({ endingLandingVisible: visible }),

    // Trigger the full ending sequence
    triggerEnding: () => {
        console.log('Triggering ending sequence');

        // Hide the experience canvas if needed
        if (document.querySelector('canvas')) {
            document.querySelector('canvas').style.visibility = 'hidden';
        }

        // Show the ending landing
        set({ endingLandingVisible: true });
    },

    // Reset the ending state
    resetEnding: () => {
        console.log('Resetting ending state');

        // Restore 3D scene visibility
        if (document.querySelector('canvas')) {
            document.querySelector('canvas').style.visibility = 'visible';
        }

        // Hide the ending landing
        set({ endingLandingVisible: false });
    }
});