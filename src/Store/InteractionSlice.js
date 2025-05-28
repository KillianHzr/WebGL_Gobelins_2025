import {EventBus} from "../Utils/EventEmitter.jsx";
import sceneObjectManager from "../Config/SceneObjectManager.js";

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
        showImageInterface: false,
        imageInterfaceSource: null,

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

        setShowScannerInterface: (show) => set(state => {
            // console.log(`Setting scanner interface to: ${show}`);
            return {
                interaction: {
                    ...state.interaction,
                    showScannerInterface: show
                }
            };
        }),

        setShowCaptureInterface: (show) => set(state => {
            // console.log(`Setting capture interface to: ${show}`);
            return {
                interaction: {
                    ...state.interaction,
                    showCaptureInterface: show
                }
            };
        }),

        setShowImageInterface: (show, imageSource = null) => set(state => {
            console.log(`Setting image interface to: ${show}, with source: ${imageSource}`);
            return {
                interaction: {
                    ...state.interaction,
                    showImageInterface: show,
                    imageInterfaceSource: imageSource,
                }
            };
        }),

        setShowBlackscreenInterface: (show) => set(state => {
            // console.log(`Setting blackscreen interface to: ${show}`);
            return {
                interaction: {
                    ...state.interaction,
                    showBlackscreenInterface: show
                }
            };
        }),
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
                    },
                    showScannerInterface: false,
                    showCaptureInterface: false,
                    showBlackscreenInterface: false,
                    showImageInterface: false
                }
            }));

            // Cas spécial pour thirdStop - décaler l'objet MultipleLeaf
            if (currentStep === 'thirdStop') {
                // console.log("thirdStop détecté dans completeInteraction - appel direct du déplacement");

                // Importer dynamiquement sceneObjectManager si nécessaire
                if (sceneObjectManager) {
                    // console.log("Appel direct de handleThirdStopCompletion depuis InteractionSlice");
                    sceneObjectManager.handleThirdStopCompletion();
                } else {
                    console.warn("sceneObjectManager n'est pas disponible globalement");

                    // Alternative: émettre un événement spécifique pour demander le déplacement
                    // console.log("Émission d'un événement spécifique pour le déplacement");
                    // setTimeout(() => {
                        EventBus.trigger('leaf-erable-move-requested', {
                            step: currentStep,
                            timestamp: Date.now()
                        });
                    // }, 50);
                }
            }

            // Déclencher un événement pour que ScrollControls puisse réactiver le scroll
            // setTimeout(() => {
                EventBus.trigger('interaction-complete-set-allow-scroll', {
                    step: currentStep,
                    timestamp: Date.now()
                });

                // Émettre l'événement principal INTERACTION_COMPLETE
                // console.log("Emitting INTERACTION_COMPLETE event from completeInteraction");
                EventBus.trigger('INTERACTION_COMPLETE', {
                    id: currentStep,
                    type: 'direct',
                    source: 'interaction-slice'
                });
            // }, 50);

            return currentStep;
        }
    }
});