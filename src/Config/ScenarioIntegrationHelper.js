import { EventBus } from '../Utils/EventEmitter.jsx';
import { narrationManager } from '../Utils/NarrationManager.js';
import { animationManager } from './AnimationManager';
import useStore from '../Store/useStore.js';

/**
 * Classe utilitaire pour l'intégration du système de scénario
 * Fournit des méthodes pratiques pour interagir avec les différents systèmes
 */
class ScenarioIntegrationHelper {
    constructor() {
        this.initialized = false;
        this.debug = false;
    }

    /**
     * Initialise l'aide à l'intégration
     * @param {Object} options - Options d'initialisation
     */
    init(options = {}) {
        if (this.initialized) return;

        this.debug = options.debug || false;

        if (this.debug) {
            console.log('ScenarioIntegrationHelper initialized with debug mode');
        }

        this.initialized = true;
    }

    /**
     * Active ou désactive le mode débogage
     * @param {boolean} enabled - État du mode débogage
     */
    setDebug(enabled) {
        this.debug = enabled;
    }

    /**
     * Méthode pour journaliser en mode débogage
     * @param {string} message - Message à journaliser
     * @param {*} data - Données supplémentaires
     */
    log(message, data) {
        if (!this.debug) return;

        if (data) {
            console.log(`[ScenarioHelper] ${message}`, data);
        } else {
            console.log(`[ScenarioHelper] ${message}`);
        }
    }

    /**
     * Déclenche une narration
     * @param {string} narrationId - Identifiant de la narration
     * @returns {Promise} - Promesse résolue lorsque la narration est terminée
     */
    playNarration(narrationId) {
        this.log(`Playing narration: ${narrationId}`);

        // Récupérer l'état global (sans appeler directement le hook)
        const storeGetter = () => {
            if (typeof window !== 'undefined' && window.scene && window.scene.userData && window.scene.userData.storeInstance) {
                return window.scene.userData.storeInstance;
            }

            if (typeof useStore !== 'undefined') {
                return useStore.getState();
            }

            return null;
        };

        const store = storeGetter();

        // Vérifier si la narration a déjà été déclenchée
        if (store && store.isNarrationTriggered && store.isNarrationTriggered(narrationId)) {
            this.log(`Narration ${narrationId} already triggered, skipping`);
            return Promise.resolve(false);
        }

        // Marquer la narration comme déclenchée
        if (store && store.setNarrationTriggered) {
            store.setNarrationTriggered(narrationId);
        }

        // Jouer la narration via le gestionnaire
        narrationManager.playNarration(narrationId);

        // Retourner une promesse qui sera résolue lorsque la narration sera terminée
        return new Promise((resolve) => {
            const cleanup = EventBus.on('narration-ended', (data) => {
                if (data.narrationId === narrationId) {
                    cleanup(); // Se désabonner
                    resolve(true);
                }
            });
        });
    }

    /**
     * Déclenche une animation
     * @param {string} animationName - Nom de l'animation
     * @param {Object} target - Objet cible de l'animation
     * @param {Object} options - Options de l'animation
     * @returns {Promise} - Promesse résolue lorsque l'animation est terminée
     */
    playAnimation(animationName, target, options = {}) {
        this.log(`Playing animation: ${animationName}`, { target, options });

        if (!animationManager.animations[animationName]) {
            console.warn(`Animation ${animationName} not found`);
            return Promise.resolve(false);
        }

        // Générer un ID pour l'animation
        const animationId = `${animationName}-${target.name || target.id || 'unknown'}-${Date.now()}`;

        // Déclencher l'animation via le gestionnaire
        EventBus.trigger('animation:request', {
            id: target.name || target.id,
            animationName,
            animationOptions: options,
            targetObject: target
        });

        // Retourner une promesse qui sera résolue lorsque l'animation sera terminée
        return new Promise((resolve) => {
            const cleanup = EventBus.on('animation:complete', (data) => {
                if (data.name === animationName &&
                    (!data.target || data.target === (target.name || target.id))) {
                    cleanup(); // Se désabonner
                    resolve(true);
                }
            });
        });
    }

