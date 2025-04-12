/**
 * Tranche du store Zustand pour la gestion de l'écoute des clics
 */
export const createClickListenerSlice = (set, get) => ({
    // Ajouter l'état du ClickListener dans le store
    clickListener: {
        // État indiquant si l'écoute des clics est active
        isListening: false,

        // Méthode pour démarrer l'écoute des clics
        startListening: () => set((state) => ({
            clickListener: {
                ...state.clickListener,
                isListening: true
            }
        })),

        // Méthode pour arrêter l'écoute des clics
        stopListening: () => set((state) => ({
            clickListener: {
                ...state.clickListener,
                isListening: false
            }
        })),

        // Méthode pour basculer l'état d'écoute
        toggleListening: () => set((state) => ({
            clickListener: {
                ...state.clickListener,
                isListening: !state.clickListener.isListening
            }
        })),

        // Configuration de débogage
        debug: {
            enabled: false
        },

        // Méthode pour mettre à jour la configuration de débogage
        updateDebugConfig: (config) => set((state) => ({
            clickListener: {
                ...state.clickListener,
                debug: {
                    ...state.clickListener.debug,
                    ...config
                }
            }
        }))
    }
});