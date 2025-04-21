import React, { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import EasyModelMarker from './EasyModelMarker';
import sceneObjectManager from '../Config/SceneObjectManager';
import useStore from '../Store/useStore';
import { EventBus } from '../Utils/EventEmitter';
import MARKER_EVENTS from "../Utils/EventEmitter";

/**
 * Composant pour afficher les objets statiques (non-interactifs) dans la scène
 */
export function StaticObjects({ filter = {} }) {
    const [placements, setPlacements] = useState([]);
    const { scene } = useThree();

    // Récupérer les placements au chargement
    useEffect(() => {
        // Fonction pour mettre à jour les placements statiques
        const updatePlacements = () => {
            const staticPlacements = sceneObjectManager.getStaticPlacements(filter);
            setPlacements(staticPlacements);
        };

        // Mettre à jour initialement
        updatePlacements();

        return () => {
            // Nettoyage si nécessaire
        };
    }, [filter]);

    return (
        <group name="static-objects">
            {placements.map((placement, index) => {
                const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
                if (!objectConfig) return null;

                return (
                    <StaticObject
                        key={`static-${index}`}
                        path={objectConfig.path}
                        position={placement.position}
                        rotation={placement.rotation}
                        scale={placement.scale}
                        castShadow={placement.castShadow}
                        receiveShadow={placement.receiveShadow}
                        visible={placement.visible}
                    />
                );
            })}
        </group>
    );
}

/**
 * Composant pour afficher un objet statique individuel
 */
function StaticObject({ path, position, rotation, scale, castShadow = true, receiveShadow = true, visible = true }) {
    const { scene: model } = useGLTF(path);

    return (
        <primitive
            object={model.clone()}
            position={position}
            rotation={rotation}
            scale={scale}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            visible={visible}
        />
    );
}

/**
 * Composant pour gérer et afficher les objets interactifs dans la scène
 */
export function InteractiveObjects({ filter = {} }) {
    const [placements, setPlacements] = useState([]);
    const interaction = useStore(state => state.interaction);

    // Récupérer les placements au chargement et lors des changements
    useEffect(() => {
        // Fonction pour mettre à jour les placements interactifs
        const updatePlacements = () => {
            const interactivePlacements = sceneObjectManager.getInteractivePlacements(filter);
            setPlacements(interactivePlacements);
        };

        // Mettre à jour initialement
        updatePlacements();

        // Écouter les événements qui pourraient affecter les placements
        const handleInteractionComplete = () => {
            updatePlacements();
        };

        // S'abonner aux événements pertinents
        const cleanup = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);

        return () => {
            cleanup();
        };
    }, [filter]);

    // Mettre à jour lorsque l'étape d'interaction change
    useEffect(() => {
        if (interaction && interaction.currentStep) {
            // Mettre à jour les placements visibles en fonction de l'étape actuelle
            const updatedPlacements = sceneObjectManager.getInteractivePlacements({
                ...filter,
            });
            setPlacements(updatedPlacements);
        }
    }, [interaction?.currentStep, filter]);

    return (
        <group name="interactive-objects">
            {placements.map((placement) => {
                const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
                if (!objectConfig) return null;

                return (
                    <EasyModelMarker
                        key={placement.markerId}
                        modelPath={objectConfig.path}
                        position={placement.position}
                        rotation={placement.rotation}
                        scale={placement.scale}
                        markerId={placement.markerId}
                        markerType={placement.markerType}
                        markerText={placement.markerText}
                        markerColor={placement.markerColor}
                        markerOffset={placement.markerOffset}
                        markerAxis={placement.markerAxis}
                        outlineColor={placement.outlineColor}
                        outlinePulse={placement.outlinePulse}
                        requiredStep={placement.requiredStep}
                        onInteract={(event) => {
                            console.log(`Interaction avec ${placement.markerId}:`, event);
                            if (placement.onInteract) {
                                placement.onInteract(event);
                            }
                        }}
                    />
                );
            })}
        </group>
    );
}

/**
 * Composant pour afficher un seul objet interactif
 */
export function SingleInteractiveObject({ objectKey, position, options = {} }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    if (!objectConfig || !objectConfig.interactive) {
        console.error(`Objet interactif "${objectKey}" non trouvé ou non interactif.`);
        return null;
    }

    const markerId = options.markerId || `${objectKey}-single`;

    return (
        <EasyModelMarker
            modelPath={objectConfig.path}
            position={position || [0, 0, 0]}
            rotation={options.rotation || [0, 0, 0]}
            scale={options.scale || objectConfig.scale || [1, 1, 1]}
            markerId={markerId}
            markerType={options.markerType || objectConfig.interaction.type}
            markerText={options.markerText || objectConfig.interaction.text}
            markerColor={options.markerColor || objectConfig.interaction.color}
            markerOffset={options.markerOffset || objectConfig.interaction.offset}
            markerAxis={options.markerAxis || objectConfig.interaction.axis}
            outlineColor={options.outlineColor || objectConfig.interaction.color}
            outlinePulse={options.outlinePulse !== undefined ? options.outlinePulse : true}
            requiredStep={options.requiredStep || null}
            onInteract={(event) => {
                console.log(`Interaction avec ${markerId}:`, event);
                if (options.onInteract) {
                    options.onInteract(event);
                }
            }}
        />
    );
}

/**
 * Composant pour afficher un seul objet statique
 */
export function SingleStaticObject({ objectKey, position, options = {} }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    if (!objectConfig || objectConfig.interactive) {
        console.error(`Objet statique "${objectKey}" non trouvé ou est interactif.`);
        return null;
    }

    return (
        <StaticObject
            path={objectConfig.path}
            position={position || [0, 0, 0]}
            rotation={options.rotation || [0, 0, 0]}
            scale={options.scale || objectConfig.scale || [1, 1, 1]}
            castShadow={options.castShadow !== undefined ? options.castShadow : true}
            receiveShadow={options.receiveShadow !== undefined ? options.receiveShadow : true}
            visible={options.visible !== undefined ? options.visible : true}
        />
    );
}

/**
 * Composant principal qui affiche tous les objets de scène
 * Utilise les deux sous-composants pour objets statiques et interactifs
 */
export default function SceneObjects({ staticFilter = {}, interactiveFilter = {} }) {
    return (
        <group name="scene-objects">
            <StaticObjects filter={staticFilter} />
            <InteractiveObjects filter={interactiveFilter} />
        </group>
    );
}