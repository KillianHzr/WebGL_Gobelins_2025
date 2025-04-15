/**
 * Tranche du store Zustand pour la gestion des interactions
 * Gère l'état des interactions disponibles et actives
 */
export const createInteractionSlice = (set, get) => ({
    // État des interactions
    interaction: {
        currentStep: null,
        allowScroll: true,
        waitingForInteraction: false,
        completedInteractions: {},

        // Objet de la scène qui est actuellement ciblé pour l'interaction
        interactionTarget: null,

        // Définir l'étape actuelle
        setCurrentStep: (step) => set(state => ({
            interaction: {
                ...state.interaction,
                currentStep: step
            }
        })),

        // Définir si le défilement est autorisé
        setAllowScroll: (allow) => set(state => ({
            interaction: {
                ...state.interaction,
                allowScroll: allow
            }
        })),

        // Définir si on attend une interaction
        setWaitingForInteraction: (waiting) => set(state => ({
            interaction: {
                ...state.interaction,
                waitingForInteraction: waiting
            }
        })),

        // Définir l'objet actuellement ciblé pour l'interaction
        setInteractionTarget: (target) => set(state => ({
            interaction: {
                ...state.interaction,
                interactionTarget: target
            }
        })),

        // Compléter une interaction (utilisé lorsqu'on détecte un clic sur un objet)
        completeInteraction: () => {
            const state = get();
            if (!state.interaction.waitingForInteraction) return;

            // Récupérer l'étape actuelle
            const currentStep = state.interaction.currentStep;

            // Désactiver immédiatement l'attente d'interaction
            set(state => ({
                interaction: {
                    ...state.interaction,
                    waitingForInteraction: false,
                    interactionTarget: null,
                    // S'assurer que completedInteractions existe
                    completedInteractions: {
                        ...(state.interaction.completedInteractions || {}),
                        [currentStep]: true
                    }
                }
            }));

            // Réactiver le défilement avec un léger délai
            setTimeout(() => {
                set(state => ({
                    interaction: {
                        ...state.interaction,
                        allowScroll: true
                    }
                }));
            }, 500);

            return currentStep;
        }
    }
});