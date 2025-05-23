import React, { useState, useEffect } from 'react';
import { EventBus } from './EventEmitter';

const MapProgress = () => {
    // État pour suivre quels checkpoints sont complétés
    const [completedCheckpoints, setCompletedCheckpoints] = useState(new Set());
    const [currentScrollPosition, setCurrentScrollPosition] = useState(0);

    // Définir les seuils de position pour chaque checkpoint (en pourcentage de la timeline 0-1)
    // Ces valeurs correspondent approximativement aux positions des interactions
    const checkpointThresholds = [
        0.19,   // 0: DirectionPanelStartInteractive - très tôt
        0.29,   // 1: TrunkLargeInteractive - après le premier obstacle
        0.43,   // 2: AnimalPaws Scanner - après les feuilles
        0.61,   // 3: JumpRock4 - après la traversée de rivière
        0.76,   // 4: ThinTrunkInteractive - après les rochers
        0.85,   // 5: RiverCheckpoint - vers la fin
        0.95,   // 6: Vison - presque à la fin
    ];

    useEffect(() => {
        // Écouter la position normalisée de la timeline émise par ScrollControls
        const handleTimelinePosition = (data) => {
            const position = data.position; // Position normalisée entre 0 et 1
            setCurrentScrollPosition(position);

            console.log(`MapProgress - Position scroll: ${(position * 100).toFixed(1)}%`);

            // Calculer quels checkpoints devraient être actifs
            const newCompletedCheckpoints = new Set();

            checkpointThresholds.forEach((threshold, index) => {
                if (position >= threshold) {
                    newCompletedCheckpoints.add(index);
                }
            });

            // Mettre à jour les checkpoints seulement s'il y a un changement
            setCompletedCheckpoints(prev => {
                const prevArray = Array.from(prev).sort();
                const newArray = Array.from(newCompletedCheckpoints).sort();

                // Comparer les arrays pour éviter les re-renders inutiles
                if (JSON.stringify(prevArray) !== JSON.stringify(newArray)) {
                    console.log(`MapProgress - Checkpoints actifs: ${newArray.join(', ')}`);
                    return newCompletedCheckpoints;
                }

                return prev;
            });
        };

        // S'abonner à l'événement de position normalisée
        const unsubscribe = EventBus.on('timeline-position-normalized', handleTimelinePosition);

        return () => {
            unsubscribe();
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
                    className="checkpoint-completed"
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

    // Positions des checkpoints correspondant aux 7 interactions principales
    const checkpointPositions = [
        [11, 4],    // 0: DirectionPanelStartInteractive
        [85, 21],   // 1: TrunkLargeInteractive
        [136, 22],  // 2: AnimalPaws Scanner
        [182, 23],  // 3: JumpRock4 - dernière pierre
        [223, 6],   // 4: ThinTrunkInteractive
        [324, 9],   // 5: RiverCheckpoint
        [370, 17],  // 6: Vison
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