    /**
     * Attend qu'une interaction soit complétée
     * @param {string} step - Étape d'interaction à attendre
     * @returns {Promise} - Promesse résolue lorsque l'interaction est complétée
     */
    waitForInteraction(step) {
        this.log(`Waiting for interaction: ${step}`);

        // Récupérer l'état global (sans appeler directement le hook)
        const storeGetter = () => {
            if (typeof window !== 'undefined' && window.scene && window.scene.userData && window.scene.userData.storeInstance) {
                return window.scene.userData.storeInstance;
            }

            if (typeof window !== 'undefined' && window.useStore) {
                return window.useStore.getState();
            }

            return null;
        };

        const store = storeGetter();

        // Vérifier si l'interaction est déjà complétée
        if (store && store.interaction &&
            store.interaction.completedInteractions &&
            store.interaction.completedInteractions[step]) {
            this.log(`Interaction ${step} already completed`);
            return Promise.resolve(true);
        }

        // Configurer l'étape actuelle et attendre l'interaction
        if (store && store.interaction) {
            store.interaction.setCurrentStep(step);
            store.interaction.setWaitingForInteraction(true);
            store.interaction.setAllowScroll(false);
        }

        // Retourner une promesse qui sera résolue lorsque l'interaction sera complétée
        return new Promise((resolve) => {
            // Fonction pour vérifier périodiquement si l'interaction est complétée
            const checkCompletion = () => {
                const currentStore = storeGetter();

                if (currentStore && currentStore.interaction &&
                    currentStore.interaction.completedInteractions &&
                    currentStore.interaction.completedInteractions[step]) {
                    // Interaction complétée
                    resolve(true);
                } else {
                    // Vérifier à nouveau après un délai
                    setTimeout(checkCompletion, 500);
                }
            };

            // Commencer la vérification
            checkCompletion();
        });
    }

