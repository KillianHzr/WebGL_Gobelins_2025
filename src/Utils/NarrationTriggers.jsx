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
        'DirectionPanelStartInteractive': 'Scene02_PanneauInformation',
        'TrunkLargeInteractive': 'Scene03_SautAuDessusDeLArbre',
        'MultipleLeaf': 'Scene04_RechercheDesIndices_part1',
        'AnimalPaws': 'Scene04_RechercheDesIndices_part2',
        'JumpRock1': 'Scene05_SautAu-DessusDeLaRiviere',
        'ThinTrunkInteractive': 'Scene06_PassageEn-DessousDeLaBranche',
        'RiverCheckpoint': 'Scene07_RemplissageDeLaGourde',
        'Vison': 'Scene08_DecouverteDuVisonMort',
        'DirectionPanelEndInteractive': 'Scene09_ClairiereDigitalisee'
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

                // Similar checks for rock interactions
                if (objectKey === 'JumpRock2') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
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
                    const rock3Completed = Object.keys(completedInteractions).some(key =>
                        key.includes('thirteenthStop') || key.includes('JumpRock3')
                    );
                    if (!rock3Completed) {
                        console.log('JumpRock4 interaction ignorée car JumpRock3 n\'a pas encore été complété');
                        return;
                    }
                }

                if (objectKey && objectNarrationMap[objectKey]) {
                    const narrationId = objectNarrationMap[objectKey];

                    // Skip special narrations during automatic detection - they need clicks
                    // if (narrationId === 'Scene02_PanneauInformation' || narrationId === 'Scene09_ClairiereDigitalisee') {
                    //     console.log(`Narration ${narrationId} ignorée lors de la détection d'interaction, attente du clic.`);
                    //     return;
                    // }

                    console.log(`Narration à jouer pour ${objectKey}: ${narrationId}`);
                    playNarrationIfNotTriggered(narrationId);
                } else {
                    console.log(`Pas de narration trouvée pour l'objet identifié: ${objectKey || 'inconnu'}`);
                }
            } catch (error) {
                console.error('Erreur lors du traitement de l\'événement d\'interaction:', error);
            }
        };

        // const handleClickInteraction = (data) => {
        //     console.log('Événement d\'interaction par clic reçu:', data);
        //     if (!data || !data.id) return;
        //
        //     try {
        //         // Only handle click or direct interactions
        //         if (data.type === 'click' || data.type === 'direct') {
        //             let narrationId = null;
        //             let objectKey = null;
        //
        //             // Clean ID for comparison
        //             const cleanId = data.id.replace('-marker', '');
        //
        //             // Initial panel
        //             if (cleanId.includes('initialStart') || cleanId.includes('initial')) {
        //                 objectKey = 'DirectionPanelStartInteractive';
        //                 narrationId = 'Scene02_PanneauInformation';
        //             }
        //             // Final panel
        //             else if (cleanId.includes('tenthStop') || cleanId.includes('DirectionPanelEndInteractive') || cleanId.includes('DirectionPanelDigital')) {
        //                 objectKey = 'DirectionPanelEndInteractive';
        //                 narrationId = 'Scene09_ClairiereDigitalisee';
        //             }
        //
        //             if (narrationId) {
        //                 console.log(`Déclenchement de la narration ${narrationId} après le clic sur ${data.id}`);
        //                 playNarrationIfNotTriggered(narrationId);
        //             }
        //         }
        //
        //         // IMPORTANT: Don't interfere with scroll reactivation
        //         // Let ScrollControls handle this part
        //     } catch (error) {
        //         console.error('Erreur lors du traitement du clic:', error);
        //     }
        // };

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