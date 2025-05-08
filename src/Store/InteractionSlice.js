import {EventBus} from "../Utils/EventEmitter.jsx";

/**
 * Tranche du store Zustand pour la gestion des interactions
 * Gère l'état des interactions disponibles et actives
 */
export const createInteractionSlice = (set, get) => ({
    // État des interactions
    interaction: {
        currentStep: null, allowScroll: true, waitingForInteraction: false, completedInteractions: {},

        // Objet de la scène qui est actuellement ciblé pour l'interaction
        interactionTarget: null,

        // Définir l'étape actuelle
        setCurrentStep: (step) => set(state => ({
            interaction: {
                ...state.interaction, currentStep: step
            }
        })),

        // Définir si le défilement est autorisé
        setAllowScroll: (allow) => set(state => ({
            interaction: {
                ...state.interaction, allowScroll: allow
            }
        })),

        // Définir si on attend une interaction
        setWaitingForInteraction: (waiting) => set(state => ({
            interaction: {
                ...state.interaction, waitingForInteraction: waiting
            }
        })),

        // Définir l'objet actuellement ciblé pour l'interaction
        setInteractionTarget: (target) => set(state => ({
            interaction: {
                ...state.interaction, interactionTarget: target
            }
        })),

        // Compléter une interaction (utilisé lorsqu'on détecte un clic sur un objet)
        completeInteraction: () => {
            const state = get();
            if (!state.interaction.waitingForInteraction) return;

            // Récupérer l'étape actuelle
            const currentStep = state.interaction.currentStep;

            // IMPORTANT: Émettre un événement AVANT de modifier l'état
            // Cela permet à ScrollControls de sauvegarder la position actuelle
            EventBus.trigger('pre-interaction-complete', {
                step: currentStep,
                timestamp: Date.now()
            });

            // Mettre à jour l'état
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

            // IMPORTANT: Attendre la mise à jour de l'état avant d'émettre l'événement suivant
            setTimeout(() => {
                // Déclencher un événement pour que ScrollControls puisse réactiver le scroll
                EventBus.trigger('interaction-complete-set-allow-scroll', {
                    step: currentStep,
                    timestamp: Date.now()
                });

                // NOUVEAU: Emit the main INTERACTION_COMPLETE event directly here
                // This ensures it's called after state updates but isn't missed
                console.log("Emitting INTERACTION_COMPLETE event directly from completeInteraction");
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