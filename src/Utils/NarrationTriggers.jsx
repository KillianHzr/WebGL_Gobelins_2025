import React, { useEffect, useRef } from 'react';
import { EventBus, MARKER_EVENTS } from './EventEmitter';
import { narrationManager } from './NarrationManager';
import useStore from '../Store/useStore';
import sceneObjectManager from '../Config/SceneObjectManager';

const NarrationTriggers = () => {
    const eventListenersRef = useRef([]);
    const triggeredNarrationsRef = useRef(new Set());
    const part2TriggeredRef = useRef(false);

    const setNarrationTriggered = useStore(state => state.setNarrationTriggered);
    const triggeredNarrations = useStore(state => state.triggeredNarrations || {});

    const objectNarrationMap = {
        'TrunkLargeInteractive': 'Scene03_SautAuDessusDeLArbre',
        'MultipleLeaf': 'Scene04_RechercheDesIndices_part1',
        'AnimalPaws': 'Scene04_RechercheDesIndices_part2',
        'JumpRock4': 'Scene05_SautAu-DessusDeLaRiviere',
        'ThinTrunkInteractive': 'Scene06_PassageEn-DessousDeLaBranche',
        'RiverCheckpoint': 'Scene07_RemplissageDeLaGourde',
        'Vison': 'Scene08_DecouverteDuVisonMort',
    };

    const stepToObjectMap = {};

    const initializeMappings = () => {
        const interactivePlacements = sceneObjectManager.getInteractivePlacements();
        interactivePlacements.forEach(placement => {
            if (placement.requiredStep) {
                stepToObjectMap[placement.requiredStep] = placement.objectKey;
                if (placement.markerId) {
                    stepToObjectMap[placement.markerId] = placement.objectKey;
                }
            }
        });
        console.log('NarrationTriggers: Mapping steps to objects', stepToObjectMap);
    };

    const playNarrationIfNotTriggered = (narrationId) => {
        if (!narrationId) return;

        if (triggeredNarrationsRef.current.has(narrationId)) {
            console.log(`Narration ${narrationId} déjà déclenchée, ignorée.`);
            return;
        }

        if (triggeredNarrations[narrationId]) {
            console.log(`Narration ${narrationId} déjà déclenchée (depuis le store), ignorée.`);
            return;
        }

        console.log(`Déclenchement de la narration: ${narrationId}`);
        triggeredNarrationsRef.current.add(narrationId);
        setNarrationTriggered(narrationId);
        narrationManager.playNarration(narrationId);

        if (narrationId === 'Scene04_RechercheDesIndices_part2') {
            part2TriggeredRef.current = true;
            console.log('Partie 2 déclenchée, prêt pour partie 3 au prochain scan complet');
        }
    };

    useEffect(() => {
        initializeMappings();

        const handleInteractionDetected = (data) => {
            console.log('Événement INTERACTION_DETECTED reçu:', data);
            if (!data || !data.requiredStep) return;

            try {
                let objectKey = null;
                if (stepToObjectMap[data.requiredStep]) {
                    objectKey = stepToObjectMap[data.requiredStep];
                    console.log(`Trouvé objectKey via stepToObjectMap: ${objectKey}`);
                } else if (data.objectKey) {
                    objectKey = data.objectKey;
                    console.log(`Utilisation directe de objectKey: ${objectKey}`);
                }

                // Verification checks for prerequisites
                if (objectKey === 'AnimalPaws') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    const multipleLeafCompleted = Object.keys(completedInteractions).some(key =>
                        key.includes('thirdStop') || key.includes('MultipleLeaf')
                    );
                    if (!multipleLeafCompleted) {
                        console.log('AnimalPaws interaction ignorée car multipleLeaf n\'a pas encore été complété');
                        return;
                    }
                }

                // CORRECTION: Améliorer la logique pour les rocks
                if (objectKey === 'JumpRock2') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    console.log('Vérification JumpRock2 - Interactions complétées:', completedInteractions);

                    const rock1Completed = Object.keys(completedInteractions).some(key =>
                        key.includes('eleventhStop') || key.includes('JumpRock1')
                    );
                    if (!rock1Completed) {
                        console.log('JumpRock2 interaction ignorée car JumpRock1 n\'a pas encore été complété');
                        return;
                    }
                }

                if (objectKey === 'JumpRock3') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    console.log('Vérification JumpRock3 - Interactions complétées:', completedInteractions);

                    const rock2Completed = Object.keys(completedInteractions).some(key =>
                        key.includes('twelfthStop') || key.includes('JumpRock2')
                    );
                    if (!rock2Completed) {
                        console.log('JumpRock3 interaction ignorée car JumpRock2 n\'a pas encore été complété');
                        return;
                    }
                }

                if (objectKey === 'JumpRock4') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    console.log('🪨 Vérification JumpRock4 - Interactions complétées:', completedInteractions);
                    console.log('🪨 Clés dans completedInteractions:', Object.keys(completedInteractions));

                    const rock3Completed = Object.keys(completedInteractions).some(key => {
                        const matches = key.includes('thirteenthStop') || key.includes('JumpRock3');
                        console.log(`🪨 Clé "${key}" matches: ${matches}`);
                        return matches;
                    });

                    console.log('🪨 JumpRock3 complété:', rock3Completed);

                    if (!rock3Completed) {
                        console.log('🪨 JumpRock4 interaction ignorée car JumpRock3 n\'a pas encore été complété');
                        return;
                    } else {
                        console.log('🪨 JumpRock4 - Prérequis OK, procédure normale');
                    }
                }

                if (objectKey && objectNarrationMap[objectKey]) {
                    const narrationId = objectNarrationMap[objectKey];

                    console.log(`🎵 Narration à jouer pour ${objectKey}: ${narrationId}`);
                    playNarrationIfNotTriggered(narrationId);
                } else {
                    console.log(`❌ Pas de narration trouvée pour l'objet identifié: ${objectKey || 'inconnu'}`);
                }
            } catch (error) {
                console.error('Erreur lors du traitement de l\'événement d\'interaction:', error);
            }
        };

        const handleInterfaceClose = (data) => {
            if (data && data.type === 'scanner') {
                if (data.action === 'close' && data.result === 'complete') {
                    if (part2TriggeredRef.current) {
                        playNarrationIfNotTriggered('Scene04_RechercheDesIndices_part3');
                        console.log('Narration partie 3 déclenchée après scan complété qui suit la partie 2');
                    } else {
                        console.log('Scan complété mais partie 2 pas encore déclenchée, pas de narration partie 3');
                    }
                } else if (data.action === 'cancel') {
                    console.log('Scan annulé - pas de narration déclenchée');
                }
            }
        };

        try {
            // Register event listeners
            const interactionDetectedListener = EventBus.on('interaction:detected', handleInteractionDetected);
            // const interactionCompleteListener = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleClickInteraction);
            const interfaceListener = EventBus.on('interface-action', handleInterfaceClose);

            // IMPORTANT: Don't duplicate INTERACTION_COMPLETE listeners
            // Let ScrollControls manage these events for scroll behavior

            eventListenersRef.current = [
                interactionDetectedListener,
                // interactionCompleteListener,
                interfaceListener
            ];

            console.log('NarrationTriggers: Écouteurs d\'événements configurés');
        } catch (error) {
            console.error('Erreur lors de la configuration des écouteurs pour les narrations:', error);
        }

        return () => {
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
    }, [setNarrationTriggered, triggeredNarrations]);

    return null;
};

export default NarrationTriggers;