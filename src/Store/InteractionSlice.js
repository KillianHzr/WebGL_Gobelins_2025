import {EventBus} from "../Utils/EventEmitter.jsx";

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

        // Compléter une interaction (version simplifiée)
        completeInteraction: () => {
            const state = get();
            if (!state.interaction.waitingForInteraction) return;

            // Récupérer l'étape actuelle
            const currentStep = state.interaction.currentStep;

            // Mettre à jour l'état pour indiquer que l'interaction est terminée
            set(state => ({
                interaction: {
                    ...state.interaction,
                    waitingForInteraction: false,
                    currentStep: null,
                    interactionTarget: null,
                    completedInteractions: {
                        ...state.interaction.completedInteractions,
                        [currentStep]: true
                    }
                }
            }));

            // Déclencher un événement pour que ScrollControls puisse réactiver le scroll
            setTimeout(() => {
                EventBus.trigger('interaction-complete-set-allow-scroll', {
                    step: currentStep,
                    timestamp: Date.now()
                });

                // Émettre l'événement principal INTERACTION_COMPLETE
                console.log("Emitting INTERACTION_COMPLETE event from completeInteraction");
                EventBus.trigger('INTERACTION_COMPLETE', {
                    id: currentStep,
                    type: 'direct',
                    source: 'interaction-slice'
                });
            }, 50);

            return currentStep;
        }
    }
});