    /**
     * Exécute une séquence d'actions
     * @param {Array} actions - Tableau d'actions à exécuter
     * @returns {Promise} - Promesse résolue lorsque toutes les actions sont terminées
     */
    async executeSequence(actions) {
        this.log(`Executing sequence with ${actions.length} actions`);

        // Exécuter les actions séquentiellement
        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'narration':
                        await this.playNarration(action.id);
                        break;

                    case 'animation':
                        await this.playAnimation(action.name, action.target, action.options);
                        break;

                    case 'interaction':
                        await this.waitForInteraction(action.step);
                        break;

                    case 'delay':
                        await new Promise(resolve => setTimeout(resolve, action.duration));
                        break;

                    case 'function':
                        if (typeof action.callback === 'function') {
                            await action.callback();
                        }
                        break;

                    default:
                        console.warn(`Unknown action type: ${action.type}`);
                }
            } catch (error) {
                console.error(`Error executing action: ${action.type}`, error);
            }
        }

        this.log('Sequence execution completed');
        return true;
    }

    /**
     * Déclenche un événement de scénario
     * @param {string} eventName - Nom de l'événement
     * @param {Object} data - Données de l'événement
     */
    triggerScenarioEvent(eventName, data = {}) {
        this.log(`Triggering scenario event: ${eventName}`, data);

        // Préfixe pour les événements de scénario
        const prefixedEventName = `scenario:${eventName}`;

        // Déclencher l'événement
        EventBus.trigger(prefixedEventName, data);
    }

    /**
     * S'abonne à un événement de scénario
     * @param {string} eventName - Nom de l'événement
     * @param {Function} callback - Fonction de rappel
     * @returns {Function} - Fonction pour se désabonner
     */
    onScenarioEvent(eventName, callback) {
        // Préfixe pour les événements de scénario
        const prefixedEventName = `scenario:${eventName}`;

        // S'abonner à l'événement
        return EventBus.on(prefixedEventName, callback);
    }

    /**
     * Configure l'état d'interaction
     * @param {Object} interactionState - État d'interaction à configurer
     */
    setInteractionState(interactionState) {
        this.log('Setting interaction state', interactionState);

        // Helper to get store instance safely
        const storeGetter = () => {
            if (typeof window !== 'undefined' && window.scene && window.scene.userData && window.scene.userData.storeInstance) {
                return window.scene.userData.storeInstance;
            }

            if (typeof window !== 'undefined' && window.useStore) {
                return window.useStore.getState();
            }

            return null;
        };

        const store = storeGetter();

        if (!store || !store.interaction) {
            console.warn('Interaction state not available');
            return;
        }

        // Configurer l'état d'interaction
        if (interactionState.currentStep !== undefined) {
            store.interaction.setCurrentStep(interactionState.currentStep);
        }

        if (interactionState.waitingForInteraction !== undefined) {
            store.interaction.setWaitingForInteraction(interactionState.waitingForInteraction);
        }

        if (interactionState.allowScroll !== undefined) {
            store.interaction.setAllowScroll(interactionState.allowScroll);
        }

        if (interactionState.showCaptureInterface !== undefined) {
            store.interaction.setShowCaptureInterface(interactionState.showCaptureInterface);
        }

        if (interactionState.showScannerInterface !== undefined) {
            store.interaction.setShowScannerInterface(interactionState.showScannerInterface);
        }
    }

    /**
     * Valide une interaction
     * @param {string} step - Étape d'interaction à valider
     */
    completeInteraction(step) {
        this.log(`Completing interaction: ${step}`);

        // Helper to get store instance safely
        const storeGetter = () => {
            if (typeof window !== 'undefined' && window.scene && window.scene.userData && window.scene.userData.storeInstance) {
                return window.scene.userData.storeInstance;
            }

            if (typeof window !== 'undefined' && window.useStore) {
                return window.useStore.getState();
            }

            return null;
        };

        const store = storeGetter();

        if (!store || !store.interaction) {
            console.warn('Interaction state not available');
            return;
        }

        // Configurer l'étape actuelle et la valider
        store.interaction.setCurrentStep(step);
        store.interaction.setWaitingForInteraction(true);
        store.interaction.completeInteraction();
    }

    /**
     * Passe à l'étape suivante du scénario
     * @param {string} currentStep - Étape actuelle
     * @param {Object} options - Options pour la transition
     */
    progressToNextStep(currentStep, options = {}) {
        this.log(`Progressing from step: ${currentStep}`, options);

        // Helper to get store instance safely
        const storeGetter = () => {
            if (typeof window !== 'undefined' && window.scene && window.scene.userData && window.scene.userData.storeInstance) {
                return window.scene.userData.storeInstance;
            }

            if (typeof window !== 'undefined' && window.useStore) {
                return window.useStore.getState();
            }

            return null;
        };

        const store = storeGetter();

        // Mapper les étapes pour déterminer la suivante
        const stepProgression = {
            'initialStop': 'firstStop',
            'firstStop': 'secondStop',
            'secondStop': 'thirdStop',
            'thirdStop': 'fifthStop', // Remarque: saute à "fifthStop"
            'fifthStop': 'eleventhStop', // Saute plusieurs étapes après le scan
            'eleventhStop': 'twelfthStop',
            'twelfthStop': 'thirteenthStop',
            'thirteenthStop': 'fourteenthStop',
            'fourteenthStop': 'fourthStop', // Passage à la branche
            'fourthStop': 'tenthStop' // Panneau final
        };

        // Déterminer la prochaine étape
        const nextStep = stepProgression[currentStep] || null;

        if (!nextStep) {
            console.warn(`No next step defined for: ${currentStep}`);
            return;
        }

        // Configurer la prochaine étape
        this.setInteractionState({
            currentStep: nextStep,
            waitingForInteraction: options.waitForInteraction !== false,
            allowScroll: options.allowScroll !== false
        });

        // Déclencher un événement de progression
        this.triggerScenarioEvent('progress', {
            previousStep: currentStep,
            nextStep,
            ...options
        });

        return nextStep;
    }
}

// Exporter une instance unique (singleton)
export const scenarioHelper = new ScenarioIntegrationHelper();

// Ajouter l'instance à window pour pouvoir y accéder facilement depuis la console
if (typeof window !== 'undefined') {
    window.scenarioHelper = scenarioHelper;
}

export default scenarioHelper;