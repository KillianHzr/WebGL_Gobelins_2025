import React, { useEffect, useRef, useState } from 'react';
import { EventBus, MARKER_EVENTS } from './EventEmitter';
import { narrationManager } from './NarrationManager';
import useStore from '../Store/useStore';
import sceneObjectManager from '../Config/SceneObjectManager';

/**
 * Configuration des déclencheurs de narration par scène
 * Chaque scène contient les déclencheurs et les effets associés
 */
const SCENARIO_CONFIG = {
    // Scène 02 - Panneau d'information
    'Scene02_PanneauInformation': {
        markerId: 'DirectionPanelEndInteractive',
        objectKey: 'DirectionPanelEndInteractive',
        triggerType: 'interaction:detected',
        narrationId: 'Scene02_PanneauInformation',
        cameraAnimation: {
            enabled: true,
            lookAt: true,
            zoom: true
        },
        interface: null
    },

    // Scène 03 - Saut au-dessus de l'arbre
    'Scene03_SautAuDessusDeLArbre': {
        markerId: 'firstStop-marker',
        objectKey: 'TrunkLargeInteractive',
        triggerType: 'interaction:detected',
        narrationId: 'Scene03_SautAuDessusDeLArbre',
    },

    // Scène 04 - Recherche des indices (Part 1)
    'Scene04_RechercheDesIndices_part1': {
        markerId: 'thirdStop-marker',
        objectKey: 'LeafErable',
        triggerType: 'interaction:detected',
        narrationId: 'Scene04_RechercheDesIndices_part1',
        postInteractionAnimation: {
            name: 'leaf-scatter',
            options: { duration: 1.2, spread: 1.5 }
        },
        onComplete: (store) => {
            // Déverrouiller la prochaine interaction
            store.interaction.setCurrentStep('fifthStop');
        }
    },

    // Scène 04 - Recherche des indices (Part 2)
    'Scene04_RechercheDesIndices_part2': {
        markerId: 'fifthStop-marker',
        objectKey: 'AnimalPaws',
        triggerType: 'interaction:detected',
        requiresPrevious: 'Scene04_RechercheDesIndices_part1',
        narrationId: 'Scene04_RechercheDesIndices_part2',
        interface: 'scanner',
        onComplete: (store) => {
            // Marquer que Part 2 a été déclenchée pour permettre Part 3
            store.setNarrationTriggered('Scene04_RechercheDesIndices_part2');
        }
    },

    // Scène 04 - Recherche des indices (Part 3)
    'Scene04_RechercheDesIndices_part3': {
        markerId: null, // Déclenchement spécial via l'interface
        objectKey: null,
        triggerType: 'interface-action',
        interfaceResult: 'complete',
        requiresPrevious: 'Scene04_RechercheDesIndices_part2',
        narrationId: 'Scene04_RechercheDesIndices_part3'
    },

    // Scène 05 - Saut au-dessus de la rivière
    'Scene05_SautAu-DessusDeLaRiviere': {
        markerId: 'JumpRock1',
        objectKey: 'JumpRock1',
        triggerType: 'interaction:detected',
        narrationId: 'Scene05_SautAu-DessusDeLaRiviere',
        // Séquence de sauts successifs
        nextInteractions: [
            { markerId: 'JumpRock2', requiredStep: 'twelfthStop' },
            { markerId: 'JumpRock3', requiredStep: 'thirteenthStop' },
            { markerId: 'JumpRock4', requiredStep: 'fourteenthStop' }
        ],
        postInteractionAnimation: {
            name: 'river-jump',
            options: { duration: 0.8, height: 1.2 }
        }
    },

    // Scène 06 - Passage en-dessous de la branche
    'Scene06_PassageEn-DessousDeLaBranche': {
        markerId: 'ThinTrunkInteractive',
        objectKey: 'ThinTrunkInteractive',
        triggerType: 'interaction:detected',
        narrationId: 'Scene06_PassageEn-DessousDeLaBranche',
        postInteractionAnimation: {
            name: 'duck-animation',
            options: { duration: 1.0 }
        }
    },

    // Scène 08 - Découverte du vison mort
    'Scene08_DecouverteDuVisonMort': {
        markerId: 'sixthStop-marker',
        objectKey: 'Vison',
        triggerType: 'interaction:detected',
        narrationId: 'Scene08_DecouverteDuVisonMort',
        interface: 'capture',
        postInteractionAnimation: {
            name: 'camera-flash',
            options: { duration: 1.0 }
        }
    },

    // Scène 09 - Facture
    'Scene09_ClairiereDigitalisee': {
        markerId: 'tenthStop-marker',
        objectKey: 'DirectionPanelEndInteractive',
        triggerType: 'interaction:detected',
        narrationId: 'Scene09_ClairiereDigitalisee',
        cameraAnimation: {
            enabled: true,
            lookAt: true,
            zoom: true
        }
    },
};

