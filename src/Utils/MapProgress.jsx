import React, { useState, useEffect } from 'react';
import { EventBus } from './EventEmitter';

const MapProgress = () => {
    // État pour suivre quels checkpoints sont complétés
    const [completedCheckpoints, setCompletedCheckpoints] = useState(new Set());

    // Mapping des objets interactifs aux indices de checkpoints (0-7)
    const interactionToCheckpoint = {
        'DirectionPanelStartInteractive': 0,
        'TrunkLargeInteractive': 1,
        'AnimalPaws': 2, // Uniquement quand le scanner se ferme
        'JumpRock4': 3,
        'ThinTrunkInteractive': 4,
        'TreeStump': 5,
        'RiverCheckpoint': 6,
        'Vison': 7
    };

    // Mapping des requiredStep aux checkpoints
    const stepToCheckpoint = {
        'initialStartStop': 0,
        'firstStop': 1,
        'fifthStop': 2, // AnimalPaws
        'fourteenthStop': 3, // JumpRock4
        'fourthStop': 4, // ThinTrunkInteractive
        'seventeenStop': 6, // RiverCheckpoint
        'sixthStop': 7 // Vison
    };

    useEffect(() => {
        // Écouter les événements d'interaction complétée
        const handleInteractionComplete = (data) => {
            console.log('MapProgress - Interaction complétée:', data);

            let checkpointIndex = -1;

            // Essayer de mapper par requiredStep d'abord
            if (data.requiredStep && stepToCheckpoint[data.requiredStep] !== undefined) {
                checkpointIndex = stepToCheckpoint[data.requiredStep];
            }
            // Puis essayer par objectKey
            else if (data.objectKey && interactionToCheckpoint[data.objectKey] !== undefined) {
                checkpointIndex = interactionToCheckpoint[data.objectKey];
            }
            // Ou par l'id si c'est un step connu
            else if (data.id && stepToCheckpoint[data.id] !== undefined) {
                checkpointIndex = stepToCheckpoint[data.id];
            }

            if (checkpointIndex !== -1) {
                console.log(`MapProgress - Activation du checkpoint ${checkpointIndex}`);
                setCompletedCheckpoints(prev => new Set([...prev, checkpointIndex]));
            }
        };

        // Écouter spécifiquement la fermeture du scanner pour AnimalPaws
        const handleScannerAction = (data) => {
            if (data.type === 'scanner' && data.action === 'close' && data.result === 'complete') {
                console.log('MapProgress - Scanner fermé, activation checkpoint AnimalPaws');
                setCompletedCheckpoints(prev => new Set([...prev, 2])); // AnimalPaws = checkpoint 2
            }
        };

        // S'abonner aux événements
        const unsubscribeInteraction = EventBus.on('INTERACTION_COMPLETE', handleInteractionComplete);
        const unsubscribeMarkerInteraction = EventBus.on('marker:interaction:complete', handleInteractionComplete);
        const unsubscribeObjectInteraction = EventBus.on('object:interaction:complete', handleInteractionComplete);
        const unsubscribeInterfaceAction = EventBus.on('interface-action', handleScannerAction);

        // Debug: écouter tous les événements pour voir ce qui passe
        const handleDebugEvent = (data) => {
            if (data && (data.requiredStep || data.objectKey || data.id)) {
                console.log('MapProgress - Debug event reçu:', data);
            }
        };

        // Écouter quelques événements supplémentaires pour debug
        const unsubscribeDebug1 = EventBus.on('interaction-complete-set-allow-scroll', handleInteractionComplete);
        const unsubscribeDebug2 = EventBus.on('marker:click', handleDebugEvent);

        return () => {
            unsubscribeInteraction();
            unsubscribeMarkerInteraction();
            unsubscribeObjectInteraction();
            unsubscribeInterfaceAction();
            unsubscribeDebug1();
            unsubscribeDebug2();
        };
    }, []);

    // Fonction pour déterminer si un checkpoint est complété
    const isCheckpointCompleted = (index) => {
        return completedCheckpoints.has(index);
    };

    // Rendu du SVG avec les checkpoints appropriés
    const renderCheckpoint = (index, x, y) => {
        const isCompleted = isCheckpointCompleted(index);

        if (isCompleted) {
            return (
                <rect
                    key={`checkpoint-${index}`}
                    width="12"
                    height="12"
                    rx="6"
                    transform={`matrix(-1 0 0 1 ${x} ${y})`}
                    fill="#F9F9F9"
                />
            );
        } else {
            return (
                <g key={`checkpoint-${index}`}>
                    <rect
                        x="-0.5"
                        y="0.5"
                        width="11"
                        height="11"
                        rx="5.5"
                        transform={`matrix(-1 0 0 1 ${x} ${y})`}
                        fill="#9E9E9E"
                        fillOpacity="1"
                    />
                    <rect
                        x="-0.5"
                        y="0.5"
                        width="11"
                        height="11"
                        rx="5.5"
                        transform={`matrix(-1 0 0 1 ${x} ${y})`}
                        stroke="#F9F9F9"
                    />
                </g>
            );
        }
    };

    // Positions des checkpoints dans l'ordre du parcours
    const checkpointPositions = [
        [11, 4],    // 0: DirectionPanelStartInteractive
        [85, 21],   // 1: TrunkLargeInteractive
        [136, 22],  // 2: AnimalPaws (scanner)
        [182, 23],  // 3: JumpRock4
        [223, 6],   // 4: ThinTrunkInteractive
        [275, 0],   // 5: TreeStump (pas d'interaction spécifique?)
        [324, 9],   // 6: RiverCheckpoint
        [370, 17],  // 7: Vison
        [400, 40]   // 8: Point final (pas utilisé dans les interactions)
    ];

    return (
        <div className="map-progress">
            <svg width="401" height="52" viewBox="0 0 401 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Chemin principal */}
                <path
                    d="M6 9.21951L60.6703 22.1951L79.8049 26.878L147.091 28.5366H176.95L197.977 20.7317L217.742 12.439L242.554 9.21951L271.361 6L330.447 17.3171L361.988 22.1951L395 46"
                    stroke="#F9F9F9"
                />

                {/* Render tous les checkpoints */}
                {checkpointPositions.map((position, index) =>
                    renderCheckpoint(index, position[0], position[1])
                )}
            </svg>
        </div>
    );
};

export default MapProgress;