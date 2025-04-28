/**
 * Tranche du store Zustand pour la gestion des narrations
 * Permet de mémoriser les narrations déjà déclenchées
 */
export const createNarrationSlice = (set, get) => ({
    // État des narrations déjà déclenchées
    triggeredNarrations: {},

    // Méthode pour marquer une narration comme déclenchée
    setNarrationTriggered: (narrationId) => set(state => ({
        triggeredNarrations: {
            ...state.triggeredNarrations,
            [narrationId]: true
        }
    })),

    // Méthode pour vérifier si une narration a déjà été déclenchée
    isNarrationTriggered: (narrationId) => {
        return get().triggeredNarrations[narrationId] === true;
    },

    // Méthode pour réinitialiser toutes les narrations
    resetTriggeredNarrations: () => set({
        triggeredNarrations: {}
    })
});