/**
 * Composant gérant les déclencheurs de scénario
 * Établit les liens entre les interactions sur les marqueurs et les éléments de scénario
 */
const ScenarioTriggerSystem = () => {
    // Référence pour garder trace des écouteurs d'événements
    const eventListenersRef = useRef([]);

    // État pour suivre les scènes déjà déclenchées
    const [triggeredScenes, setTriggeredScenes] = useState({});

    // Récupérer l'état global
    const store = useStore();

    // Fonction pour vérifier si une scène peut être déclenchée
    const canTriggerScene = (sceneId) => {
        const sceneConfig = SCENARIO_CONFIG[sceneId];

        // Si la scène a déjà été déclenchée et n'est pas répétable
        if (triggeredScenes[sceneId] && !sceneConfig.repeatable) {
            return false;
        }

        // Si cette scène nécessite qu'une autre ait été déclenchée avant
        if (sceneConfig.requiresPrevious) {
            const previousTriggered = store.isNarrationTriggered(sceneConfig.requiresPrevious);
            if (!previousTriggered) {
                console.log(`Scène ${sceneId} bloquée car ${sceneConfig.requiresPrevious} n'a pas encore été déclenchée`);
                return false;
            }
        }

        return true;
    };

    // Fonction pour déclencher une scène
    const triggerScene = (sceneId, eventData = {}) => {
        console.log(`Déclenchement de la scène: ${sceneId}`, eventData);

        const sceneConfig = SCENARIO_CONFIG[sceneId];
        if (!sceneConfig) {
            console.error(`Configuration pour la scène ${sceneId} introuvable`);
            return;
        }

        // Vérifier si la scène peut être déclenchée
        if (!canTriggerScene(sceneId)) {
            console.log(`Impossible de déclencher la scène ${sceneId}`);
            return;
        }

        // Marquer la scène comme déclenchée
        setTriggeredScenes(prev => ({ ...prev, [sceneId]: true }));
        store.setNarrationTriggered(sceneId);

        // Jouer la narration associée
        if (sceneConfig.narrationId) {
            narrationManager.playNarration(sceneConfig.narrationId);
        }

        // Exécuter les animations post-interaction
        if (sceneConfig.postInteractionAnimation) {
            EventBus.trigger(MARKER_EVENTS.INTERACTION_ANIMATION, {
                id: sceneConfig.markerId,
                animationName: sceneConfig.postInteractionAnimation.name,
                animationOptions: sceneConfig.postInteractionAnimation.options || {},
                targetObject: sceneConfig.postInteractionAnimation.targetObject || null
            });
        }

        // Afficher l'interface spécifiée si nécessaire
        if (sceneConfig.interface) {
            if (sceneConfig.interface === 'camera') {
                store.interaction.setShowCaptureInterface(true);
            } else if (sceneConfig.interface === 'scanner') {
                store.interaction.setShowScannerInterface(true);
            }
        }

        // Activer les prochaines interactions dans une séquence
        if (sceneConfig.nextInteractions && sceneConfig.nextInteractions.length > 0) {
            const nextInteraction = sceneConfig.nextInteractions[0];
            store.interaction.setCurrentStep(nextInteraction.requiredStep);
            store.interaction.setWaitingForInteraction(true);
        }

        // Exécuter le callback onComplete si défini
        if (typeof sceneConfig.onComplete === 'function') {
            sceneConfig.onComplete(store);
        }
    };

    // Configurer les écouteurs d'événements au montage
    useEffect(() => {
        // Créer une map pour accéder rapidement aux scènes par markerId
        const markerToSceneMap = {};
        const objectKeyToSceneMap = {};

        // Remplir les maps pour un accès rapide
        Object.entries(SCENARIO_CONFIG).forEach(([sceneId, config]) => {
            if (config.markerId) {
                markerToSceneMap[config.markerId] = sceneId;
            }
            if (config.objectKey) {
                objectKeyToSceneMap[config.objectKey] = sceneId;
            }
        });

        console.log('ScenarioTriggerSystem: Config chargé avec les marqueurs et déclencheurs:', {
            scenes: Object.keys(SCENARIO_CONFIG),
            triggers: Object.values(SCENARIO_CONFIG).map(config => config.triggerType),
            markers: Object.keys(markerToSceneMap),
            objects: Object.keys(objectKeyToSceneMap)
        });

        // Fonction de gestion des événements de marqueur
        const handleEvent = (eventType, data) => {
            console.log(`Événement ${eventType} reçu:`, data);

            // Identifier la scène concernée
            let sceneId = null;

            // Chercher par markerId
            if (data.id && markerToSceneMap[data.id]) {
                sceneId = markerToSceneMap[data.id];
                console.log(`Scène trouvée par markerId: ${sceneId}`);
            }
            // Chercher par markerId dans data.markerId (pour les nouveaux événements)
            else if (data.markerId && markerToSceneMap[data.markerId]) {
                sceneId = markerToSceneMap[data.markerId];
                console.log(`Scène trouvée par data.markerId: ${sceneId}`);
            }
            // Chercher par objectKey
            else if (data.objectKey && objectKeyToSceneMap[data.objectKey]) {
                sceneId = objectKeyToSceneMap[data.objectKey];
                console.log(`Scène trouvée par objectKey: ${sceneId}`);
            }
            // Chercher par requiredStep
            else if (data.requiredStep) {
                // Chercher par correspondance directe avec requiredStep
                Object.entries(SCENARIO_CONFIG).forEach(([id, config]) => {
                    if (config.markerId && config.markerId.includes(data.requiredStep) ||
                        (config.objectKey && config.requiredStep === data.requiredStep)) {
                        sceneId = id;
                        console.log(`Scène trouvée par requiredStep: ${sceneId}`);
                    }
                });
            }
            // Chercher dans les substrings (pour les marqueurs avec ID composés)
            else if (data.id) {
                for (const [markerId, scene] of Object.entries(markerToSceneMap)) {
                    if (data.id.includes(markerId)) {
                        sceneId = scene;
                        console.log(`Scène trouvée par substring dans markerId: ${sceneId}`);
                        break;
                    }
                }

                // Si toujours pas trouvée, essayer avec des parties extraites de l'ID
                // Par exemple, extraire "firstStop" de "firstStop-marker"
                if (!sceneId && data.id.includes('-')) {
                    const parts = data.id.split('-');
                    const potentialStepId = parts[0];

                    // Chercher par le step ID
                    for (const [scene, config] of Object.entries(SCENARIO_CONFIG)) {
                        if (config.markerId && config.markerId.includes(potentialStepId)) {
                            sceneId = scene;
                            console.log(`Scène trouvée par step ID ${potentialStepId}: ${sceneId}`);
                            break;
                        }
                    }
                }
            }

            if (!sceneId) {
                console.log(`Aucune scène trouvée pour l'événement ${eventType} avec données:`, data);
                return;
            }

            // Vérifier si le type d'événement correspond au déclencheur de la scène
            const sceneConfig = SCENARIO_CONFIG[sceneId];
            if (sceneConfig.triggerType === eventType) {
                console.log(`Type d'événement ${eventType} correspond au déclencheur pour la scène ${sceneId}`);
                triggerScene(sceneId, data);
            } else {
                console.log(`Type d'événement ${eventType} ne correspond PAS au déclencheur ${sceneConfig.triggerType} pour la scène ${sceneId}`);
            }
        };

        // Fonction de gestion des événements d'interface
        const handleInterfaceEvent = (data) => {
            console.log('Événement interface reçu:', data);

            // Rechercher les scènes qui sont déclenchées par des actions d'interface
            const matchingScenes = Object.entries(SCENARIO_CONFIG)
                .filter(([_, config]) =>
                    config.triggerType === 'interface-action' &&
                    config.interfaceResult === data.result);

            if (matchingScenes.length > 0) {
                console.log(`${matchingScenes.length} scènes trouvées pour l'événement d'interface`);
            } else {
                console.log('Aucune scène trouvée pour l\'événement d\'interface');
            }

            matchingScenes.forEach(([sceneId, _]) => {
                triggerScene(sceneId, data);
            });
        };

        // S'abonner aux événements pertinents avec gestion des erreurs
        try {
            const listeners = [
                // Événements d'interaction standards
                EventBus.on(MARKER_EVENTS.MARKER_CLICK, (data) => handleEvent(MARKER_EVENTS.MARKER_CLICK, data)),
                EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, (data) => handleEvent(MARKER_EVENTS.INTERACTION_COMPLETE, data)),

                // NOUVEAU: S'abonner au nouvel événement d'interaction détectée automatiquement
                EventBus.on('interaction:detected', (data) => handleEvent('interaction:detected', data)),

                // Conserver l'événement pour les actions d'interface
                EventBus.on('interface-action', handleInterfaceEvent)
            ];

            // Stocker les références pour le nettoyage
            eventListenersRef.current = listeners;

            console.log('ScenarioTriggerSystem: Écouteurs d\'événements configurés');
        } catch (error) {
            console.error('Erreur lors de la configuration des écouteurs pour le scénario:', error);
        }

        // Nettoyage lors du démontage
        return () => {
            // Nettoyer tous les écouteurs d'événements
            eventListenersRef.current.forEach(cleanup => {
                try {
                    if (typeof cleanup === 'function') {
                        cleanup();
                    }
                } catch (error) {
                    console.warn('Erreur lors du nettoyage des écouteurs:', error);
                }
            });
        };
    }, [store]);

    // Ce composant ne rend rien visuellement
    return null;
};

export default ScenarioTriggerSystem;